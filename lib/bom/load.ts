/**
 * BOM loaders — read the catalog's BOM data and shape it into the pure
 * engine's inputs (lib/bom/cost.ts). All Prisma Decimals are converted to
 * strings here: the engine runs its own decimal.js context and must never
 * receive a foreign Decimal instance.
 *
 * Effective-BOM resolution (docs/BOM-COSTING.md §4.1) lives here:
 * - components: the variant's own rows IF ANY exist, else the product's
 *   (all-or-nothing override; no partial merge)
 * - labor: same rule, resolved independently of components
 * - margins: field-by-field variant → product → site default
 * - priceFromBom: variant ?? product (global toggle checked by the caller)
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  resolveMargin,
  type EngineComponentLine,
  type EngineLaborLine,
  type EngineMaterial,
  type VariantPriceInput,
} from "@/lib/bom/cost";

/** Works inside or outside an interactive transaction. */
export type PrismaReader = PrismaClient | Prisma.TransactionClient;

export interface LoadedVariant {
  variantId: string;
  sku: string;
  productId: string;
  /** variant.priceFromBom ?? product.priceFromBom — global toggle NOT applied here. */
  priceFromBom: boolean;
  /** Current price as stored, for change reporting. */
  currentBaseRetailPrice: string;
  currentComputedCost: string | null;
  engineInput: VariantPriceInput;
}

export interface LoadedBom {
  materials: EngineMaterial[];
  /** Material rows that exist, for computedCost write-back (kind included). */
  materialMeta: Array<{ id: string; kind: "raw" | "subassembly"; computedCost: string | null }>;
  variants: LoadedVariant[];
}

const componentSelect = {
  materialId: true,
  quantity: true,
} as const;

const laborSelect = {
  hours: true,
  laborRate: { select: { ratePerHour: true } },
} as const;

function toComponentLines(
  rows: Array<{ materialId: string; quantity: Prisma.Decimal }>,
): EngineComponentLine[] {
  return rows.map((r) => ({ materialId: r.materialId, quantity: r.quantity.toString() }));
}

function toLaborLines(
  rows: Array<{ hours: Prisma.Decimal; laborRate: { ratePerHour: Prisma.Decimal } }>,
): EngineLaborLine[] {
  return rows.map((r) => ({
    hours: r.hours.toString(),
    ratePerHour: r.laborRate.ratePerHour.toString(),
  }));
}

/**
 * Load the full BOM graph + every variant's effective BOM/margins.
 * Archived materials/rates still load and cost normally (§13.2) — archiving
 * only hides them from pickers.
 */
export async function loadBom(
  db: PrismaReader,
  siteDefaults: { materialMarginPercent: string; laborMarginPercent: string },
): Promise<LoadedBom> {
  const [materialRows, productRows] = await Promise.all([
    db.material.findMany({
      select: {
        id: true,
        kind: true,
        unitCost: true,
        computedCost: true,
        components: { select: componentSelect },
        laborLines: { select: laborSelect },
      },
    }),
    db.product.findMany({
      select: {
        id: true,
        priceFromBom: true,
        materialMarginPercent: true,
        laborMarginPercent: true,
        bomComponents: { select: componentSelect },
        bomLaborLines: { select: laborSelect },
        variants: {
          select: {
            id: true,
            sku: true,
            baseRetailPrice: true,
            computedCost: true,
            priceFromBom: true,
            materialMarginPercent: true,
            laborMarginPercent: true,
            bomComponents: { select: componentSelect },
            bomLaborLines: { select: laborSelect },
          },
        },
      },
    }),
  ]);

  const materials: EngineMaterial[] = materialRows.map((m) => ({
    id: m.id,
    kind: m.kind,
    unitCost: m.unitCost === null ? null : m.unitCost.toString(),
    components: toComponentLines(m.components),
    laborLines: toLaborLines(m.laborLines),
  }));

  const variants: LoadedVariant[] = [];
  for (const product of productRows) {
    const productComponents = toComponentLines(product.bomComponents);
    const productLabor = toLaborLines(product.bomLaborLines);

    for (const variant of product.variants) {
      const ownComponents = toComponentLines(variant.bomComponents);
      const ownLabor = toLaborLines(variant.bomLaborLines);

      variants.push({
        variantId: variant.id,
        sku: variant.sku,
        productId: product.id,
        priceFromBom: variant.priceFromBom ?? product.priceFromBom,
        // toFixed, not toString: Decimal.toString() drops trailing zeros
        // ("234.00" → "234"), which would defeat scale-stable change detection.
        currentBaseRetailPrice: variant.baseRetailPrice.toFixed(2),
        currentComputedCost: variant.computedCost?.toFixed(4) ?? null,
        engineInput: {
          variantId: variant.id,
          // All-or-nothing override, components and labor independently (§4.1)
          components: ownComponents.length > 0 ? ownComponents : productComponents,
          laborLines: ownLabor.length > 0 ? ownLabor : productLabor,
          materialMarginPercent: resolveMargin(
            variant.materialMarginPercent?.toString(),
            product.materialMarginPercent?.toString(),
            siteDefaults.materialMarginPercent,
          ).toString(),
          laborMarginPercent: resolveMargin(
            variant.laborMarginPercent?.toString(),
            product.laborMarginPercent?.toString(),
            siteDefaults.laborMarginPercent,
          ).toString(),
        },
      });
    }
  }

  return {
    materials,
    materialMeta: materialRows.map((m) => ({
      id: m.id,
      kind: m.kind,
      computedCost: m.computedCost?.toFixed(4) ?? null,
    })),
    variants,
  };
}
