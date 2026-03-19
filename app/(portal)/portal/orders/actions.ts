"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getEffectiveCustomerId } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { reorderToCart } from "@/lib/orders";

export async function reorderAction(
  orderId: string,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const customerId = getEffectiveCustomerId(session);
  if (!customerId) return { error: "No customer context" };

  const result = await reorderToCart(orderId, customerId);

  if (!result.success) return { error: result.error };

  if (result.addedCount === 0) {
    return { error: "No items could be added — all products are no longer available." };
  }

  revalidatePath("/portal/cart");

  const msg =
    result.skippedCount > 0
      ? `Added ${result.addedCount} items. ${result.skippedCount} item(s) skipped (no longer available).`
      : undefined;

  redirect(`/portal/cart${msg ? `?reorder=${encodeURIComponent(msg)}` : ""}`);
}
