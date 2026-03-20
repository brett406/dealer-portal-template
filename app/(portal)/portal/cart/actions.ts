"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getEffectiveCustomerId } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import {
  updateCartItemQuantity as updateQty,
  removeCartItem as removeItem,
  getCartWithPricing,
} from "@/lib/cart";
import { createOrderFromCart } from "@/lib/orders";
import { calculateShipping } from "@/lib/shipping";
import { calculateTax } from "@/lib/tax";

export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const result = await updateQty(cartItemId, quantity);
  if ("error" in result) return { error: result.error };

  revalidatePath("/portal/cart");
  return {};
}

export async function removeCartItemAction(cartItemId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  await removeItem(cartItemId);
  revalidatePath("/portal/cart");
  return {};
}

export async function submitOrder(formData: FormData): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const customerId = getEffectiveCustomerId(session);
  if (!customerId) return { error: "No customer context" };

  const shippingAddressId = (formData.get("shippingAddressId") as string) || undefined;
  const poNumber = (formData.get("poNumber") as string) || undefined;
  const notes = (formData.get("notes") as string) || undefined;

  const isAdmin = session.user.role === "SUPER_ADMIN" || session.user.role === "STAFF";
  const placedByAdminId = isAdmin ? session.user.id : undefined;

  const result = await createOrderFromCart(customerId, {
    shippingAddressId,
    poNumber,
    notes,
    placedByAdminId,
  });

  if (!result.success) {
    return { error: result.error };
  }

  redirect(`/portal/orders/${result.orderId}?status=placed`);
}

export async function getCartData() {
  const session = await auth();
  if (!session?.user) return null;

  const customerId = getEffectiveCustomerId(session);
  if (!customerId) return null;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      company: {
        include: {
          priceLevel: { select: { id: true, name: true, discountPercent: true } },
          taxRate: { select: { label: true, percent: true } },
          addresses: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!customer) return null;

  const cartWithPricing = await getCartWithPricing(
    customerId,
    customer.company.priceLevelId,
  );

  const shippingCost = await calculateShipping(cartWithPricing.subtotal);

  // Check if PO number is required
  const dealerSettings = await prisma.pageContent.findUnique({
    where: { pageKey: "dealer-settings" },
  });
  const requirePO = (dealerSettings?.payload as Record<string, string>)?.requirePONumber === "true";

  const addresses = customer.company.addresses.map((a) => ({
    id: a.id,
    label: a.label,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    isDefault: a.isDefault,
  }));

  const taxRate = customer.company.taxRate;
  const taxPercent = taxRate ? Number(taxRate.percent) : null;
  const taxAmount = calculateTax(cartWithPricing.subtotal, taxPercent);
  const total = Math.round((cartWithPricing.subtotal + shippingCost + taxAmount) * 100) / 100;

  return {
    ...cartWithPricing,
    shippingCost,
    taxAmount,
    taxPercent,
    taxRateName: taxRate?.label ?? null,
    total,
    addresses,
    requirePONumber: requirePO,
    companyName: customer.company.name,
  };
}
