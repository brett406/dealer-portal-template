/**
 * BOM data for the product edit page (docs/BOM-COSTING.md §7) — server-only.
 *
 * Loads the full material graph plus one product's (and its variants') BOM
 * lines, runs the frozen engine (lib/bom/cost.ts) at render time, and returns
 * plain serializable values for the client components. Returns null when
 * SiteSetting.bomCostingEnabled is off or the row is missing — the module
 * must fail dormant (§6, §14.2).
 */

import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/cms";
import {
  computeMaterialCosts,
  computeVariantPrice,
  resolveMargin,
  type EngineComponentLine,
  type EngineLaborLine,
  type EngineMaterial,
  type MaterialCostEntry,
} from "@/lib/bom/cost";

// Type aliases (not interfaces) so they satisfy Table's Record<string, unknown> bound.
export type BomLineView = {
  id: string;
  materialId: string;
  name: string;
  sku: string | null;
  kind: "raw" | "subassembly";
  unit: string;
  quantity: number;
  notes: string | null;
  archived: boolean;
  /** Raw material with no unitCost — costs 0 with a warning (§13.7). */
  uncosted: boolean;
  /** Rolled unit cost (4dp) — null when the graph failed to compute. */
  unitCost: number | null;
};

export type BomLaborView = {
  id: string;
  laborRateId: string;
  name: string;
  ratePerHour: number;
  hours: number;
  notes: string | null;
  archived: boolean;
};

export interface BomBreakdownView {
  /** Effective BOM is empty — price is NOT auto-computed (§5 guardrail). */
  empty: boolean;
  materialCost: string; // 4dp
  laborCost: string; // 4dp
  totalCost: string; // 4dp
  materialMarkupPercent: number;
  laborMarkupPercent: number;
  materialMarkupAmount: string; // 2dp
  laborMarkupAmount: string; // 2dp
  price: number | null; // 2dp, null when empty
  impliedGrossMarginPercent: number | null; // (price − cost) / price × 100
  warnings: string[];
}

export interface VariantBomView {
  id: string;
  name: string;
  sku: string;
  priceFromBom: boolean | null; // null = inherit product (§6)
  materialMarkup: number | null;
  laborMarkup: number | null;
  /** What a null override resolves to (product → site default) — for placeholders. */
  inheritedMaterialMarkup: number;
  inheritedLaborMarkup: number;
  effectivePriceFromBom: boolean;
  ownComponents: BomLineView[];
  ownLabor: BomLaborView[];
  /** True when the variant has no own component lines and uses the product's (§4.1). */
  inheritsComponents: boolean;
  inheritsLabor: boolean;
  breakdown: BomBreakdownView | null; // null when the graph failed to compute
  currentPrice: number;
  computedCost: number | null;
}

export interface BomSectionData {
  defaults: { materialMarkup: number; laborMarkup: number };
  product: {
    priceFromBom: boolean;
    materialMarkup: number | null;
    laborMarkup: number | null;
    components: BomLineView[];
    labor: BomLaborView[];
    breakdown: BomBreakdownView | null;
  };
  /** Set when computeMaterialCosts threw (corrupt graph) — UI shows it instead of crashing. */
  computeError: string | null;
  /** Non-archived materials for the add-component picker (§13.2). */
  materialOptions: Array<{
    id: string;
    name: string;
    sku: string | null;
    kind: "raw" | "subassembly";
    unit: string;
    cost: number | null;
  }>;
  /** Non-archived labor rates for the add-labor picker (§13.2). */
  laborOptions: Array<{ id: string; name: string; ratePerHour: number }>;
  variants: VariantBomView[];
}

const componentInclude = {
  material: {
    select: { id: true, name: true, sku: true, kind: true, unit: true, unitCost: true, archivedAt: true },
  },
} as const;

const laborInclude = {
  laborRate: { select: { id: true, name: true, ratePerHour: true, archivedAt: true } },
} as const;

type ComponentRow = {
  id: string;
  quantity: { toString(): string };
  notes: string | null;
  material: {
    id: string;
    name: string;
    sku: string | null;
    kind: "raw" | "subassembly";
    unit: string;
    unitCost: { toString(): string } | null;
    archivedAt: Date | null;
  };
};

type LaborRow = {
  id: string;
  hours: { toString(): string };
  notes: string | null;
  laborRate: {
    id: string;
    name: string;
    ratePerHour: { toString(): string };
    archivedAt: Date | null;
  };
};

