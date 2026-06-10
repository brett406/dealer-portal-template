/**
 * Phase 3 admin-action coverage (docs/BOM-COSTING.md §15, §16, §13.2–§13.4):
 * materials / labor-rates server actions against the real local test DB, with
 * only the request-context modules mocked (same pattern as media-folders).
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { checkDatabaseAvailable } from "@/tests/helpers/integration";
import { resetDatabase } from "@/tests/helpers/db";
import {
  createTestCategory,
  createTestProduct,
  createTestVariant,
  createTestMaterial,
  createTestLaborRate,
  createTestBomComponent,
  createTestBomLaborLine,
  createTestSiteSetting,
} from "@/tests/helpers/factories";

let mockSession: Session | null = null;
vi.mock("@/lib/auth", () => ({ auth: vi.fn(() => Promise.resolve(mockSession)) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
  headers: vi.fn().mockResolvedValue({ get: () => null }),
}));

const {
  createMaterial,
  updateMaterial,
  toggleMaterialArchived,
  deleteMaterial,
  addMaterialComponent,
  addMaterialLaborLine,
  updateMaterialComponent,
} = await import("@/app/admin/materials/actions");
const { getMaterialPickerOptions, getLaborRatePickerOptions } = await import(
  "@/app/admin/materials/queries"
);
const { createLaborRate, updateLaborRate, deleteLaborRate, toggleLaborRateArchived } =
  await import("@/app/admin/labor-rates/actions");

function fd(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [k, v] of Object.entries(fields)) formData.append(k, v);
  return formData;
}

function adminSession(user: { id: string; email: string }): Session {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: "Admin",
      role: "SUPER_ADMIN",
      mustChangePassword: false,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  } as Session;
}

async function createAdmin() {
  const admin = await prisma.user.create({
    data: {
      email: `bom-ui-admin-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: "$2a$10$fakehashplaceholder",
      name: "BOM UI Admin",
      role: "SUPER_ADMIN",
    },
  });
  mockSession = adminSession(admin);
  return admin;
}

/** Form payload for updateMaterial built from an existing row + overrides. */
function materialFd(
  material: { name: string; sku: string | null; unit: string; kind: string },
  overrides: Record<string, string> = {},
) {
  return fd({
    name: material.name,
    sku: material.sku ?? "",
    unit: material.unit,
    kind: material.kind,
    unitCost: "",
    categoryId: "",
    ...overrides,
  });
}

let dbAvailable = false;
beforeAll(async () => {
  dbAvailable = await checkDatabaseAvailable();
});

beforeEach(async (ctx) => {
  if (!dbAvailable) ctx.skip();
  await resetDatabase();
  mockSession = null;
});

