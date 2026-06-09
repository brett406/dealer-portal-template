import { describe, it, expect } from "vitest";
import { Decimal } from "decimal.js";
import {
  computeMaterialCosts,
  computeVariantPrice,
  resolveMargin,
  validateBomGraph,
  BomCycleError,
  BomDepthError,
  COMPUTE_MAX_DEPTH,
  type EngineMaterial,
  type VariantPriceInput,
} from "@/lib/bom/cost";

// Golden fixtures from docs/BOM-COSTING.md §17.
const steelTube: EngineMaterial = { id: "steel", kind: "raw", unitCost: "2.50" };
const paint: EngineMaterial = { id: "paint", kind: "raw", unitCost: "30.00" };
const bracket: EngineMaterial = {
  id: "bracket",
  kind: "subassembly",
  components: [{ materialId: "steel", quantity: "4" }],
  laborLines: [{ ratePerHour: "60.00", hours: "0.25" }],
};
const goldenMaterials = [steelTube, paint, bracket];

const gateInput: VariantPriceInput = {
  variantId: "gate-4ft",
  components: [
    { materialId: "steel", quantity: "10" },
    { materialId: "bracket", quantity: "2" },
    { materialId: "paint", quantity: "0.5" },
  ],
  laborLines: [{ ratePerHour: "40.00", hours: "1.5" }],
  materialMarginPercent: "40",
  laborMarginPercent: "80",
};

describe("computeMaterialCosts", () => {
  it("passes raw unitCost through unchanged", () => {
    const costs = computeMaterialCosts(goldenMaterials);
    expect(costs.get("steel")!.cost.toString()).toBe("2.5");
    expect(costs.get("steel")!.warnings).toEqual([]);
  });

  it("costs a null-unitCost raw material at 0 with an UNCOSTED_MATERIAL warning", () => {
    const costs = computeMaterialCosts([{ id: "tbd", kind: "raw", unitCost: null }]);
    expect(costs.get("tbd")!.cost.isZero()).toBe(true);
    expect(costs.get("tbd")!.warnings).toMatchObject([
      { code: "UNCOSTED_MATERIAL", materialId: "tbd" },
    ]);
  });

  it("rolls a sub-assembly up at cost with NO margin — golden Bracket = 25.00", () => {
    const costs = computeMaterialCosts(goldenMaterials);
    // 4 × 2.50 + 0.25 × 60.00 = 25.00
    expect(costs.get("bracket")!.cost.toString()).toBe("25");
  });

  it("handles 3-level nesting bottom-up", () => {
    const materials: EngineMaterial[] = [
      { id: "bolt", kind: "raw", unitCost: "0.10" },
      {
        id: "hinge",
        kind: "subassembly",
        components: [{ materialId: "bolt", quantity: "4" }], // 0.40
        laborLines: [{ ratePerHour: "50", hours: "0.1" }], // 5.00
      },
      {
        id: "door",
        kind: "subassembly",
        components: [{ materialId: "hinge", quantity: "2" }], // 10.80
        laborLines: [],
      },
    ];
    const costs = computeMaterialCosts(materials);
    expect(costs.get("hinge")!.cost.toString()).toBe("5.4");
    expect(costs.get("door")!.cost.toString()).toBe("10.8");
  });

  it("counts a shared child once per consumption path (diamond graph)", () => {
    const materials: EngineMaterial[] = [
      { id: "plate", kind: "raw", unitCost: "3.00" },
      { id: "left", kind: "subassembly", components: [{ materialId: "plate", quantity: "2" }] },
      { id: "right", kind: "subassembly", components: [{ materialId: "plate", quantity: "5" }] },
      {
        id: "top",
        kind: "subassembly",
        components: [
          { materialId: "left", quantity: "1" }, // 6
          { materialId: "right", quantity: "1" }, // 15
          { materialId: "plate", quantity: "1" }, // 3 — direct AND via both arms
        ],
      },
    ];
    const costs = computeMaterialCosts(materials);
    expect(costs.get("top")!.cost.toString()).toBe("24");
  });

  it("propagates descendant warnings to ancestors, deduped per material", () => {
    const materials: EngineMaterial[] = [
      { id: "tbd", kind: "raw", unitCost: null },
      {
        id: "sub",
        kind: "subassembly",
        components: [
          { materialId: "tbd", quantity: "1" },
          { materialId: "tbd", quantity: "3" },
        ],
      },
    ];
    const costs = computeMaterialCosts(materials);
    expect(costs.get("sub")!.warnings).toHaveLength(1);
    expect(costs.get("sub")!.warnings[0]!.materialId).toBe("tbd");
  });

  it("throws BomCycleError naming the path on a cyclic graph", () => {
    const materials: EngineMaterial[] = [
      { id: "a", kind: "subassembly", components: [{ materialId: "b", quantity: "1" }] },
      { id: "b", kind: "subassembly", components: [{ materialId: "a", quantity: "1" }] },
    ];
    expect(() => computeMaterialCosts(materials)).toThrow(BomCycleError);
    try {
      computeMaterialCosts(materials);
    } catch (e) {
      expect((e as BomCycleError).path).toEqual(["a", "b", "a"]);
      expect((e as BomCycleError).message).toContain("a → b → a");
    }
  });

  it("throws BomDepthError past the hard compute guard", () => {
    const materials: EngineMaterial[] = [{ id: "m0", kind: "raw", unitCost: "1" }];
    for (let i = 1; i <= COMPUTE_MAX_DEPTH + 1; i++) {
      materials.push({
        id: `m${i}`,
        kind: "subassembly",
        components: [{ materialId: `m${i - 1}`, quantity: "1" }],
      });
    }
    expect(() => computeMaterialCosts(materials)).toThrow(BomDepthError);
  });

  it("throws on a reference to an unknown material", () => {
    const materials: EngineMaterial[] = [
      { id: "sub", kind: "subassembly", components: [{ materialId: "ghost", quantity: "1" }] },
    ];
    expect(() => computeMaterialCosts(materials)).toThrow(/unknown material ghost/);
  });
});

