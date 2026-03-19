import { prisma } from "@/lib/prisma";

/**
 * Check stock availability for a single variant.
 */
export async function checkStockAvailability(
  variantId: string,
  baseUnitQuantity: number,
): Promise<{ available: boolean; currentStock: number; requested: number }> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { stockQuantity: true, active: true, product: { select: { active: true } } },
  });

  if (!variant || !variant.active || !variant.product.active) {
    return { available: false, currentStock: 0, requested: baseUnitQuantity };
  }

  return {
    available: variant.stockQuantity >= baseUnitQuantity,
    currentStock: variant.stockQuantity,
    requested: baseUnitQuantity,
  };
}

/**
 * Atomically decrement stock for multiple items. All or none.
 * Each item specifies variantId and baseUnitQuantity to subtract.
 */
export async function decrementStock(
  items: { variantId: string; baseUnitQuantity: number }[],
): Promise<void> {
  // Aggregate quantities by variant (same variant may appear multiple times)
  const aggregated = new Map<string, number>();
  for (const item of items) {
    aggregated.set(
      item.variantId,
      (aggregated.get(item.variantId) ?? 0) + item.baseUnitQuantity,
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const [variantId, totalQty] of aggregated) {
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { stockQuantity: true },
      });

      if (!variant) {
        throw new Error(`Variant ${variantId} not found`);
      }

      if (variant.stockQuantity < totalQty) {
        throw new Error(
          `Insufficient stock for variant ${variantId}: have ${variant.stockQuantity}, need ${totalQty}`,
        );
      }

      await tx.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: { decrement: totalQty } },
      });
    }
  });
}

export type CartItemForValidation = {
  variantId: string;
  uomConversionFactor: number;
  quantity: number;
  variant: {
    active: boolean;
    stockQuantity: number;
    product: { active: boolean };
  };
};

/**
 * Check stock availability for all items in a cart.
 * Returns per-item results including whether product/variant are active.
 */
export function checkCartStockAvailability(
  cartItems: CartItemForValidation[],
): {
  allAvailable: boolean;
  items: {
    variantId: string;
    available: boolean;
    currentStock: number;
    requested: number;
    reason?: string;
  }[];
} {
  // Aggregate base unit quantities by variant
  const demandByVariant = new Map<string, number>();
  for (const item of cartItems) {
    const baseUnits = item.quantity * item.uomConversionFactor;
    demandByVariant.set(
      item.variantId,
      (demandByVariant.get(item.variantId) ?? 0) + baseUnits,
    );
  }

  const results = cartItems.map((item) => {
    const baseUnits = item.quantity * item.uomConversionFactor;

    if (!item.variant.product.active) {
      return {
        variantId: item.variantId,
        available: false,
        currentStock: item.variant.stockQuantity,
        requested: baseUnits,
        reason: "Product is inactive",
      };
    }

    if (!item.variant.active) {
      return {
        variantId: item.variantId,
        available: false,
        currentStock: item.variant.stockQuantity,
        requested: baseUnits,
        reason: "Variant is inactive",
      };
    }

    // Use cumulative demand for this variant
    const totalDemand = demandByVariant.get(item.variantId) ?? baseUnits;
    const available = item.variant.stockQuantity >= totalDemand;

    return {
      variantId: item.variantId,
      available,
      currentStock: item.variant.stockQuantity,
      requested: baseUnits,
      reason: available ? undefined : "Insufficient stock",
    };
  });

  return {
    allAvailable: results.every((r) => r.available),
    items: results,
  };
}
