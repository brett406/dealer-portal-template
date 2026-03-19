"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getEffectiveCustomerId } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { searchProducts, searchSuggestions as searchSuggestionsLib, type ProductSearchResult, type SearchSuggestion } from "@/lib/search";
import { addToCart as addToCartLib } from "@/lib/cart";
import { cached } from "@/lib/cache";

export async function loadMoreProducts(
  cursor: string | null,
  search?: string,
  categoryId?: string,
): Promise<{ products: ProductSearchResult[]; nextCursor: string | null }> {
  return searchProducts({
    query: search,
    categoryId,
    cursor: cursor ?? undefined,
    limit: 20,
  });
}

export async function addToCartAction(
  variantId: string,
  uomId: string,
  quantity: number,
): Promise<{ error?: string; success?: boolean }> {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const customerId = getEffectiveCustomerId(session);
  if (!customerId) return { error: "No customer context" };

  // Check if company is approved (PENDING companies cannot add to cart)
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { company: { select: { approvalStatus: true } } },
  });
  if (!customer || customer.company.approvalStatus !== "APPROVED") {
    return { error: "Your account is pending approval. You cannot add items to cart yet." };
  }

  const result = await addToCartLib(customerId, variantId, uomId, quantity);

  if ("error" in result) return { error: result.error };

  revalidatePath("/portal/cart");
  return { success: true };
}

export async function getSearchSuggestions(
  query: string,
): Promise<SearchSuggestion[]> {
  return searchSuggestionsLib(query);
}

export async function getCustomerPricing() {
  const session = await auth();
  if (!session?.user) return null;

  const customerId = getEffectiveCustomerId(session);
  if (!customerId) return null;

  // Cache customer pricing for 60 seconds
  return cached(`customer-pricing:${customerId}`, 60, async () => {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        company: {
          include: { priceLevel: { select: { id: true, name: true, discountPercent: true } } },
        },
      },
    });

    if (!customer) return null;

    return {
      priceLevelId: customer.company.priceLevelId,
      priceLevelName: customer.company.priceLevel.name,
      discountPercent: Number(customer.company.priceLevel.discountPercent),
    };
  });
}
