/**
 * Phase 4 settings coverage (docs/BOM-COSTING.md §6, §5): the master toggle +
 * default-markup action, including the TOGGLE-triggered reprice. Real local
 * test DB; only request-context modules mocked (same pattern as the other
 * BOM action tests).
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
  createTestBomComponent,
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

const { updateBomSettings } = await import("@/app/admin/settings/actions");

let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await checkDatabaseAvailable();
});

function fd(data: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
}

async function loginAsSuperAdmin() {
  const user = await prisma.user.create({
    data: {
      email: `settings-admin-${Date.now()}@test.com`,
      password: "$2a$10$fakehashplaceholder",
      name: "Settings Admin",
      role: "SUPER_ADMIN",
    },
  });
  mockSession = {
    user: { id: user.id, email: user.email, name: user.name, role: "SUPER_ADMIN" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  } as unknown as Session;
  return user;
}

describe("updateBomSettings", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
    mockSession = null;
  });

  it("enabling the toggle runs a TOGGLE reprice over priceFromBom variants", async () => {
    await createTestSiteSetting({ bomCostingEnabled: false });
    await loginAsSuperAdmin();

    const category = await createTestCategory();
    const material = await createTestMaterial({ unitCost: "10.00" });
    const product = await createTestProduct(category.id, {
      priceFromBom: true,
      materialMarginPercent: "40",
      laborMarginPercent: "80",
    });
    const variant = await createTestVariant(product.id, { baseRetailPrice: "1.00" });
    await createTestBomComponent({ productId: product.id }, material.id, 2);

    const result = await updateBomSettings(
      {},
      fd({ bomCostingEnabled: "on", defaultMaterialMarginPercent: "0", defaultLaborMarginPercent: "0" }),
    );

    expect(result.success).toBe(true);
    const settings = await prisma.siteSetting.findFirstOrThrow();
    expect(settings.bomCostingEnabled).toBe(true);

    // 2 × 10.00 × 1.40 = 28.00 (product margins beat the 0 site defaults)
    const repriced = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(repriced.baseRetailPrice.toFixed(2)).toBe("28.00");

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "BOM_REPRICE" } });
    expect((audit.details as Record<string, unknown>).trigger).toBe("TOGGLE");
  });

  it("disabling never reprices and leaves prices at their last value", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    await loginAsSuperAdmin();

    const result = await updateBomSettings(
      {},
      fd({ defaultMaterialMarginPercent: "0", defaultLaborMarginPercent: "0" }), // checkbox absent = off
    );

    expect(result.success).toBe(true);
    expect((await prisma.siteSetting.findFirstOrThrow()).bomCostingEnabled).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "BOM_REPRICE" } })).toBe(0);
  });

  it("changing default markups while enabled triggers a MARGIN_UPDATE reprice", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    await loginAsSuperAdmin();

    const category = await createTestCategory();
    const material = await createTestMaterial({ unitCost: "10.00" });
    // No product-level margins → the site defaults apply.
    const product = await createTestProduct(category.id, { priceFromBom: true });
    const variant = await createTestVariant(product.id, { baseRetailPrice: "1.00" });
    await createTestBomComponent({ productId: product.id }, material.id, 1);

    const result = await updateBomSettings(
      {},
      fd({ bomCostingEnabled: "on", defaultMaterialMarginPercent: "100", defaultLaborMarginPercent: "0" }),
    );

    expect(result.success).toBe(true);
    const repriced = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(repriced.baseRetailPrice.toFixed(2)).toBe("20.00"); // 10 × 2.00

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "BOM_REPRICE" } });
    expect((audit.details as Record<string, unknown>).trigger).toBe("MARGIN_UPDATE");
  });

  it("rejects out-of-range markups", async () => {
    await createTestSiteSetting({ bomCostingEnabled: false });
    await loginAsSuperAdmin();

    const result = await updateBomSettings(
      {},
      fd({ defaultMaterialMarginPercent: "1000", defaultLaborMarginPercent: "-1" }),
    );

    expect(result.errors?.defaultMaterialMarginPercent).toBeTruthy();
    expect(result.errors?.defaultLaborMarginPercent).toBeTruthy();
  });

  it("errors cleanly when no SiteSetting row exists", async () => {
    await loginAsSuperAdmin();
    const result = await updateBomSettings(
      {},
      fd({ bomCostingEnabled: "on", defaultMaterialMarginPercent: "0", defaultLaborMarginPercent: "0" }),
    );
    expect(result.error).toMatch(/not been initialized/);
  });

  it("requires SUPER_ADMIN (STAFF is redirected)", async () => {
    await createTestSiteSetting({ bomCostingEnabled: false });
    const user = await prisma.user.create({
      data: {
        email: `settings-staff-${Date.now()}@test.com`,
        password: "$2a$10$fakehashplaceholder",
        name: "Staff",
        role: "STAFF",
      },
    });
    mockSession = {
      user: { id: user.id, email: user.email, name: user.name, role: "STAFF" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as unknown as Session;

    await expect(
      updateBomSettings({}, fd({ defaultMaterialMarginPercent: "0", defaultLaborMarginPercent: "0" })),
    ).rejects.toThrow(/REDIRECT/);
  });
});
