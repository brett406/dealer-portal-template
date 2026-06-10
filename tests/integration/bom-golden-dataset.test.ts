/**
 * Golden-dataset pricing audit (docs/BOM-COSTING.md §17/§18).
 *
 * Builds the same realistic fabrication catalog as prisma/seed.ts and asserts
 * HAND-CALCULATED literal prices — every expected value below was computed on
 * paper from the quantities and costs, not derived from engine output. If the
 * engine's math drifts in any way (rollup, margin resolution, override rules,
 * rounding), this fails. If you change the dataset in prisma/seed.ts, update
 * the literals here in lockstep (and in scripts/verify-bom-pricing.mjs docs).
 */
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

async function createAdmin() {
  return prisma.user.create({
    data: {
      email: `golden-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: "$2a$10$fakehashplaceholder",
      name: "Golden Admin",
      role: "SUPER_ADMIN",
    },
  });
}

/** The seed's fabrication catalog, built through the test factories. */
async function createFabricationCatalog() {
  // Site defaults 38% / 70% — Steel Work Bench relies on them.
  await createTestSiteSetting({
    bomCostingEnabled: true,
    defaultMaterialMarginPercent: 38,
    defaultLaborMarginPercent: 70,
  });
  const admin = await createAdmin();
  const category = await createTestCategory();

  const welder = await createTestLaborRate({ name: "Welder", ratePerHour: "58.00" });
  const assembler = await createTestLaborRate({ name: "Assembler", ratePerHour: "42.00" });
  const painter = await createTestLaborRate({ name: "Painter", ratePerHour: "45.00" });

  const steelTube = await createTestMaterial({ name: "Steel tube", unit: "ft", unitCost: "4.85" });
  const flatBar = await createTestMaterial({ name: "Flat bar", unit: "ft", unitCost: "3.10" });
  const hdHinge = await createTestMaterial({ name: "HD hinge", unitCost: "14.50" });
  const latchKit = await createTestMaterial({ name: "Latch kit", unitCost: "22.75" });
  const powderCoat = await createTestMaterial({ name: "Powder coat", unit: "lb", unitCost: "6.40" });
  const meshPanel = await createTestMaterial({ name: "Mesh panel", unitCost: "38.00" });
  const steelAngle = await createTestMaterial({ name: "Steel angle", unit: "ft", unitCost: "3.75" });
  const lumber = await createTestMaterial({ name: "Lumber 2x6", unit: "ft", unitCost: "5.25" });
  const hardwareKit = await createTestMaterial({ name: "Hardware kit", unitCost: "9.95" });

  // S1 hinge plate: 0.8×3.10 + 14.50 + 0.2×58 = 2.48 + 14.50 + 11.60 = 28.58
  const hingePlate = await createTestMaterial({ name: "Hinge plate", kind: "subassembly", unitCost: null });
  await createTestBomComponent({ parentMaterialId: hingePlate.id }, flatBar.id, 0.8);
  await createTestBomComponent({ parentMaterialId: hingePlate.id }, hdHinge.id, 1);
  await createTestBomLaborLine({ parentMaterialId: hingePlate.id }, welder.id, 0.2);

  // S2 frame section: 12×4.85 + 0.5×58 = 58.20 + 29.00 = 87.20
  const frameSection = await createTestMaterial({ name: "Frame section", kind: "subassembly", unitCost: null });
  await createTestBomComponent({ parentMaterialId: frameSection.id }, steelTube.id, 12);
  await createTestBomLaborLine({ parentMaterialId: frameSection.id }, welder.id, 0.5);

  // S3 gate frame (nested + diamond): 2×87.20 + 2×28.58 + 3×4.85 + 1×58 = 304.11
  const gateFrame = await createTestMaterial({ name: "Gate frame", kind: "subassembly", unitCost: null });
  await createTestBomComponent({ parentMaterialId: gateFrame.id }, frameSection.id, 2);
  await createTestBomComponent({ parentMaterialId: gateFrame.id }, hingePlate.id, 2);
  await createTestBomComponent({ parentMaterialId: gateFrame.id }, steelTube.id, 3);
  await createTestBomLaborLine({ parentMaterialId: gateFrame.id }, welder.id, 1);

  // P1 Farm Gate — margins 45 / 85
  const farmGate = await createTestProduct(category.id, {
    priceFromBom: true,
    materialMarginPercent: "45",
    laborMarginPercent: "85",
  });
  const gate10 = await createTestVariant(farmGate.id, { baseRetailPrice: "0.01" });
  const gate8 = await createTestVariant(farmGate.id, { baseRetailPrice: "0.01" });
  const gate12 = await createTestVariant(farmGate.id, {
    baseRetailPrice: "0.01",
    laborMarginPercent: "90",
  });
  await createTestBomComponent({ productId: farmGate.id }, gateFrame.id, 1);
  await createTestBomComponent({ productId: farmGate.id }, meshPanel.id, 1);
  await createTestBomComponent({ productId: farmGate.id }, latchKit.id, 1);
  await createTestBomComponent({ productId: farmGate.id }, powderCoat.id, 6);
  await createTestBomLaborLine({ productId: farmGate.id }, assembler.id, 2);
  await createTestBomLaborLine({ productId: farmGate.id }, painter.id, 0.75);
  // 8 ft: component-only override
  await createTestBomComponent({ productVariantId: gate8.id }, gateFrame.id, 1);
  await createTestBomComponent({ productVariantId: gate8.id }, latchKit.id, 1);
  await createTestBomComponent({ productVariantId: gate8.id }, powderCoat.id, 5);
  // 12 ft: labor-only override
  await createTestBomLaborLine({ productVariantId: gate12.id }, assembler.id, 2.5);
  await createTestBomLaborLine({ productVariantId: gate12.id }, painter.id, 1);

  // P2 Work Bench — no product margins → site defaults
  const workBench = await createTestProduct(category.id, { priceFromBom: true });
  const benchStd = await createTestVariant(workBench.id, { baseRetailPrice: "0.01" });
  const benchWide = await createTestVariant(workBench.id, {
    baseRetailPrice: "0.01",
    materialMarginPercent: "55",
  });
  await createTestBomComponent({ productId: workBench.id }, steelAngle.id, 20);
  await createTestBomComponent({ productId: workBench.id }, lumber.id, 8);
  await createTestBomComponent({ productId: workBench.id }, hardwareKit.id, 1);
  await createTestBomLaborLine({ productId: workBench.id }, assembler.id, 1.5);
  await createTestBomComponent({ productVariantId: benchWide.id }, steelAngle.id, 26);
  await createTestBomComponent({ productVariantId: benchWide.id }, lumber.id, 12);
  await createTestBomComponent({ productVariantId: benchWide.id }, hardwareKit.id, 1);

  return {
    admin,
    steelTube,
    hingePlate,
    frameSection,
    gateFrame,
    gate10,
    gate8,
    gate12,
    benchStd,
    benchWide,
  };
}

async function expectVariant(id: string, price: string, cost: string) {
  const v = await prisma.productVariant.findUniqueOrThrow({ where: { id } });
  expect(v.baseRetailPrice.toFixed(2)).toBe(price);
  expect(v.computedCost!.toFixed(4)).toBe(cost);
}

async function expectSubCost(id: string, cost: string) {
  const m = await prisma.material.findUniqueOrThrow({ where: { id } });
  expect(m.computedCost!.toFixed(4)).toBe(cost);
}

describe("golden fabrication dataset (hand-calculated literals)", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
  });

  it("prices the whole catalog to the paper-calculated values", async () => {
    const f = await createFabricationCatalog();
    const result = await repriceAll({ trigger: "TOGGLE", userId: f.admin.id });

    expect(result.ran).toBe(true);
    expect(result.changes).toHaveLength(5);
    expect(result.warnings).toHaveLength(0);
    expect(result.skippedEmptyBom).toHaveLength(0);

    // Sub-assemblies roll up at cost
    await expectSubCost(f.hingePlate.id, "28.5800"); // 2.48 + 14.50 + 11.60
    await expectSubCost(f.frameSection.id, "87.2000"); // 58.20 + 29.00
    await expectSubCost(f.gateFrame.id, "304.1100"); // 174.40 + 57.16 + 14.55 + 58.00

    // Farm Gate (45/85):
    // product BOM: materials 403.26 (304.11+38+22.75+38.40), labor 117.75 (84+33.75)
    await expectVariant(f.gate10.id, "802.56", "521.0100"); // 584.727 + 217.8375 = 802.5645
    // 8 ft: own components 358.86 (304.11+22.75+32.00), labor inherited
    await expectVariant(f.gate8.id, "738.18", "476.6100"); // 520.347 + 217.8375 = 738.1845
    // 12 ft: components inherited 403.26, own labor 150.00, own labor margin 90
    await expectVariant(f.gate12.id, "869.73", "553.2600"); // 584.727 + 285.00 = 869.727

    // Work Bench (site defaults 38/70):
    // product BOM: materials 126.95 (75+42+9.95), labor 63.00
    await expectVariant(f.benchStd.id, "282.29", "189.9500"); // 175.191 + 107.10 = 282.291
    // Wide: own components 170.45 (97.50+63+9.95), own material margin 55, labor → default
    await expectVariant(f.benchWide.id, "371.30", "233.4500"); // 264.1975 + 107.10 = 371.2975
  });

  it("ripples a steel-cost change through nesting, diamonds, and overrides — then back", async () => {
    const f = await createFabricationCatalog();
    await repriceAll({ trigger: "TOGGLE", userId: f.admin.id });

    // Steel $4.85 → $5.10 (+0.25/ft)
    await prisma.material.update({ where: { id: f.steelTube.id }, data: { unitCost: "5.10" } });
    const ripple = await repriceAll({
      trigger: "MATERIAL_COST_UPDATE",
      userId: f.admin.id,
      materialId: f.steelTube.id,
    });

    // Only the 3 gate variants use steel (directly or via sub-assemblies)
    expect(ripple.changes).toHaveLength(3);

    await expectSubCost(f.frameSection.id, "90.2000"); // 12×5.10 + 29
    await expectSubCost(f.hingePlate.id, "28.5800"); // no steel — unchanged
    await expectSubCost(f.gateFrame.id, "310.8600"); // 180.40 + 57.16 + 15.30 + 58

    // gate product materials: 310.86+38+22.75+38.40 = 410.01
    await expectVariant(f.gate10.id, "812.35", "527.7600"); // 594.5145 + 217.8375 = 812.352
    // 8 ft: 310.86+22.75+32 = 365.61 → 530.1345 + 217.8375 = 747.972
    await expectVariant(f.gate8.id, "747.97", "483.3600");
    // 12 ft: 594.5145 + 285 = 879.5145
    await expectVariant(f.gate12.id, "879.51", "560.0100");
    // bench has no steel tube anywhere — untouched
    await expectVariant(f.benchStd.id, "282.29", "189.9500");
    await expectVariant(f.benchWide.id, "371.30", "233.4500");

    // Revert — original prices must return exactly (deterministic round-trip)
    await prisma.material.update({ where: { id: f.steelTube.id }, data: { unitCost: "4.85" } });
    await repriceAll({
      trigger: "MATERIAL_COST_UPDATE",
      userId: f.admin.id,
      materialId: f.steelTube.id,
    });
    await expectVariant(f.gate10.id, "802.56", "521.0100");
    await expectVariant(f.gate8.id, "738.18", "476.6100");
    await expectVariant(f.gate12.id, "869.73", "553.2600");
  });

  it("is idempotent over the full catalog — a second run writes nothing", async () => {
    const f = await createFabricationCatalog();
    await repriceAll({ trigger: "TOGGLE", userId: f.admin.id });
    const second = await repriceAll({ trigger: "MANUAL", userId: f.admin.id });
    expect(second.changes).toHaveLength(0);
  });
});
