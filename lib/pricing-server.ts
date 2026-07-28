/**
 * Server-only pricing functions that require database access.
 * Do NOT import this from client components.
 */

import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/cache";
import {
  calculateUOMBasePrice,
  calculateCustomerPrice,
  resolveBasePrice,
  resolveUomOverride,
} from "@/lib/pricing";

/**
 * Returns all variants with all UOM prices for a product at a given price level
 * and currency. The cache key MUST include currency: a CAD and a USD dealer can
 * share a price level, and omitting currency would serve one the other's prices.
 */
export async function getProductPricing(
  productId: string,
  priceLevelId: string,
  currency: Currency,
) {
  return cached(`pricing:${productId}:${priceLevelId}:${currency}`, 60, () =>
    getProductPricingUncached(productId, priceLevelId, currency),
  );
}

async function getProductPricingUncached(
  productId: string,
  priceLevelId: string,
  currency: Currency,
) {
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
    currency,
    variants: product.variants.map((v) => {
      // null = not priced in this currency (USD with no USD price). Prices are
      // returned as null so the UI hides them rather than showing a CAD figure.
      const baseRetailPrice = resolveBasePrice(
        currency,
        Number(v.baseRetailPrice),
        v.baseRetailPriceUsd !== null ? Number(v.baseRetailPriceUsd) : null,
      );
      const pricedInCurrency = baseRetailPrice !== null;
      return {
        variantId: v.id,
        variantName: v.name,
        sku: v.sku,
        baseRetailPrice,
        pricedInCurrency,
        uomPrices: product.unitsOfMeasure.map((uom) => {
          if (baseRetailPrice === null) {
            return {
              uomId: uom.id,
              uomName: uom.name,
              conversionFactor: uom.conversionFactor,
              retailPrice: null,
              customerPrice: null,
            };
          }
          const override = resolveUomOverride(
            currency,
            uom.priceOverride !== null ? Number(uom.priceOverride) : null,
            uom.priceOverrideUsd !== null ? Number(uom.priceOverrideUsd) : null,
          );
          const uomBasePrice = calculateUOMBasePrice(
            baseRetailPrice,
            uom.conversionFactor,
            override,
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