describe("auth guard", () => {
  it("rejects a CUSTOMER session via requireAdmin redirect", async () => {
    mockSession = {
      user: {
        id: "cust-user",
        email: "dealer@example.com",
        name: "Dealer",
        role: "CUSTOMER",
        mustChangePassword: false,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as Session;
    const material = await createTestMaterial();
    await expect(updateMaterial(material.id, materialFd(material))).rejects.toThrow(/REDIRECT/);
  });
});

describe("material CRUD actions", () => {
  it("creates a material with audit and redirects to its detail page", async () => {
    await createAdmin();

    await expect(
      createMaterial(
        fd({ name: "Steel tube", sku: "STL-1", unit: "ft", kind: "raw", unitCost: "2.5" }),
      ),
    ).rejects.toThrow(/REDIRECT:\/admin\/materials\//);

    const material = await prisma.material.findUniqueOrThrow({ where: { sku: "STL-1" } });
    expect(material.name).toBe("Steel tube");
    expect(material.unitCost!.toFixed(4)).toBe("2.5000");

    const audits = await prisma.auditLog.findMany({ where: { action: "MATERIAL_CREATE" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.targetId).toBe(material.id);
  });

  it("rejects a duplicate SKU on create", async () => {
    await createAdmin();
    await createTestMaterial({ sku: "DUP-1" });

    const result = await createMaterial(
      fd({ name: "Other", sku: "DUP-1", unit: "each", kind: "raw", unitCost: "" }),
    );
    expect(result.errors?.sku).toMatch(/already exists/i);
  });

  it("unitCost change reprices a dependent variant (trigger MATERIAL_COST_UPDATE)", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    const admin = await createAdmin();
    const category = await createTestCategory();
    const steel = await createTestMaterial({ name: "Steel", unit: "ft", unitCost: "2.50" });
    const product = await createTestProduct(category.id, { priceFromBom: true });
    const variant = await createTestVariant(product.id, { baseRetailPrice: "99.99" });
    await createTestBomComponent({ productId: product.id }, steel.id, 2);

    const result = await updateMaterial(steel.id, materialFd(steel, { unitCost: "3.00" }));
    expect(result.success).toBe(true);

    // 2 ft × $3.00, margins default 0 → $6.00
    const repriced = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(repriced.baseRetailPrice.toFixed(2)).toBe("6.00");

    const reprice = await prisma.auditLog.findFirstOrThrow({ where: { action: "BOM_REPRICE" } });
    expect(reprice.userId).toBe(admin.id);
    const details = reprice.details as Record<string, unknown>;
    expect(details.trigger).toBe("MATERIAL_COST_UPDATE");
    expect(details.materialId).toBe(steel.id);
  });

  it("does NOT reprice when the unitCost did not change", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    await createAdmin();
    const category = await createTestCategory();
    const steel = await createTestMaterial({ name: "Steel", unitCost: "2.50" });
    const product = await createTestProduct(category.id, { priceFromBom: true });
    await createTestVariant(product.id, { baseRetailPrice: "99.99" });
    await createTestBomComponent({ productId: product.id }, steel.id, 2);

    const result = await updateMaterial(
      steel.id,
      materialFd(steel, { name: "Steel renamed", unitCost: "2.5000" }),
    );
    expect(result.success).toBe(true);

    expect(await prisma.auditLog.count({ where: { action: "BOM_REPRICE" } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "MATERIAL_UPDATE" } })).toBe(1);
  });

  it("rejects subassembly→raw while it still has own BOM lines (§13.3)", async () => {
    await createAdmin();
    const sub = await createTestMaterial({ name: "Bracket", kind: "subassembly", unitCost: null });
    const steel = await createTestMaterial({ name: "Steel" });
    await createTestBomComponent({ parentMaterialId: sub.id }, steel.id, 4);

    const result = await updateMaterial(sub.id, materialFd(sub, { kind: "raw" }));
    expect(result.errors?.kind).toMatch(/remove its components first/i);

    const unchanged = await prisma.material.findUniqueOrThrow({ where: { id: sub.id } });
    expect(unchanged.kind).toBe("subassembly");
  });

  it("allows subassembly→raw when it has no own lines", async () => {
    await createAdmin();
    const sub = await createTestMaterial({ name: "Empty sub", kind: "subassembly", unitCost: null });

    const result = await updateMaterial(sub.id, materialFd(sub, { kind: "raw", unitCost: "1.00" }));
    expect(result.success).toBe(true);
    const updated = await prisma.material.findUniqueOrThrow({ where: { id: sub.id } });
    expect(updated.kind).toBe("raw");
  });

  it("archive toggle sets/clears archivedAt with MATERIAL_ARCHIVE audit", async () => {
    await createAdmin();
    const material = await createTestMaterial();

    await toggleMaterialArchived(material.id);
    let row = await prisma.material.findUniqueOrThrow({ where: { id: material.id } });
    expect(row.archivedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "MATERIAL_ARCHIVE" } });
    expect((audit.details as Record<string, unknown>).archived).toBe(true);

    await toggleMaterialArchived(material.id);
    row = await prisma.material.findUniqueOrThrow({ where: { id: material.id } });
    expect(row.archivedAt).toBeNull();
  });

  it("delete is blocked while referenced, suggesting archive (§13.2)", async () => {
    await createAdmin();
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);
    const material = await createTestMaterial();
    await createTestBomComponent({ productId: product.id }, material.id, 1);

    const result = await deleteMaterial(material.id);
    expect(result.error).toMatch(/in use by 1 BOM line/i);
    expect(result.error).toMatch(/archive instead/i);
    expect(await prisma.material.count({ where: { id: material.id } })).toBe(1);
  });

  it("delete works when unreferenced and cascades its own lines", async () => {
    await createAdmin();
    const sub = await createTestMaterial({ name: "Sub", kind: "subassembly", unitCost: null });
    const steel = await createTestMaterial({ name: "Steel" });
    const rate = await createTestLaborRate();
    await createTestBomComponent({ parentMaterialId: sub.id }, steel.id, 1);
    await createTestBomLaborLine({ parentMaterialId: sub.id }, rate.id, 1);

    const result = await deleteMaterial(sub.id);
    expect(result.success).toBe(true);
    expect(await prisma.material.count({ where: { id: sub.id } })).toBe(0);
    expect(await prisma.bomComponent.count()).toBe(0);
    expect(await prisma.bomLaborLine.count()).toBe(0);
  });
});

