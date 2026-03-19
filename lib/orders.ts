import { prisma } from "@/lib/prisma";
import { calculateUOMBasePrice, calculateCustomerPrice, calculateLineTotal } from "@/lib/pricing";
import { calculateShipping } from "@/lib/shipping";
import type { OrderStatus } from "@prisma/client";

// ─── Status transition map ───────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function getValidStatusTransitions(currentStatus: OrderStatus): OrderStatus[] {
  return VALID_TRANSITIONS[currentStatus] ?? [];
}

// ─── Order number generation ─────────────────────────────────────────────────

export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  // Find the latest order number for this year
  const latest = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  let nextSeq = 1;
  if (latest) {
    const seq = parseInt(latest.orderNumber.slice(prefix.length), 10);
    if (!isNaN(seq)) nextSeq = seq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

// ─── Order creation from cart ────────────────────────────────────────────────

export type CreateOrderOptions = {
  shippingAddressId?: string;
  poNumber?: string;
  notes?: string;
  placedByAdminId?: string;
};

export type CreateOrderResult =
  | { success: true; orderId: string; orderNumber: string }
  | { success: false; error: string };

export async function createOrderFromCart(
  customerId: string,
  options: CreateOrderOptions = {},
): Promise<CreateOrderResult> {
  // 1. Get cart with items
  const cart = await prisma.cart.findUnique({
    where: { customerId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, active: true } },
            },
          },
          uom: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return { success: false, error: "Cart is empty" };
  }

  // 2. Validate all items
  for (const item of cart.items) {
    if (!item.variant.product.active) {
      return {
        success: false,
        error: `Product "${item.variant.product.name}" is no longer available`,
      };
    }
    if (!item.variant.active) {
      return {
        success: false,
        error: `Variant "${item.variant.name}" of "${item.variant.product.name}" is no longer available`,
      };
    }
  }

  // 3. Get company and price level
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      company: {
        include: { priceLevel: true },
      },
    },
  });

  if (!customer) return { success: false, error: "Customer not found" };

  const priceLevel = customer.company.priceLevel;
  const discountPercent = Number(priceLevel.discountPercent);

  // 4. Calculate all prices and build order items
  const orderItems: {
    variantId: string;
    productNameSnapshot: string;
    variantNameSnapshot: string;
    skuSnapshot: string;
    uomNameSnapshot: string;
    uomConversionSnapshot: number;
    quantity: number;
    baseUnitQuantity: number;
    unitPrice: number;
    baseRetailPriceSnapshot: number;
    lineTotal: number;
  }[] = [];

  let subtotal = 0;

  for (const item of cart.items) {
    const baseRetailPrice = Number(item.variant.baseRetailPrice);
    const priceOverride = item.uom.priceOverride !== null ? Number(item.uom.priceOverride) : null;

    const uomBasePrice = calculateUOMBasePrice(baseRetailPrice, item.uom.conversionFactor, priceOverride);
    const unitPrice = calculateCustomerPrice(uomBasePrice, discountPercent);
    const baseUnitQuantity = item.quantity * item.uom.conversionFactor;
    const lineTotal = calculateLineTotal(unitPrice, item.quantity);

    subtotal += lineTotal;

    orderItems.push({
      variantId: item.variantId,
      productNameSnapshot: item.variant.product.name,
      variantNameSnapshot: item.variant.name,
      skuSnapshot: item.variant.sku,
      uomNameSnapshot: item.uom.name,
      uomConversionSnapshot: item.uom.conversionFactor,
      quantity: item.quantity,
      baseUnitQuantity,
      unitPrice,
      baseRetailPriceSnapshot: baseRetailPrice,
      lineTotal,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;

  // 5. Check stock availability
  for (const item of orderItems) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      select: { stockQuantity: true, name: true },
    });

    if (!variant || variant.stockQuantity < item.baseUnitQuantity) {
      return {
        success: false,
        error: `Insufficient stock for "${item.variantNameSnapshot}": need ${item.baseUnitQuantity}, have ${variant?.stockQuantity ?? 0}`,
      };
    }
  }

  // 6. Calculate shipping
  const shippingCost = await calculateShipping(subtotal);
  const total = Math.round((subtotal + shippingCost) * 100) / 100;

  // 7. Generate order number
  const orderNumber = await generateOrderNumber();

  // 8. Create order, decrement stock, clear cart — all in transaction
  const changedById = options.placedByAdminId ?? customer.userId;

  const order = await prisma.$transaction(async (tx) => {
    // Create order
    const created = await tx.order.create({
      data: {
        orderNumber,
        companyId: customer.companyId,
        customerId,
        placedByAdminId: options.placedByAdminId ?? null,
        shippingAddressId: options.shippingAddressId ?? null,
        status: "RECEIVED",
        subtotal,
        shippingCost,
        total,
        poNumber: options.poNumber ?? null,
        notes: options.notes ?? null,
        priceLevelSnapshot: priceLevel.name,
        discountPercentSnapshot: discountPercent,
        submittedAt: new Date(),
        items: { create: orderItems },
      },
    });

    // Create initial status history
    await tx.orderStatusHistory.create({
      data: {
        orderId: created.id,
        status: "RECEIVED",
        changedById,
        notes: "Order placed",
      },
    });

    // Decrement inventory
    for (const item of orderItems) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockQuantity: { decrement: item.baseUnitQuantity } },
      });
    }

    // Clear cart
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  });

  return { success: true, orderId: order.id, orderNumber: order.orderNumber };
}

// ─── Status update ───────────────────────────────────────────────────────────

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  changedByUserId: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });

  if (!order) return { success: false, error: "Order not found" };

  const validTransitions = getValidStatusTransitions(order.status);
  if (!validTransitions.includes(newStatus)) {
    return {
      success: false,
      error: `Cannot transition from ${order.status} to ${newStatus}`,
    };
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: newStatus,
        changedById: changedByUserId,
        notes,
      },
    }),
  ]);

  return { success: true };
}

// ─── Reorder to cart ─────────────────────────────────────────────────────────

export type ReorderResult =
  | { success: true; addedCount: number; skippedCount: number }
  | { success: false; error: string };

export async function reorderToCart(
  orderId: string,
  customerId: string,
): Promise<ReorderResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: { unitsOfMeasure: true },
              },
            },
          },
        },
      },
    },
  });

  if (!order) return { success: false, error: "Order not found" };

  // Ensure or create cart
  let cart = await prisma.cart.findUnique({ where: { customerId } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { customerId } });
  }

  let addedCount = 0;
  let skippedCount = 0;

  for (const item of order.items) {
    // Skip inactive products/variants
    if (!item.variant.product.active || !item.variant.active) {
      skippedCount++;
      continue;
    }

    // Find matching UOM by name (order stores snapshot name, not ID)
    const uom = item.variant.product.unitsOfMeasure.find(
      (u) => u.name === item.uomNameSnapshot,
    );
    if (!uom) {
      skippedCount++;
      continue;
    }

    // Check if this combo already exists in cart
    const existing = await prisma.cartItem.findUnique({
      where: {
        cartId_variantId_uomId: {
          cartId: cart.id,
          variantId: item.variantId,
          uomId: uom.id,
        },
      },
    });

    if (existing) {
      // Merge: increment quantity
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + item.quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: item.variantId,
          uomId: uom.id,
          quantity: item.quantity,
        },
      });
    }

    addedCount++;
  }

  return { success: true, addedCount, skippedCount };
}