function toLineViews(
  rows: ComponentRow[],
  costs: Map<string, MaterialCostEntry> | null,
): BomLineView[] {
  return rows.map((r) => ({
    id: r.id,
    materialId: r.material.id,
    name: r.material.name,
    sku: r.material.sku,
    kind: r.material.kind,
    unit: r.material.unit,
    quantity: Number(r.quantity),
    notes: r.notes,
    archived: r.material.archivedAt !== null,
    uncosted: r.material.kind === "raw" && r.material.unitCost === null,
    unitCost: costs?.get(r.material.id) ? Number(costs.get(r.material.id)!.cost.toFixed(4)) : null,
  }));
}

function toLaborViews(rows: LaborRow[]): BomLaborView[] {
  return rows.map((r) => ({
    id: r.id,
    laborRateId: r.laborRate.id,
    name: r.laborRate.name,
    ratePerHour: Number(r.laborRate.ratePerHour),
    hours: Number(r.hours),
    notes: r.notes,
    archived: r.laborRate.archivedAt !== null,
  }));
}

function toEngineComponents(rows: ComponentRow[]): EngineComponentLine[] {
  return rows.map((r) => ({ materialId: r.material.id, quantity: r.quantity.toString() }));
}

function toEngineLabor(rows: LaborRow[]): EngineLaborLine[] {
  return rows.map((r) => ({
    hours: r.hours.toString(),
    ratePerHour: r.laborRate.ratePerHour.toString(),
  }));
}

function buildBreakdown(
  components: EngineComponentLine[],
  laborLines: EngineLaborLine[],
  materialMarkupPercent: number,
  laborMarkupPercent: number,
  costs: Map<string, MaterialCostEntry> | null,
  materialNames: Map<string, string>,
): BomBreakdownView | null {
  if (!costs) return null;

  const result = computeVariantPrice(
    {
      variantId: "preview",
      components,
      laborLines,
      materialMarginPercent: materialMarkupPercent,
      laborMarginPercent: laborMarkupPercent,
    },
    costs,
  );

  const warnings = result.warnings.map((w) => {
    const name = materialNames.get(w.materialId) ?? w.materialId;
    return `Material "${name}" has no unit cost — it contributes $0 to this BOM`;
  });

  if (result.skip) {
    return {
      empty: true,
      materialCost: "0.0000",
      laborCost: "0.0000",
      totalCost: "0.0000",
      materialMarkupPercent,
      laborMarkupPercent,
      materialMarkupAmount: "0.00",
      laborMarkupAmount: "0.00",
      price: null,
      impliedGrossMarginPercent: null,
      warnings,
    };
  }

  const materialMarkupAmount = result.materialCost.times(materialMarkupPercent).div(100);
  const laborMarkupAmount = result.laborCost.times(laborMarkupPercent).div(100);
  const price = result.price!;
  const impliedGrossMargin = price.isZero()
    ? null
    : Number(price.minus(result.totalCost).div(price).times(100).toFixed(1));

  return {
    empty: false,
    materialCost: result.materialCost.toFixed(4),
    laborCost: result.laborCost.toFixed(4),
    totalCost: result.totalCost.toFixed(4),
    materialMarkupPercent,
    laborMarkupPercent,
    materialMarkupAmount: materialMarkupAmount.toFixed(2),
    laborMarkupAmount: laborMarkupAmount.toFixed(2),
    price: Number(price.toFixed(2)),
    impliedGrossMarginPercent: impliedGrossMargin,
    warnings,
  };
}

/**
 * Everything the product page's BOM UI needs, or null when the module is off
 * (missing SiteSetting row = off).
 */
