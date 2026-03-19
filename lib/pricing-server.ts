/**
 * Server-only pricing functions that require database access.
 * Do NOT import this from client components.
 */

import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/cache";
import { calculateUOMBasePrice, calculateCustomerPrice } from "@/lib/pricing";

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
