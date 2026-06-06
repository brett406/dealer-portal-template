import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdminApi } from "@/lib/admin-api/auth";
import { apiOk, apiError } from "@/lib/admin-api/http";
import { createProduct, type CreateProductResult } from "@/lib/admin-api/catalog";

/**
 * POST /api/admin/products
 * Body: a single product object, or { products: [ ... ] } for a batch.
 * Each: { name, category, description?, active?, featured?, variants: [{ name?, sku,
 *         retail, priceTypeCode?, stock?, lowStockThreshold? }], imageUrl?, imageAlt? }
 * Additive + idempotent — existing SKUs are skipped, never overwritten.
 */
export async function POST(request: NextRequest) {
  const a = await authenticateAdminApi(request);
  if (!a.ok) return a.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const items: unknown[] =
    body && typeof body === "object" && Array.isArray((body as { products?: unknown[] }).products)
      ? (body as { products: unknown[] }).products
      : [body];

  if (items.length === 0) return apiError(400, "No products provided");
  if (items.length > 200) return apiError(400, "Too many products in one request (max 200)");

  const results: CreateProductResult[] = [];
  for (const item of items) {
    try {
      results.push(await createProduct(item, a.actorUserId));
    } catch (e) {
      console.error("[admin-api] product create failed:", e);
      results.push({ status: "error", reason: "internal error creating product" });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  return apiOk({ created, total: results.length, results });
}

/** GET /api/admin/products?limit=50 — recent products (id, name, slug, variant SKUs). */
export async function GET(request: NextRequest) {
  const a = await authenticateAdminApi(request);
  if (!a.ok) return a.response;

  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 50) || 50, 200);
  const products = await prisma.product.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      category: { select: { name: true } },
      variants: { select: { sku: true, baseRetailPrice: true } },
    },
  });
  return apiOk({ products });
}