describe("sub-assembly BOM editor actions", () => {
  it("adds a component line, logs BOM_UPDATE, and reprices dependents", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    await createAdmin();
    const category = await createTestCategory();
    const sub = await createTestMaterial({ name: "Bracket", kind: "subassembly", unitCost: null });
    const steel = await createTestMaterial({ name: "Steel", unitCost: "2.50" });
    const product = await createTestProduct(category.id, { priceFromBom: true });
    const variant = await createTestVariant(product.id, { baseRetailPrice: "99.99" });
    await createTestBomComponent({ productId: product.id }, sub.id, 1);

    const result = await addMaterialComponent(sub.id, fd({ materialId: steel.id, quantity: "4" }));
    expect(result.success).toBe(true);

    // Bracket = 4 × 2.50 = 10.00; product consumes 1 bracket, margins 0
    const repriced = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(repriced.baseRetailPrice.toFixed(2)).toBe("10.00");

    const bomUpdate = await prisma.auditLog.findFirstOrThrow({ where: { action: "BOM_UPDATE" } });
    expect((bomUpdate.details as Record<string, unknown>).op).toBe("addComponent");
    const reprice = await prisma.auditLog.findFirstOrThrow({ where: { action: "BOM_REPRICE" } });
    expect((reprice.details as Record<string, unknown>).trigger).toBe("BOM_UPDATE");
  });

  it("rejects a direct self-reference cheaply (§15)", async () => {
    await createAdmin();
    const sub = await createTestMaterial({ name: "Sub", kind: "subassembly", unitCost: null });

    const result = await addMaterialComponent(sub.id, fd({ materialId: sub.id, quantity: "1" }));
    expect(result.errors?.materialId).toMatch(/itself/i);
  });

  it("rejects a save-time cycle and names the path (A→B then B→A, §4.5)", async () => {
    await createAdmin();
    const subA = await createTestMaterial({ name: "Sub A", kind: "subassembly", unitCost: null });
    const subB = await createTestMaterial({ name: "Sub B", kind: "subassembly", unitCost: null });

    const first = await addMaterialComponent(subA.id, fd({ materialId: subB.id, quantity: "1" }));
    expect(first.success).toBe(true);

    const second = await addMaterialComponent(subB.id, fd({ materialId: subA.id, quantity: "1" }));
    expect(second.errors?.materialId).toMatch(/cycle/i);
    expect(second.errors?.materialId).toContain("Sub A");
    expect(second.errors?.materialId).toContain("Sub B");

    // The bad edge was never persisted
    expect(await prisma.bomComponent.count({ where: { parentMaterialId: subB.id } })).toBe(0);
  });

  it("rejects a chain deeper than SAVE_MAX_DEPTH=10 (§13.4)", async () => {
    await createAdmin();
    const subs = [];
    for (let i = 1; i <= 10; i++) {
      subs.push(
        await createTestMaterial({ name: `Level ${i}`, kind: "subassembly", unitCost: null }),
      );
    }
    for (let i = 0; i < 9; i++) {
      await createTestBomComponent({ parentMaterialId: subs[i]!.id }, subs[i + 1]!.id, 1);
    }
    const raw = await createTestMaterial({ name: "Leaf raw" });

    // Chain is exactly 10 deep; hanging a raw off the bottom makes it 11.
    const result = await addMaterialComponent(
      subs[9]!.id,
      fd({ materialId: raw.id, quantity: "1" }),
    );
    expect(result.errors?.materialId).toMatch(/11 levels deep/i);
    expect(result.errors?.materialId).toMatch(/maximum is 10/i);
  });

  it("rejects a duplicate (parent, material) line (§15)", async () => {
    await createAdmin();
    const sub = await createTestMaterial({ name: "Sub", kind: "subassembly", unitCost: null });
    const steel = await createTestMaterial({ name: "Steel" });

    await addMaterialComponent(sub.id, fd({ materialId: steel.id, quantity: "1" }));
    const second = await addMaterialComponent(sub.id, fd({ materialId: steel.id, quantity: "2" }));
    expect(second.errors?.materialId).toMatch(/already on this BOM/i);
  });

  it("rejects a duplicate (parent, laborRate) line (§15)", async () => {
    await createAdmin();
    const sub = await createTestMaterial({ name: "Sub", kind: "subassembly", unitCost: null });
    const rate = await createTestLaborRate({ name: "Welder" });

    await addMaterialLaborLine(sub.id, fd({ laborRateId: rate.id, hours: "0.5" }));
    const second = await addMaterialLaborLine(sub.id, fd({ laborRateId: rate.id, hours: "1" }));
    expect(second.errors?.laborRateId).toMatch(/already on this BOM/i);
  });

  it("rejects non-positive quantity and hours (§15: strictly > 0)", async () => {
    await createAdmin();
    const sub = await createTestMaterial({ name: "Sub", kind: "subassembly", unitCost: null });
    const steel = await createTestMaterial({ name: "Steel" });
    const rate = await createTestLaborRate();

    const qty = await addMaterialComponent(sub.id, fd({ materialId: steel.id, quantity: "0" }));
    expect(qty.errors?.quantity).toMatch(/greater than 0/i);

    const hrs = await addMaterialLaborLine(sub.id, fd({ laborRateId: rate.id, hours: "0" }));
    expect(hrs.errors?.hours).toMatch(/greater than 0/i);
  });

  it("rejects adding an archived material as a component (§13.2)", async () => {
    await createAdmin();
    const sub = await createTestMaterial({ name: "Sub", kind: "subassembly", unitCost: null });
    const old = await createTestMaterial({ name: "Old steel", archivedAt: new Date() });

    const result = await addMaterialComponent(sub.id, fd({ materialId: old.id, quantity: "1" }));
    expect(result.errors?.materialId).toMatch(/archived/i);
  });

  it("quantity edit reprices (BOM_UPDATE) via updateMaterialComponent", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    await createAdmin();
    const category = await createTestCategory();
    const sub = await createTestMaterial({ name: "Sub", kind: "subassembly", unitCost: null });
    const steel = await createTestMaterial({ name: "Steel", unitCost: "2.00" });
    const line = await createTestBomComponent({ parentMaterialId: sub.id }, steel.id, 1);
    const product = await createTestProduct(category.id, { priceFromBom: true });
    const variant = await createTestVariant(product.id, { baseRetailPrice: "99.99" });
    await createTestBomComponent({ productId: product.id }, sub.id, 1);

    const result = await updateMaterialComponent(line.id, fd({ quantity: "3" }));
    expect(result.success).toBe(true);

    const repriced = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(repriced.baseRetailPrice.toFixed(2)).toBe("6.00");
  });
});

