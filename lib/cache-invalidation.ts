import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/cache";

/**
 * Single source of truth for cache invalidation after catalog writes.
 *
 * Used by BOTH the admin-UI server actions and the server-to-server admin API,
 * so a product/category created or changed through either path refreshes the
 * same surfaces. (Previously the admin UI invalidated inline and the admin API
 * invalidated nothing — a product created via the API stayed invisible in search
 * for up to the cache TTL.)
 *
 * Two layers are cleared:
 *  1. The in-memory `cached()` store (lib/cache.ts) — product search results
 *     (`products:` prefix), per-product pricing (`pricing:`), and per-customer
 *     pricing (`customer-pricing`) all read through it with a 60s TTL.
 *  2. Next's route cache (revalidatePath) for the public catalog routes. This is
 *     a no-op while those pages are `force-dynamic` (the template default), but
 *     keeps writes correct for a fork that makes any of them static/ISR.
 *
 * CAVEAT: the in-memory store is per-process. On a multi-instance deployment only
 * the instance that handled the write is cleared immediately; other instances
 * expire via the 60s TTL. This matches the pre-existing admin-UI behavior — a
 * cross-instance cache (Redis/shared handler) would be the way to remove it.
 */

/** Public routes that surface catalog data (revalidated defensively for ISR/static forks). */
const PUBLIC_CATALOG_PATHS = ["/", "/products", "/portal/catalog"];

function revalidateCatalogRoutes(): void {
  for (const path of PUBLIC_CATALOG_PATHS) revalidatePath(path);
}

/**
 * Invalidate everything affected by a product create/update/delete.
 * Pass the productId on a single-product change to scope the pricing key.
 */
export function invalidateProductCaches(productId?: string): void {
  invalidateCache("products:"); // product listings + search results
  invalidateCache("customer-pricing");
  invalidateCache(productId ? `pricing:${productId}` : "pricing:");
  revalidateCatalogRoutes();
}

/**
 * Invalidate everything affected by a category create/update/delete.
 * Categories drive product listings, filters, and the featured rows.
 */
export function invalidateCategoryCaches(): void {
  invalidateCache("products:");
  revalidateCatalogRoutes();
}
