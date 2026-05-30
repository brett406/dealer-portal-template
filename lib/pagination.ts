// Shared offset-pagination helpers for admin/portal list pages.
//
// These cover numbered page navigation (?page=2) over Prisma findMany/count.
// Cursor-based "load more" lists (e.g. the customer-facing product grid in
// lib/search.ts + components/portal/ProductGrid.tsx) intentionally use a
// different mechanism and do NOT go through this module.

/** Default rows-per-page by surface. Pass an explicit perPage to override. */
export const PER_PAGE = {
  admin: 25,
  portal: 15,
  publicGrid: 24,
} as const;

/** Parse a raw `?page=` value into a safe, 1-based page number. */
export function getPageParam(value: string | undefined): number {
  const n = parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Prisma `skip`/`take` for a given 1-based page. */
export function paginate(page: number, perPage: number): { skip: number; take: number } {
  return { skip: (page - 1) * perPage, take: perPage };
}

export interface PageMeta {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Derive page metadata from a total row count. Clamps the requested page into
 * the valid range so an out-of-bounds `?page=` never produces a broken pager.
 */
export function buildPageMeta(totalCount: number, page: number, perPage: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return {
    currentPage,
    totalPages,
    totalCount,
    perPage,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
  };
}

/**
 * Build a URL for a target page, preserving active filter params and dropping
 * `page` when it's 1 so page one stays the canonical, clean URL. Empty/null/
 * undefined filter values are omitted.
 */
export function buildPageUrl(
  basePath: string,
  filters: Record<string, string | number | undefined | null>,
  page: number,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
