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

/**
 * Coerce a Next.js searchParams value to a single string. A repeated query param
 * (`?folder=a&folder=b`) arrives as an array; we take the first entry so a
 * crafted/duplicated param can't turn a string filter into an array (which would
 * throw in Prisma).
 */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parse a raw `?page=` value into a safe, 1-based page number. */
export function getPageParam(value: string | string[] | undefined): number {
  const n = parseInt(firstParam(value) ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Prisma `skip`/`take` for a given 1-based page. */
export function paginate(page: number, perPage: number): { skip: number; take: number } {
  return { skip: (page - 1) * perPage, take: perPage };
}

/**
 * Escape LIKE/ILIKE metacharacters (`%`, `_`, `\`) so a user's search term is
 * matched literally instead of as a wildcard. Prisma's `contains` does not
 * escape these, so `50%` would otherwise match anything. Use with a Prisma
 * `contains` filter on the escaped value.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Resolve a total count + requested page into both the page metadata AND the
 * Prisma skip/take — using the CLAMPED page for skip. This guarantees an
 * out-of-range `?page=` (a stale deep link, or the page you're on after
 * deleting its last row) falls back to the last real page WITH data, instead of
 * a stuck empty page. Requires the total count first, so run the count() before
 * the page findMany() (alongside any other independent queries).
 */
export function pageSlice(
  totalCount: number,
  page: number,
  perPage: number,
): { meta: PageMeta; skip: number; take: number } {
  const meta = buildPageMeta(totalCount, page, perPage);
  return { meta, ...paginate(meta.currentPage, perPage) };
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
