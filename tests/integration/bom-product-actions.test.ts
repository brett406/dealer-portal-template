import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
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
import { checkDatabaseAvailable } from "@/tests/helpers/integration";
import { resetDatabase } from "@/tests/helpers/db";
import { repriceAll } from "@/lib/bom/reprice";
import { SAVE_MAX_DEPTH } from "@/lib/bom/cost";

// Real DB; only the request-context modules are mocked (same pattern as
// tests/integration/media-folders.test.ts).
let mockSession: Session | null = null;
vi.mock("@/lib/auth", () => ({ auth: vi.fn(() => Promise.resolve(mockSession)) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
  headers: vi.fn().mockResolvedValue({ get: () => null }),
}));

const {
  updateVariant,
  updateProductBomPricing,
  addBomComponent,
} = await import("@/app/admin/products/actions");

let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await checkDatabaseAvailable();
});

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

async function createAdminUser() {
  const user = await prisma.user.create({
    data: {
      email: `bom-actions-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: "$2a$10$fakehashplaceholder",
      name: "BOM Admin",
      role: "SUPER_ADMIN",
    },
  });
  mockSession = adminSession(user);
  return user;
}

/**
 * The §17 golden scenario: Steel/Paint raws, Bracket sub-assembly, one
 * variant priced from the product BOM at 40%/80% markups → 234.00.
 */
async function createGoldenScenario() {
  await createTestSiteSetting({ bomCostingEnabled: true });
  const admin = await createAdminUser();
  const category = await createTestCategory();

  const steel = await createTestMaterial({ name: "Steel tube", unit: "ft", unitCost: "2.50" });
  const paint = await createTestMaterial({ name: "Paint", unit: "L", unitCost: "30.00" });
  const bracket = await createTestMaterial({ name: "Bracket", kind: "subassembly", unitCost: null });

  const welder = await createTestLaborRate({ name: "Welder", ratePerHour: "60.00" });
  const assembly = await createTestLaborRate({ name: "Assembly", ratePerHour: "40.00" });

  await createTestBomComponent({ parentMaterialId: bracket.id }, steel.id, 4);
  await createTestBomLaborLine({ parentMaterialId: bracket.id }, welder.id, 0.25);

  const product = await createTestProduct(category.id, {
    priceFromBom: true,
    materialMarginPercent: "40",
    laborMarginPercent: "80",
  });
  const variant = await createTestVariant(product.id, { baseRetailPrice: "0.01" });

  await createTestBomComponent({ productId: product.id }, steel.id, 10);
  await createTestBomComponent({ productId: product.id }, bracket.id, 2);
  await createTestBomComponent({ productId: product.id }, paint.id, 0.5);
  await createTestBomLaborLine({ productId: product.id }, assembly.id, 1.5);

  return { admin, category, steel, paint, bracket, welder, assembly, product, variant };
}

function variantForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("name", "Variant A");
  fd.set("sku", "VAR-A");
  fd.set("stockQuantity", "0");
  fd.set("lowStockThreshold", "5");
  fd.set("active", "on");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("read-only price enforcement (§5)", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  it("rejects a direct baseRetailPrice write for an effective-priceFromBom variant", async () => {
    const { admin, variant } = await createGoldenScenario();
    await repriceAll({ trigger: "MANUAL", userId: admin.id });

    const result = await updateVariant(
      variant.id,
      variantForm({ name: variant.name, sku: variant.sku, baseRetailPrice: "999.99" }),
    );

    expect(result.errors?.baseRetailPrice).toMatch(/computed from its BOM/i);
    const unchanged = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(unchanged.baseRetailPrice.toFixed(2)).toBe("234.00");
  });

  it("still updates other fields when the (disabled) price field is not submitted", async () => {
    const { admin, variant } = await createGoldenScenario();
    await repriceAll({ trigger: "MANUAL", userId: admin.id });

    // Disabled inputs are not part of FormData — simulate the locked form.
    const result = await updateVariant(
      variant.id,
      variantForm({ name: "Renamed", sku: variant.sku }),
    );

    expect(result.success).toBe(true);
    const updated = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updated.name).toBe("Renamed");
    expect(updated.baseRetailPrice.toFixed(2)).toBe("234.00");
  });

  it("allows a direct price write when the variant opts out (priceFromBom=false)", async () => {
    const { product } = await createGoldenScenario();
    const optOut = await createTestVariant(product.id, {
      baseRetailPrice: "5.00",
      priceFromBom: false,
    });

    const result = await updateVariant(
      optOut.id,
      variantForm({ name: optOut.name, sku: optOut.sku, baseRetailPrice: "123.45" }),
    );

    expect(result.success).toBe(true);
    const updated = await prisma.productVariant.findUniqueOrThrow({ where: { id: optOut.id } });
    expect(updated.baseRetailPrice.toFixed(2)).toBe("123.45");
  });

  it("allows a direct price write when the global toggle is off", async () => {
    const { admin, variant } = await createGoldenScenario();
    await repriceAll({ trigger: "MANUAL", userId: admin.id });
    await prisma.siteSetting.updateMany({ data: { bomCostingEnabled: false } });

    const result = await updateVariant(
      variant.id,
      variantForm({ name: variant.name, sku: variant.sku, baseRetailPrice: "50.00" }),
    );

    expect(result.success).toBe(true);
    const updated = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updated.baseRetailPrice.toFixed(2)).toBe("50.00");
  });
});

describe("updateProductBomPricing (markups + priceFromBom)", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  it("a markup change reprices per §17 math with a MARGIN_UPDATE trigger", async () => {
    const { admin, product, variant } = await createGoldenScenario();
    await repriceAll({ trigger: "MANUAL", userId: admin.id });

    // 0%/0% markups → price = bare cost 90 + 60 = 150.00 (§17 components)
    const fd = new FormData();
    fd.set("priceFromBom", "on");
    fd.set("materialMarginPercent", "0");
    fd.set("laborMarginPercent", "0");
    const result = await updateProductBomPricing(product.id, fd);

    expect(result.success).toBe(true);
    const updated = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updated.baseRetailPrice.toFixed(2)).toBe("150.00");

    const reprice = await prisma.auditLog.findFirstOrThrow({
      where: { action: "BOM_REPRICE" },
      orderBy: { createdAt: "desc" },
    });
    const details = reprice.details as Record<string, unknown>;
    expect(details.trigger).toBe("MARGIN_UPDATE");
    expect(details.changes).toMatchObject([{ before: "234.00", after: "150.00" }]);

    // The pricing edit itself is audited as BOM_UPDATE (op: pricing)
    const pricingAudit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "BOM_UPDATE", targetId: product.id },
    });
    expect((pricingAudit.details as Record<string, unknown>).op).toBe("pricing");
  });

  it("validates markup bounds (§15: 0–999.99)", async () => {
    const { product } = await createGoldenScenario();

    const fd = new FormData();
    fd.set("priceFromBom", "on");
    fd.set("materialMarginPercent", "1000");
    fd.set("laborMarginPercent", "80");
    const result = await updateProductBomPricing(product.id, fd);

    expect(result.errors?.materialMarginPercent).toMatch(/999\.99/);
  });

  it("is rejected when BOM costing is globally disabled (§6)", async () => {
    const { product } = await createGoldenScenario();
    await prisma.siteSetting.updateMany({ data: { bomCostingEnabled: false } });

    const fd = new FormData();
    fd.set("priceFromBom", "on");
    const result = await updateProductBomPricing(product.id, fd);

    expect(result.error).toMatch(/disabled/i);
  });
});

describe("addBomComponent", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  it("adds a line, writes a BOM_UPDATE audit row, and reprices (trigger BOM_UPDATE)", async () => {
    const { admin, product, variant, paint } = await createGoldenScenario();
    // Remove the paint line so we can re-add it through the action.
    await prisma.bomComponent.deleteMany({
      where: { productId: product.id, materialId: paint.id },
    });
    await repriceAll({ trigger: "MANUAL", userId: admin.id });
    // Without paint: material 75 × 1.4 + 60 × 1.8 = 105 + 108 = 213.00
    expect(
      (await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).baseRetailPrice.toFixed(2),
    ).toBe("213.00");

    const fd = new FormData();
    fd.set("materialId", paint.id);
    fd.set("quantity", "0.5");
    const result = await addBomComponent({ productId: product.id }, fd);

    expect(result.success).toBe(true);
    // Back to the §17 golden 234.00
    expect(
      (await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).baseRetailPrice.toFixed(2),
    ).toBe("234.00");

    const lineAudit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "BOM_UPDATE", targetId: product.id },
    });
    expect(lineAudit.userId).toBe(admin.id);
    expect(lineAudit.details).toMatchObject({
      op: "add",
      lineType: "component",
      materialId: paint.id,
    });

    const reprice = await prisma.auditLog.findFirstOrThrow({
      where: { action: "BOM_REPRICE" },
      orderBy: { createdAt: "desc" },
    });
    expect((reprice.details as Record<string, unknown>).trigger).toBe("BOM_UPDATE");
  });

  it("rejects a duplicate (parent, material) line (§15)", async () => {
    const { product, steel } = await createGoldenScenario();

    const fd = new FormData();
    fd.set("materialId", steel.id);
    fd.set("quantity", "3");
    const result = await addBomComponent({ productId: product.id }, fd);

    expect(result.errors?.materialId).toMatch(/already on this BOM/i);
    expect(
      await prisma.bomComponent.count({ where: { productId: product.id, materialId: steel.id } }),
    ).toBe(1);
  });

  it("rejects a non-positive quantity (§15)", async () => {
    const { product, paint } = await createGoldenScenario();
    await prisma.bomComponent.deleteMany({
      where: { productId: product.id, materialId: paint.id },
    });

    const fd = new FormData();
    fd.set("materialId", paint.id);
    fd.set("quantity", "0");
    const result = await addBomComponent({ productId: product.id }, fd);

    expect(result.errors?.quantity).toMatch(/greater than 0/i);
  });

  it("rejects an archived material (§13.2)", async () => {
    const { product } = await createGoldenScenario();
    const archived = await createTestMaterial({
      name: "Old Paint",
      unitCost: "10.00",
      archivedAt: new Date(),
    });

    const fd = new FormData();
    fd.set("materialId", archived.id);
    fd.set("quantity", "1");
    const result = await addBomComponent({ productId: product.id }, fd);

    expect(result.errors?.materialId).toMatch(/archived/i);
  });

  it("rejects a sub-assembly that would exceed SAVE_MAX_DEPTH, allows one within it (§13.4)", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    await createAdminUser();
    const category = await createTestCategory();
    const product = await createTestProduct(category.id, { priceFromBom: true });
    await createTestVariant(product.id);

    // Chain: raw (depth 1) ← sub_1 (2) ← … ← sub_9 (10)
    const raw = await createTestMaterial({ name: "Chain raw", unitCost: "1.00" });
    let child = raw;
    const subs = [];
    for (let i = 1; i <= SAVE_MAX_DEPTH - 1; i++) {
      const sub = await createTestMaterial({
        name: `Sub ${i}`,
        kind: "subassembly",
        unitCost: null,
      });
      await createTestBomComponent({ parentMaterialId: sub.id }, child.id, 1);
      subs.push(sub);
      child = sub;
    }
    const depth10 = subs[subs.length - 1]!; // chain depth 10 → product would be 11
    const depth9 = subs[subs.length - 2]!; // chain depth 9 → product is exactly 10

    const rejectFd = new FormData();
    rejectFd.set("materialId", depth10.id);
    rejectFd.set("quantity", "1");
    const rejected = await addBomComponent({ productId: product.id }, rejectFd);
    expect(rejected.errors?.materialId).toMatch(/levels deep/i);
    expect(await prisma.bomComponent.count({ where: { productId: product.id } })).toBe(0);

    const okFd = new FormData();
    okFd.set("materialId", depth9.id);
    okFd.set("quantity", "1");
    const allowed = await addBomComponent({ productId: product.id }, okFd);
    expect(allowed.success).toBe(true);
    expect(await prisma.bomComponent.count({ where: { productId: product.id } })).toBe(1);
  });

  it("supports variant parents and a variant's first own line overrides the product BOM (§4.1)", async () => {
    const { admin, variant, steel } = await createGoldenScenario();
    await repriceAll({ trigger: "MANUAL", userId: admin.id });

    const fd = new FormData();
    fd.set("materialId", steel.id);
    fd.set("quantity", "1");
    const result = await addBomComponent({ productVariantId: variant.id }, fd);

    expect(result.success).toBe(true);
    // Own BOM: 1 ft steel → 2.50 × 1.4 = 3.50; labor still inherited: 60 × 1.8 = 108
    const updated = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updated.baseRetailPrice.toFixed(2)).toBe("111.50");

    const lineAudit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "BOM_UPDATE", targetId: variant.id },
    });
    expect(lineAudit.targetType).toBe("ProductVariant");
  });
});