describe("computeVariantPrice", () => {
  it("prices the golden Gate at 234.00 with per-element markup applied once", () => {
    const costs = computeMaterialCosts(goldenMaterials);
    const result = computeVariantPrice(gateInput, costs);
    expect(result.skip).toBe(false);
    // 10 × 2.50 + 2 × 25.00 + 0.5 × 30.00 = 90.00 (bracket rolls in at COST, as material)
    expect(result.materialCost.toString()).toBe("90");
    // 1.5 × 40.00 — the gate's own labor only; bracket welding is inside its cost
    expect(result.laborCost.toString()).toBe("60");
    expect(result.totalCost.toString()).toBe("150");
    // 90 × 1.40 + 60 × 1.80 = 126 + 108
    expect(result.price!.toString()).toBe("234");
  });

  it("treats a consumed sub-assembly as MATERIAL cost (its labor is not re-margined)", () => {
    const costs = computeMaterialCosts(goldenMaterials);
    const result = computeVariantPrice(
      {
        variantId: "v",
        components: [{ materialId: "bracket", quantity: "1" }], // cost 25, of which 15 is labor
        laborLines: [],
        materialMarginPercent: "100",
        laborMarginPercent: "0", // would change the price if bracket labor were re-classed
      },
      costs,
    );
    expect(result.price!.toString()).toBe("50"); // 25 × 2.00 — all margined as material
  });

  it("skips (never prices) a variant whose effective BOM is empty", () => {
    const result = computeVariantPrice(
      {
        variantId: "v",
        components: [],
        laborLines: [],
        materialMarginPercent: "40",
        laborMarginPercent: "80",
      },
      new Map(),
    );
    expect(result.skip).toBe(true);
    expect(result.price).toBeNull();
  });

  it("prices a labor-only BOM (components empty, labor present) — not a skip", () => {
    const result = computeVariantPrice(
      {
        variantId: "v",
        components: [],
        laborLines: [{ ratePerHour: "40", hours: "2" }],
        materialMarginPercent: "40",
        laborMarginPercent: "50",
      },
      new Map(),
    );
    expect(result.skip).toBe(false);
    expect(result.price!.toString()).toBe("120"); // 80 × 1.5
  });

  it("rounds half-up at the final price only — 3 × 0.3333 at 0% → 1.00", () => {
    const costs = computeMaterialCosts([{ id: "m", kind: "raw", unitCost: "0.3333" }]);
    const result = computeVariantPrice(
      {
        variantId: "v",
        components: [{ materialId: "m", quantity: "3" }],
        laborLines: [],
        materialMarginPercent: "0",
        laborMarginPercent: "0",
      },
      costs,
    );
    expect(result.materialCost.toString()).toBe("0.9999"); // intermediate NOT rounded
    expect(result.price!.toString()).toBe("1"); // 2dp half-up at the end
  });

  it("is exact on decimal inputs floats can't represent (0.1 + 0.2 class)", () => {
    const costs = computeMaterialCosts([
      { id: "a", kind: "raw", unitCost: "0.1" },
      { id: "b", kind: "raw", unitCost: "0.2" },
    ]);
    const result = computeVariantPrice(
      {
        variantId: "v",
        components: [
          { materialId: "a", quantity: "1" },
          { materialId: "b", quantity: "1" },
        ],
        laborLines: [],
        materialMarginPercent: "0",
        laborMarginPercent: "0",
      },
      costs,
    );
    expect(result.materialCost.toString()).toBe("0.3"); // not 0.30000000000000004
  });

  it("rounds a half-cent up (2.345 → 2.35)", () => {
    const costs = computeMaterialCosts([{ id: "m", kind: "raw", unitCost: "2.345" }]);
    const result = computeVariantPrice(
      {
        variantId: "v",
        components: [{ materialId: "m", quantity: "1" }],
        laborLines: [],
        materialMarginPercent: "0",
        laborMarginPercent: "0",
      },
      costs,
    );
    expect(result.price!.toString()).toBe("2.35");
  });

  it("surfaces UNCOSTED_MATERIAL warnings reached through the BOM", () => {
    const costs = computeMaterialCosts([
      { id: "tbd", kind: "raw", unitCost: null },
      { id: "sub", kind: "subassembly", components: [{ materialId: "tbd", quantity: "1" }] },
    ]);
    const result = computeVariantPrice(
      {
        variantId: "v",
        components: [{ materialId: "sub", quantity: "2" }],
        laborLines: [],
        materialMarginPercent: "0",
        laborMarginPercent: "0",
      },
      costs,
    );
    expect(result.warnings).toMatchObject([{ code: "UNCOSTED_MATERIAL", materialId: "tbd" }]);
  });
});

