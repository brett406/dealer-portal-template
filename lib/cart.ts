import { prisma } from "@/lib/prisma";
import { calculateUOMBasePrice, calculateCustomerPrice, calculateLineTotal } from "@/lib/pricing";

/**
 * Get or create a cart for a customer, with items eagerly loaded.
 */
export async function getCart(customerId: string) {
  let cart = await prisma.cart.findUnique({
    where: { customerId },
    include: {
      items: {
        include: {
          variant: { include: { product: { select: { id: true, name: true, active: true, minOrderQuantity: true } } } },
          uom: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { customerId },
      include: {
        items: {
          include: {
            variant: { include: { product: { select: { id: true, name: true, active: true, minOrderQuantity: true } } } },
            uom: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  return cart;
}

export type AddToCartError = {
  error: string;
};

/**
 * Add an item to the cart. If the same variant+UOM combo exists, increment quantity.
 */
export async function addToCart(
  customerId: string,
  variantId: string,
  uomId: string,
  quantity: number,
): Promise<AddToCartError | { success: true }> {
  if (quantity <= 0) {
    return { error: "Quantity must be greater than 0" };
  }

  // Validate variant and UOM
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { id: true, active: true, minOrderQuantity: true } } },
  });

  if (!variant) return { error: "Variant not found" };
  if (!variant.active) return { error: "This variant is no longer available" };
  if (!variant.product.active) return { error: "This product is no longer available" };

  const uom = await prisma.productUOM.findUnique({ where: { id: uomId } });
  if (!uom) return { error: "Unit of measure not found" };
  if (uom.productId !== variant.productId) {
    return { error: "Unit of measure does not belong to this product" };
  }

  // Min order quantity check
  if (variant.product.minOrderQuantity && quantity < variant.product.minOrderQuantity) {
    return { error: `Minimum order quantity is ${variant.product.minOrderQuantity}` };
  }

  const cart = await getCart(customerId);

  // Check for existing line with same variant+UOM
  const existingItem = cart.items.find(
    (item) => item.variantId === variantId && item.uomId === uomId,
  );

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: existingItem.quantity + quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, variantId, uomId, quantity },
    });
  }

  return { success: true };
}

/**
 * Update the quantity of a cart item. Deletes the item if quantity is 0.
 */
export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number,
): Promise<AddToCartError | { success: true }> {
  if (quantity < 0) return { error: "Quantity cannot be negative" };

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: cartItemId } });
    return { success: true };
  }

  await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity },
  });

  return { success: true };
}

/**
 * Remove a single item from the cart.
 */
export async function removeCartItem(cartItemId: string): Promise<void> {
  await prisma.cartItem.delete({ where: { id: cartItemId } });
}

/**
 * Remove all items from the customer's cart.
 */
export async function clearCart(customerId: string): Promise<void> {
  const cart = await prisma.cart.findUnique({ where: { customerId } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
}

/**
 * Returns cart items with calculated prices for a given price level.
 */
export async function getCartWithPricing(customerId: string, priceLevelId: string) {
  const [cart, priceLevel] = await Promise.all([
    getCart(customerId),
    prisma.priceLevel.findUnique({ where: { id: priceLevelId } }),
  ]);

  if (!priceLevel) throw new Error("Price level not found");

  const discountPercent = Number(priceLevel.discountPercent);

  let subtotal = 0;

  const items = cart.items.map((item) => {
    const baseRetailPrice = Number(item.variant.baseRetailPrice);
    const priceOverride = item.uom.priceOverride !== null ? Number(item.uom.priceOverride) : null;

    const retailPrice = calculateUOMBasePrice(baseRetailPrice, item.uom.conversionFactor, priceOverride);
    const customerPrice = calculateCustomerPrice(retailPrice, discountPercent);
    const lineTotal = calculateLineTotal(customerPrice, item.quantity);

    subtotal += lineTotal;

    // Per-item warnings for stale data
    const warnings: string[] = [];
    if (!item.variant.product.active) {
      warnings.push("This product is no longer available");
    } else if (!item.variant.active) {
      warnings.push("This variant is no longer available");
    }
    if (item.variant.stockQuantity !== undefined) {
      const baseUnits = item.quantity * item.uom.conversionFactor;
      if (item.variant.stockQuantity === 0) {
        warnings.push("Out of stock");
      } else if (item.variant.stockQuantity < baseUnits) {
        warnings.push(`Only ${item.variant.stockQuantity} units available`);
      }
    }

    return {
      id: item.id,
      variantId: item.variantId,
      variantName: item.variant.name,
      sku: item.variant.sku,
      productName: item.variant.product.name,
      productId: item.variant.product.id,
      productActive: item.variant.product.active,
      variantActive: item.variant.active,
      stockQuantity: item.variant.stockQuantity,
      uomId: item.uomId,
      uomName: item.uom.name,
      conversionFactor: item.uom.conversionFactor,
      quantity: item.quantity,
      baseUnitQuantity: item.quantity * item.uom.conversionFactor,
      retailPrice,
      customerPrice,
      lineTotal,
      warnings,
    };
  });

  // Round final subtotal
  subtotal = Math.round(subtotal * 100) / 100;
  const hasWarnings = items.some((i) => i.warnings.length > 0);
  const canSubmit = items.every(
    (i) => i.productActive && i.variantActive && i.warnings.every((w) => !w.includes("no longer")),
  );

  return {
    cartId: cart.id,
    customerId,
    priceLevelName: priceLevel.name,
    discountPercent,
    items,
    subtotal,
    hasWarnings,
    canSubmit,
  };
}