describe("labor rate actions", () => {
  it("creates a labor rate with audit; rejects duplicate names", async () => {
    await createAdmin();

    const result = await createLaborRate(fd({ name: "Welder", ratePerHour: "60" }));
    expect(result.success).toBe(true);
    const rate = await prisma.laborRate.findUniqueOrThrow({ where: { name: "Welder" } });
    expect(rate.ratePerHour.toFixed(2)).toBe("60.00");
    expect(await prisma.auditLog.count({ where: { action: "LABOR_RATE_CREATE" } })).toBe(1);

    const dup = await createLaborRate(fd({ name: "Welder", ratePerHour: "10" }));
    expect(dup.errors?.name).toMatch(/already exists/i);
  });

  it("ratePerHour change reprices dependents (trigger LABOR_RATE_UPDATE)", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    await createAdmin();
    const category = await createTestCategory();
    const rate = await createTestLaborRate({ name: "Assembly", ratePerHour: "50.00" });
    const product = await createTestProduct(category.id, { priceFromBom: true });
    const variant = await createTestVariant(product.id, { baseRetailPrice: "99.99" });
    await createTestBomLaborLine({ productId: product.id }, rate.id, 2);

    const result = await updateLaborRate(rate.id, fd({ name: "Assembly", ratePerHour: "60" }));
    expect(result.success).toBe(true);

    // 2h × $60, margins 0 → $120.00
    const repriced = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(repriced.baseRetailPrice.toFixed(2)).toBe("120.00");

    const reprice = await prisma.auditLog.findFirstOrThrow({ where: { action: "BOM_REPRICE" } });
    expect((reprice.details as Record<string, unknown>).trigger).toBe("LABOR_RATE_UPDATE");
  });

  it("does NOT reprice on a rename without a rate change", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    await createAdmin();
    const category = await createTestCategory();
    const rate = await createTestLaborRate({ name: "Assembly", ratePerHour: "50.00" });
    const product = await createTestProduct(category.id, { priceFromBom: true });
    await createTestVariant(product.id, { baseRetailPrice: "99.99" });
    await createTestBomLaborLine({ productId: product.id }, rate.id, 2);

    const result = await updateLaborRate(rate.id, fd({ name: "Assembler", ratePerHour: "50.00" }));
    expect(result.success).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "BOM_REPRICE" } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "LABOR_RATE_UPDATE" } })).toBe(1);
  });

  it("delete is blocked while referenced; archive toggle audits", async () => {
    await createAdmin();
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);
    const rate = await createTestLaborRate();
    await createTestBomLaborLine({ productId: product.id }, rate.id, 1);

    const blocked = await deleteLaborRate(rate.id);
    expect(blocked.error).toMatch(/in use by 1 BOM line/i);
    expect(blocked.error).toMatch(/archive instead/i);

    await toggleLaborRateArchived(rate.id);
    const archived = await prisma.laborRate.findUniqueOrThrow({ where: { id: rate.id } });
    expect(archived.archivedAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "LABOR_RATE_ARCHIVE" } })).toBe(1);

    const unreferenced = await createTestLaborRate();
    const deleted = await deleteLaborRate(unreferenced.id);
    expect(deleted.error).toBeUndefined();
    expect(await prisma.laborRate.count({ where: { id: unreferenced.id } })).toBe(0);
  });
});

describe("picker query helpers (§13.2)", () => {
  it("excludes archived materials and the material itself", async () => {
    await createAdmin();
    const self = await createTestMaterial({ name: "Self sub", kind: "subassembly", unitCost: null });
    const active = await createTestMaterial({ name: "Active steel" });
    const archived = await createTestMaterial({ name: "Old steel", archivedAt: new Date() });

    const options = await getMaterialPickerOptions(self.id);
    const ids = options.map((o) => o.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(archived.id);
    expect(ids).not.toContain(self.id);
  });

  it("excludes archived labor rates", async () => {
    await createAdmin();
    const active = await createTestLaborRate({ name: "Active rate" });
    const archived = await createTestLaborRate({ name: "Old rate", archivedAt: new Date() });

    const options = await getLaborRatePickerOptions();
    const ids = options.map((o) => o.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(archived.id);
  });
});
