/**
 * BOM cost engine — pure, deterministic math (docs/BOM-COSTING.md §4, §13.10).
 *
 * FROZEN CORE FILE (core-files.json): byte-identical across template + forks.
 * Change it in the template and sync; never edit in a fork.
 *
 * No Prisma/Next imports and no I/O: callers (lib/bom/load.ts, reprice.ts)
 * resolve the effective BOM (§4.1) and margins, then hand plain inputs here.
 * All arithmetic is decimal.js — float math would drift on money values.
 *
 * Invariants this file owns:
 * - Sub-assemblies roll up AT COST: no margin anywhere below the finished good.
 * - A consumed sub-assembly's rolled cost is MATERIAL cost at its parent.
 * - Markup is applied once, per cost element, at the finished good:
 *     price = materialCost × (1 + m%) + laborCost × (1 + l%)
 * - Intermediate values are never rounded; the final price alone is rounded
 *   to 2dp, half-up.
 */

import { Decimal } from "decimal.js";

// 12,4-scale operands can need > 20 significant digits when multiplied; the
// default decimal.js precision (20) could silently round mid-tree.
const D = Decimal.clone({ precision: 50 });

export type NumericInput = string | number | Decimal;

export type EngineMaterialKind = "raw" | "subassembly";

export interface EngineComponentLine {
  materialId: string;
  quantity: NumericInput; // per ONE unit of the parent; > 0
}

export interface EngineLaborLine {
  ratePerHour: NumericInput;
  hours: NumericInput; // per ONE unit of the parent; > 0
}

export interface EngineMaterial {
  id: string;
  kind: EngineMaterialKind;
  /** raw only — null/undefined costs 0 and emits UNCOSTED_MATERIAL (§13.7). */
  unitCost?: NumericInput | null;
  /** subassembly only — its own BOM. */
  components?: EngineComponentLine[];
  /** subassembly only — its own labor. */
  laborLines?: EngineLaborLine[];
}

export interface CostWarning {
  code: "UNCOSTED_MATERIAL";
  materialId: string;
  message: string;
}

/** Save-time chain limit (§13.4) — enforced by validateBomGraph callers. */
export const SAVE_MAX_DEPTH = 10;
/** Hard compute guard (§13.4) — corrupt data must throw, never hang. */
export const COMPUTE_MAX_DEPTH = 25;

export class BomCycleError extends Error {
  readonly path: string[];
  constructor(path: string[]) {
    super(`BOM cycle detected: ${path.join(" → ")}`);
    this.name = "BomCycleError";
    this.path = path;
  }
}

export class BomDepthError extends Error {
  readonly materialId: string;
  readonly depth: number;
  constructor(materialId: string, depth: number) {
    super(
      `BOM depth ${depth} exceeds the maximum of ${COMPUTE_MAX_DEPTH} at material ${materialId}`,
    );
    this.name = "BomDepthError";
    this.materialId = materialId;
    this.depth = depth;
  }
}

export interface MaterialCostEntry {
  /** Full-precision unit cost (no margin). Mirrors unitCost for raw. */
  cost: Decimal;
  /** Own + descendant warnings, deduped by materialId. */
  warnings: CostWarning[];
  /** Chain depth below (and including) this material: raw = 1. */
  depth: number;
}

/**
 * Bottom-up unit cost for every material (§4.2). Memoized DFS — equivalent to
 * the low-level-code topological order: every child is costed before any
 * parent reads it. Throws BomCycleError / BomDepthError on bad graphs.
 *
 * The depth guard is on each material's CHAIN depth (computed from its
 * children's depths), not on recursion depth — memoization means a parent may
 * never recurse at all when its children were costed first, so recursion
 * depth alone would miss over-deep graphs reached bottom-up.
 */
export function computeMaterialCosts(
  materials: EngineMaterial[],
): Map<string, MaterialCostEntry> {
  const byId = new Map(materials.map((m) => [m.id, m]));
  const done = new Map<string, MaterialCostEntry>();
  const visiting: string[] = []; // current DFS stack, for cycle reporting

  function cost(id: string): MaterialCostEntry {
    const memo = done.get(id);
    if (memo) return memo;

    if (visiting.includes(id)) {
      throw new BomCycleError([...visiting.slice(visiting.indexOf(id)), id]);
    }
    // Recursion-depth backstop: a top-down walk of an over-deep graph throws
    // here before it can exhaust the stack (cycles are caught above).
    if (visiting.length >= COMPUTE_MAX_DEPTH) throw new BomDepthError(id, visiting.length + 1);

    const material = byId.get(id);
    if (!material) {
      // FK integrity makes this unreachable from DB-loaded input; guard anyway.
      throw new Error(`BOM references unknown material ${id}`);
    }

    let entry: MaterialCostEntry;
    if (material.kind === "raw") {
      if (material.unitCost === null || material.unitCost === undefined) {
        entry = {
          cost: new D(0),
          warnings: [
            {
              code: "UNCOSTED_MATERIAL",
              materialId: id,
              message: `Raw material ${id} has no unit cost; it contributes $0`,
            },
          ],
          depth: 1,
        };
      } else {
        entry = { cost: new D(material.unitCost), warnings: [], depth: 1 };
      }
    } else {
      visiting.push(id);
      let total = new D(0);
      let deepestChild = 0;
      const warnings = new Map<string, CostWarning>();
      for (const line of material.components ?? []) {
        const child = cost(line.materialId);
        total = total.plus(child.cost.times(new D(line.quantity)));
        deepestChild = Math.max(deepestChild, child.depth);
        for (const w of child.warnings) warnings.set(w.materialId, w);
      }
      for (const labor of material.laborLines ?? []) {
        total = total.plus(new D(labor.hours).times(new D(labor.ratePerHour)));
      }
      visiting.pop();
      const depth = deepestChild + 1;
      if (depth > COMPUTE_MAX_DEPTH) throw new BomDepthError(id, depth);
      entry = { cost: total, warnings: [...warnings.values()], depth };
    }

    done.set(id, entry);
    return entry;
  }

  for (const m of materials) cost(m.id);
  return done;
}

