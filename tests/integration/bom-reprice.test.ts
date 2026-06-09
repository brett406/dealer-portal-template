import { describe, it, expect, beforeAll, beforeEach } from "vitest";
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

let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await checkDatabaseAvailable();
});

async function createAdminUser() {
  return prisma.user.create({
    data: {
      email: `bom-admin-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: "$2a$10$fakehashplaceholder",
      name: "BOM Admin",
      role: "SUPER_ADMIN",
    },
  });
}

/**
 * The §17 golden scenario: Steel/Paint raws, Bracket sub-assembly,
 * "Gate 4ft" variant priced from the product BOM at 40%/80% markups.
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

describe("BOM database integrity", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  it("CHECK constraint rejects a BomComponent with zero parents", async () => {
    const material = await createTestMaterial();
    await expect(
      prisma.bomComponent.create({ data: { materialId: material.id, quantity: 1 } }),
    ).rejects.toThrow(/bom_component_one_parent|check constraint/i);
  });

  it("CHECK constraint rejects a BomComponent with two parents", async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);
    const variant = await createTestVariant(product.id);
    const material = await createTestMaterial();
    await expect(
      prisma.bomComponent.create({
        data: {
          productId: product.id,
          productVariantId: variant.id,
          materialId: material.id,
          quantity: 1,
        },
      }),
    ).rejects.toThrow(/bom_component_one_parent|check constraint/i);
  });

  it("CHECK constraint applies to BomLaborLine too", async () => {
    const rate = await createTestLaborRate();
    await expect(
      prisma.bomLaborLine.create({ data: { laborRateId: rate.id, hours: 1 } }),
    ).rejects.toThrow(/bom_labor_line_one_parent|check constraint/i);
  });

  it("deleting a referenced Material is blocked (Restrict)", async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);
    const material = await createTestMaterial();
    await createTestBomComponent({ productId: product.id }, material.id, 1);
    await expect(prisma.material.delete({ where: { id: material.id } })).rejects.toThrow();
  });

  it("deleting a referenced LaborRate is blocked (Restrict)", async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);
    const rate = await createTestLaborRate();
    await createTestBomLaborLine({ productId: product.id }, rate.id, 1);
    await expect(prisma.laborRate.delete({ where: { id: rate.id } })).rejects.toThrow();
  });

  it("deleting a Product cascades its BOM lines (material survives)", async () => {
    const category = await createTestCategory();
    const product = await createTestProduct(category.id);
    const material = await createTestMaterial();
    await createTestBomComponent({ productId: product.id }, material.id, 1);

    await prisma.product.delete({ where: { id: product.id } });
    expect(await prisma.bomComponent.count()).toBe(0);
    expect(await prisma.material.count()).toBe(1);
  });
});

describe("repriceAll", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  it("prices the §17 golden scenario end-to-end (234.00) with audit", async () => {
    const { admin, variant, bracket, steel } = await createGoldenScenario();

    const result = await repriceAll({ trigger: "MANUAL", userId: admin.id });

    expect(result.ran).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      variantId: variant.id,
      before: "0.01",
      after: "234.00",
    });

    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    });
    expect(updatedVariant.baseRetailPrice.toFixed(2)).toBe("234.00");
    expect(updatedVariant.computedCost!.toFixed(4)).toBe("150.0000");

    // Sub-assembly rolled at cost; raw mirrors unitCost (§3)
    const updatedBracket = await prisma.material.findUniqueOrThrow({ where: { id: bracket.id } });
    expect(updatedBracket.computedCost!.toFixed(4)).toBe("25.0000");
    const updatedSteel = await prisma.material.findUniqueOrThrow({ where: { id: steel.id } });
    expect(updatedSteel.computedCost!.toFixed(4)).toBe("2.5000");

    const audits = await prisma.auditLog.findMany({ where: { action: "BOM_REPRICE" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.userId).toBe(admin.id);
    const details = audits[0]!.details as Record<string, unknown>;
    expect(details.trigger).toBe("MANUAL");
    expect(details.affectedVariantCount).toBe(1);
    expect(details.changes).toMatchObject([{ sku: variant.sku, after: "234.00" }]);
  });

  it("is idempotent — a second run with no cost changes writes nothing", async () => {
    const { admin, variant } = await createGoldenScenario();
    await repriceAll({ trigger: "MANUAL", userId: admin.id });

    const before = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    const second = await repriceAll({ trigger: "MANUAL", userId: admin.id });

    expect(second.changes).toHaveLength(0);
    const after = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it("propagates a leaf raw-cost edit through the sub-assembly to the price (§18.2.4)", async () => {
    const { admin, variant, steel, bracket } = await createGoldenScenario();
    await repriceAll({ trigger: "MANUAL", userId: admin.id });

    await prisma.material.update({ where: { id: steel.id }, data: { unitCost: "3.00" } });
    const result = await repriceAll({
      trigger: "MATERIAL_COST_UPDATE",
      userId: admin.id,
      materialId: steel.id,
    });

    // bracket: 4×3 + 15 = 27; gate material: 10×3 + 2×27 + 15 = 99
    // price: 99×1.4 + 60×1.8 = 138.60 + 108 = 246.60
    const updatedBracket = await prisma.material.findUniqueOrThrow({ where: { id: bracket.id } });
    expect(updatedBracket.computedCost!.toFixed(4)).toBe("27.0000");
    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    });
    expect(updatedVariant.baseRetailPrice.toFixed(2)).toBe("246.60");
    expect(result.changes[0]).toMatchObject({ before: "234.00", after: "246.60" });

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "BOM_REPRICE" },
      orderBy: { createdAt: "desc" },
    });
    expect((audit.details as Record<string, unknown>).materialId).toBe(steel.id);
  });

  it("skips (never $0-prices) a priceFromBom variant with an empty BOM (§5)", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    const admin = await createAdminUser();
    const category = await createTestCategory();
    const product = await createTestProduct(category.id, { priceFromBom: true });
    const variant = await createTestVariant(product.id, { baseRetailPrice: "99.99" });

    const result = await repriceAll({ trigger: "MANUAL", userId: admin.id });

    expect(result.skippedEmptyBom).toMatchObject([{ variantId: variant.id }]);
    const unchanged = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(unchanged.baseRetailPrice.toFixed(2)).toBe("99.99");
  });

  it("is a no-op when bomCostingEnabled is false (§18.2.6)", async () => {
    const scenario = await createGoldenScenario();
    await prisma.siteSetting.updateMany({ data: { bomCostingEnabled: false } });

    const result = await repriceAll({ trigger: "MANUAL", userId: scenario.admin.id });

    expect(result.ran).toBe(false);
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: scenario.variant.id },
    });
    expect(variant.baseRetailPrice.toFixed(2)).toBe("0.01");
    expect(await prisma.auditLog.count({ where: { action: "BOM_REPRICE" } })).toBe(0);
  });

  it("is a no-op when there is no SiteSetting row at all (fail dormant, §14.2)", async () => {
    const admin = await createAdminUser();
    const result = await repriceAll({ trigger: "MANUAL", userId: admin.id });
    expect(result.ran).toBe(false);
  });

  it("never writes variants whose effective priceFromBom is false (§18.2.7)", async () => {
    const { admin, category, steel } = await createGoldenScenario();
    // Sibling product without priceFromBom but WITH a BOM
    const manualProduct = await createTestProduct(category.id, {
      priceFromBom: false,
    });
    const manualVariant = await createTestVariant(manualProduct.id, { baseRetailPrice: "10.00" });
    await createTestBomComponent({ productId: manualProduct.id }, steel.id, 100);

    await repriceAll({ trigger: "MANUAL", userId: admin.id });

    const unchanged = await prisma.productVariant.findUniqueOrThrow({
      where: { id: manualVariant.id },
    });
    expect(unchanged.baseRetailPrice.toFixed(2)).toBe("10.00");
  });

  it("variant-level priceFromBom=false opts out under a priceFromBom product", async () => {
    const { admin, product, variant } = await createGoldenScenario();
    const optOut = await createTestVariant(product.id, {
      baseRetailPrice: "5.00",
      priceFromBom: false,
    });

    await repriceAll({ trigger: "MANUAL", userId: admin.id });

    expect(
      (await prisma.productVariant.findUniqueOrThrow({ where: { id: optOut.id } })).baseRetailPrice.toFixed(2),
    ).toBe("5.00");
    expect(
      (await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).baseRetailPrice.toFixed(2),
    ).toBe("234.00");
  });

  it("a variant's own BOM overrides the product BOM, and reverts when removed (§18.2.9)", async () => {
    const { admin, variant, steel } = await createGoldenScenario();

    // Own BOM: 1 ft steel only → material 2.50 × 1.4 = 3.50 (labor inherits: 60 × 1.8 = 108)
    const ownLine = await createTestBomComponent({ productVariantId: variant.id }, steel.id, 1);
    await repriceAll({ trigger: "BOM_UPDATE", userId: admin.id });
    expect(
      (await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).baseRetailPrice.toFixed(2),
    ).toBe("111.50");

    // Deleting the last own line reverts to inheriting the product BOM (§16)
    await prisma.bomComponent.delete({ where: { id: ownLine.id } });
    await repriceAll({ trigger: "BOM_UPDATE", userId: admin.id });
    expect(
      (await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).baseRetailPrice.toFixed(2),
    ).toBe("234.00");
  });

  it("surfaces UNCOSTED_MATERIAL warnings for null-cost raws (§13.7)", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    const admin = await createAdminUser();
    const category = await createTestCategory();
    const tbd = await createTestMaterial({ name: "Uncosted", unitCost: null });
    const product = await createTestProduct(category.id, { priceFromBom: true });
    await createTestVariant(product.id, { baseRetailPrice: "1.00" });
    await createTestBomComponent({ productId: product.id }, tbd.id, 2);

    const result = await repriceAll({ trigger: "MANUAL", userId: admin.id });

    expect(result.warnings).toMatchObject([{ code: "UNCOSTED_MATERIAL", materialId: tbd.id }]);
  });

  it("rolls the whole run back when a write fails mid-transaction (§18.2.8)", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    const admin = await createAdminUser();
    const category = await createTestCategory();
    // Material cost fits Decimal(12,4) but the resulting price overflows the
    // variant's Decimal(10,2) — the LAST write of the run fails.
    const heavy = await createTestMaterial({ name: "Heavy", unitCost: "99999999.9999" });
    const product = await createTestProduct(category.id, { priceFromBom: true });
    const variant = await createTestVariant(product.id, { baseRetailPrice: "1.00" });
    await createTestBomComponent({ productId: product.id }, heavy.id, 1000);

    await expect(repriceAll({ trigger: "MANUAL", userId: admin.id })).rejects.toThrow();

    // The Material.computedCost write earlier in the same transaction must be
    // rolled back too — no partial reprice survives.
    const untouchedMaterial = await prisma.material.findUniqueOrThrow({ where: { id: heavy.id } });
    expect(untouchedMaterial.computedCost).toBeNull();
    const untouchedVariant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    });
    expect(untouchedVariant.baseRetailPrice.toFixed(2)).toBe("1.00");
    expect(await prisma.auditLog.count({ where: { action: "BOM_REPRICE" } })).toBe(0);
  });

  it("aborts untouched on a cyclic graph injected behind the validators", async () => {
    await createTestSiteSetting({ bomCostingEnabled: true });
    const admin = await createAdminUser();
    const subA = await createTestMaterial({ name: "Sub A", kind: "subassembly", unitCost: null });
    const subB = await createTestMaterial({ name: "Sub B", kind: "subassembly", unitCost: null });
    await createTestBomComponent({ parentMaterialId: subA.id }, subB.id, 1);
    await createTestBomComponent({ parentMaterialId: subB.id }, subA.id, 1);

    await expect(repriceAll({ trigger: "MANUAL", userId: admin.id })).rejects.toThrow(/cycle/i);
  });
});
