/**
 * Pure pricing functions — no database calls, no side effects.
 * All monetary values are plain numbers rounded to 2 decimal places.
 */

import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/cache";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Returns the base price for a UOM.
 * If a priceOverride is set, use it directly; otherwise multiply
 * the per-unit retail price by the conversion factor.
 */
export function calculateUOMBasePrice(
  baseRetailPrice: number,
  conversionFactor: number,
  priceOverride: number | null,
): number {
  if (priceOverride !== null) {
    return round2(priceOverride);
  }
  return round2(baseRetailPrice * conversionFactor);
}

/**
 * Returns the customer-facing price after discount.
 * discountPercent is 0-100 (e.g. 20 means 20% off).
 */
export function calculateCustomerPrice(
  uomBasePrice: number,
  discountPercent: number,
): number {
  return round2(uomBasePrice * (1 - discountPercent / 100));
}

/**
 * Returns the line total for a given quantity.
 */
export function calculateLineTotal(
  unitPrice: number,
  quantity: number,
): number {
  return round2(unitPrice * quantity);
}

/**
 * Formats a number as a USD price string.
 */
export function formatPrice(amount: number): string {
  return `$${round2(amount).toFixed(2)}`;
}

/**
 * Returns all variants with all UOM prices for a product at a given price level.
 */
export async function getProductPricing(productId: string, priceLevelId: string) {
  return cached(`pricing:${productId}:${priceLevelId}`, 60, () => getProductPricingUncached(productId, priceLevelId));
}

async function getProductPricingUncached(productId: string, priceLevelId: string) {
  const [product, priceLevel] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
        unitsOfMeasure: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.priceLevel.findUnique({ where: { id: priceLevelId } }),
  ]);

  if (!product || !priceLevel) return null;

  const discountPercent = Number(priceLevel.discountPercent);

  return {
    productId: product.id,
    productName: product.name,
    priceLevelName: priceLevel.name,
    discountPercent,
    variants: product.variants.map((v) => {
      const baseRetailPrice = Number(v.baseRetailPrice);
      return {
        variantId: v.id,
        variantName: v.name,
        sku: v.sku,
        baseRetailPrice,
        uomPrices: product.unitsOfMeasure.map((uom) => {
          const uomBasePrice = calculateUOMBasePrice(
            baseRetailPrice,
            uom.conversionFactor,
            uom.priceOverride !== null ? Number(uom.priceOverride) : null,
          );
          const customerPrice = calculateCustomerPrice(uomBasePrice, discountPercent);
          return {
            uomId: uom.id,
            uomName: uom.name,
            conversionFactor: uom.conversionFactor,
            retailPrice: uomBasePrice,
            customerPrice,
          };
        }),
      };
    }),
  };
}