export interface VariantPriceInput {
  variantId: string;
  /** Effective components — §4.1 product-vs-variant resolution happens in the loader. */
  components: EngineComponentLine[];
  /** Effective labor — resolved independently of components. */
  laborLines: EngineLaborLine[];
  /** Resolved markup-on-cost percentages (variant → product → site default). */
  materialMarginPercent: NumericInput;
  laborMarginPercent: NumericInput;
}

export interface VariantPriceResult {
  variantId: string;
  /** True when the effective BOM is empty (§5 guardrail) — caller must NOT write a price. */
  skip: boolean;
  materialCost: Decimal;
  laborCost: Decimal;
  /** materialCost + laborCost, full precision — the variant's computedCost. */
  totalCost: Decimal;
  /** Final sell price, 2dp half-up. Null when skip. */
  price: Decimal | null;
  warnings: CostWarning[];
}

/**
 * Cost + price of one variant (§4.3). A consumed sub-assembly's rolled cost
 * lands in materialCost; its internal labor is not re-margined here.
 */
export function computeVariantPrice(
  input: VariantPriceInput,
  materialCosts: Map<string, MaterialCostEntry>,
): VariantPriceResult {
  if (input.components.length === 0 && input.laborLines.length === 0) {
    const zero = new D(0);
    return {
      variantId: input.variantId,
      skip: true,
      materialCost: zero,
      laborCost: zero,
      totalCost: zero,
      price: null,
      warnings: [],
    };
  }

  let materialCost = new D(0);
  const warnings = new Map<string, CostWarning>();
  for (const line of input.components) {
    const entry = materialCosts.get(line.materialId);
    if (!entry) throw new Error(`BOM references unknown material ${line.materialId}`);
    materialCost = materialCost.plus(entry.cost.times(new D(line.quantity)));
    for (const w of entry.warnings) warnings.set(w.materialId, w);
  }

  let laborCost = new D(0);
  for (const labor of input.laborLines) {
    laborCost = laborCost.plus(new D(labor.hours).times(new D(labor.ratePerHour)));
  }

  const price = materialCost
    .times(new D(1).plus(new D(input.materialMarginPercent).div(100)))
    .plus(laborCost.times(new D(1).plus(new D(input.laborMarginPercent).div(100))))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    variantId: input.variantId,
    skip: false,
    materialCost,
    laborCost,
    totalCost: materialCost.plus(laborCost),
    price,
    warnings: [...warnings.values()],
  };
}

/**
 * Field-by-field margin resolution (§4.1): variant → product → site default.
 */
export function resolveMargin(
  variant: NumericInput | null | undefined,
  product: NumericInput | null | undefined,
  siteDefault: NumericInput,
): Decimal {
  if (variant !== null && variant !== undefined) return new D(variant);
  if (product !== null && product !== undefined) return new D(product);
  return new D(siteDefault);
}

export interface BomGraphCheck {
  /** Cycle path (`A → B → A`) if one exists, else null. */
  cycle: string[] | null;
  /** Deepest material chain (raw = 1, subassembly = 1 + deepest child). */
  maxDepth: number;
}

/**
 * Save-time validation (§4.5, §13.4). Callers pass the would-be graph
 * (current materials with the proposed edge already included) and reject the
 * save when `cycle` is set or `maxDepth` exceeds SAVE_MAX_DEPTH. Unlike
 * computeMaterialCosts this never throws on a cycle — it reports it.
 */
export function validateBomGraph(materials: EngineMaterial[]): BomGraphCheck {
  const byId = new Map(materials.map((m) => [m.id, m]));
  const depths = new Map<string, number>();
  const visiting: string[] = [];
  let cycle: string[] | null = null;

  function depth(id: string): number {
    const memo = depths.get(id);
    if (memo !== undefined) return memo;
    if (cycle) return 0; // already failed; unwind without more work
    if (visiting.includes(id)) {
      cycle = [...visiting.slice(visiting.indexOf(id)), id];
      return 0;
    }
    const material = byId.get(id);
    if (!material || material.kind === "raw") {
      depths.set(id, 1);
      return 1;
    }
    visiting.push(id);
    let deepest = 0;
    for (const line of material.components ?? []) {
      deepest = Math.max(deepest, depth(line.materialId));
    }
    visiting.pop();
    const d = deepest + 1;
    depths.set(id, d);
    return d;
  }

  let maxDepth = 0;
  for (const m of materials) maxDepth = Math.max(maxDepth, depth(m.id));
  return { cycle, maxDepth };
}