export async function getProductBomData(productId: string): Promise<BomSectionData | null> {
  const settings = await getSiteSettings();
  if (!settings?.bomCostingEnabled) return null;

  const [materialRows, laborRates, product] = await Promise.all([
    prisma.material.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        kind: true,
        unit: true,
        unitCost: true,
        archivedAt: true,
        components: { select: { materialId: true, quantity: true } },
        laborLines: { select: { hours: true, laborRate: { select: { ratePerHour: true } } } },
      },
    }),
    prisma.laborRate.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, ratePerHour: true },
    }),
    prisma.product.findUnique({
      where: { id: productId },
      select: {
        priceFromBom: true,
        materialMarginPercent: true,
        laborMarginPercent: true,
        bomComponents: { orderBy: { createdAt: "asc" }, include: componentInclude },
        bomLaborLines: { orderBy: { createdAt: "asc" }, include: laborInclude },
        variants: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            sku: true,
            baseRetailPrice: true,
            computedCost: true,
            priceFromBom: true,
            materialMarginPercent: true,
            laborMarginPercent: true,
            bomComponents: { orderBy: { createdAt: "asc" }, include: componentInclude },
            bomLaborLines: { orderBy: { createdAt: "asc" }, include: laborInclude },
          },
        },
      },
    }),
  ]);

  if (!product) return null;

  const engineMaterials: EngineMaterial[] = materialRows.map((m) => ({
    id: m.id,
    kind: m.kind,
    unitCost: m.unitCost === null ? null : m.unitCost.toString(),
    components: m.components.map((c) => ({
      materialId: c.materialId,
      quantity: c.quantity.toString(),
    })),
    laborLines: m.laborLines.map((l) => ({
      hours: l.hours.toString(),
      ratePerHour: l.laborRate.ratePerHour.toString(),
    })),
  }));

  let materialCosts: Map<string, MaterialCostEntry> | null = null;
  let computeError: string | null = null;
  try {
    materialCosts = computeMaterialCosts(engineMaterials);
  } catch (err) {
    computeError = err instanceof Error ? err.message : "BOM cost computation failed";
  }

  const materialNames = new Map(materialRows.map((m) => [m.id, m.name]));

  const siteMaterialDefault = settings.defaultMaterialMarginPercent.toString();
  const siteLaborDefault = settings.defaultLaborMarginPercent.toString();

  const productMaterialMarkup = Number(
    resolveMargin(null, product.materialMarginPercent?.toString(), siteMaterialDefault),
  );
  const productLaborMarkup = Number(
    resolveMargin(null, product.laborMarginPercent?.toString(), siteLaborDefault),
  );

  const productComponents = toEngineComponents(product.bomComponents);
  const productLabor = toEngineLabor(product.bomLaborLines);

  const variants: VariantBomView[] = product.variants.map((v) => {
    const ownComponents = toEngineComponents(v.bomComponents);
    const ownLabor = toEngineLabor(v.bomLaborLines);
    const effectiveComponents = ownComponents.length > 0 ? ownComponents : productComponents;
    const effectiveLabor = ownLabor.length > 0 ? ownLabor : productLabor;
    const materialMarkup = Number(
      resolveMargin(
        v.materialMarginPercent?.toString(),
        product.materialMarginPercent?.toString(),
        siteMaterialDefault,
      ),
    );
    const laborMarkup = Number(
      resolveMargin(
        v.laborMarginPercent?.toString(),
        product.laborMarginPercent?.toString(),
        siteLaborDefault,
      ),
    );

    return {
      id: v.id,
      name: v.name,
      sku: v.sku,
      priceFromBom: v.priceFromBom,
      materialMarkup: v.materialMarginPercent !== null ? Number(v.materialMarginPercent) : null,
      laborMarkup: v.laborMarginPercent !== null ? Number(v.laborMarginPercent) : null,
      inheritedMaterialMarkup: productMaterialMarkup,
      inheritedLaborMarkup: productLaborMarkup,
      effectivePriceFromBom: v.priceFromBom ?? product.priceFromBom,
      ownComponents: toLineViews(v.bomComponents, materialCosts),
      ownLabor: toLaborViews(v.bomLaborLines),
      inheritsComponents: ownComponents.length === 0,
      inheritsLabor: ownLabor.length === 0,
      breakdown: buildBreakdown(
        effectiveComponents,
        effectiveLabor,
        materialMarkup,
        laborMarkup,
        materialCosts,
        materialNames,
      ),
      currentPrice: Number(v.baseRetailPrice),
      computedCost: v.computedCost !== null ? Number(v.computedCost) : null,
    };
  });

  return {
    defaults: {
      materialMarkup: Number(settings.defaultMaterialMarginPercent),
      laborMarkup: Number(settings.defaultLaborMarginPercent),
    },
    product: {
      priceFromBom: product.priceFromBom,
      materialMarkup:
        product.materialMarginPercent !== null ? Number(product.materialMarginPercent) : null,
      laborMarkup: product.laborMarginPercent !== null ? Number(product.laborMarginPercent) : null,
      components: toLineViews(product.bomComponents, materialCosts),
      labor: toLaborViews(product.bomLaborLines),
      breakdown: buildBreakdown(
        productComponents,
        productLabor,
        productMaterialMarkup,
        productLaborMarkup,
        materialCosts,
        materialNames,
      ),
    },
    computeError,
    materialOptions: materialRows
      .filter((m) => m.archivedAt === null)
      .map((m) => ({
        id: m.id,
        name: m.name,
        sku: m.sku,
        kind: m.kind,
        unit: m.unit,
        cost: materialCosts?.get(m.id) ? Number(materialCosts.get(m.id)!.cost.toFixed(4)) : null,
      })),
    laborOptions: laborRates.map((r) => ({
      id: r.id,
      name: r.name,
      ratePerHour: Number(r.ratePerHour),
    })),
    variants,
  };
}