describe("resolveMargin", () => {
  it("resolves variant → product → site default, field by field", () => {
    expect(resolveMargin("10", "20", "30").toString()).toBe("10");
    expect(resolveMargin(null, "20", "30").toString()).toBe("20");
    expect(resolveMargin(undefined, null, "30").toString()).toBe("30");
    expect(resolveMargin(0, "20", "30").toString()).toBe("0"); // 0 is a real override
  });

  it("accepts Decimal inputs (as loaded from Prisma via toString)", () => {
    expect(resolveMargin(new Decimal("12.5"), null, 0).toString()).toBe("12.5");
  });
});

describe("validateBomGraph (save-time check)", () => {
  it("reports no cycle and correct depth on the golden graph", () => {
    const check = validateBomGraph(goldenMaterials);
    expect(check.cycle).toBeNull();
    expect(check.maxDepth).toBe(2); // bracket → steel
  });

  it("reports a cycle without throwing", () => {
    const check = validateBomGraph([
      { id: "a", kind: "subassembly", components: [{ materialId: "b", quantity: "1" }] },
      { id: "b", kind: "subassembly", components: [{ materialId: "a", quantity: "1" }] },
    ]);
    expect(check.cycle).toEqual(["a", "b", "a"]);
  });

  it("reports a degenerate self-reference", () => {
    const check = validateBomGraph([
      { id: "a", kind: "subassembly", components: [{ materialId: "a", quantity: "1" }] },
    ]);
    expect(check.cycle).toEqual(["a", "a"]);
  });

  it("measures chain depth (raw = 1)", () => {
    const materials: EngineMaterial[] = [{ id: "m0", kind: "raw", unitCost: "1" }];
    for (let i = 1; i <= 4; i++) {
      materials.push({
        id: `m${i}`,
        kind: "subassembly",
        components: [{ materialId: `m${i - 1}`, quantity: "1" }],
      });
    }
    expect(validateBomGraph(materials).maxDepth).toBe(5);
  });
});
