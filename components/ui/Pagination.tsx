import { Button } from "./Button";
import { buildPageUrl, type PageMeta } from "@/lib/pagination";
import "./pagination.css";

interface PaginationProps {
  /** Page metadata from buildPageMeta(). totalCount is optional — when present
   *  it's shown in the status label. */
  meta: Pick<PageMeta, "currentPage" | "totalPages"> & { totalCount?: number };
  /** Path without query string, e.g. "/admin/orders". */
  basePath: string;
  /** Active filter params to preserve across page links. */
  filters?: Record<string, string | number | undefined | null>;
  /** Noun for the total-count label, e.g. "orders". Defaults to "total". */
  label?: string;
}

/**
 * Shared numbered-page navigator for admin/portal list pages.
 *
 * Pure component (no client hooks) so it renders in both server components and
 * inside "use client" list components. Renders nothing for a single page.
 */
export function Pagination({ meta, basePath, filters = {}, label }: PaginationProps) {
  const { currentPage, totalPages, totalCount } = meta;
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      {currentPage > 1 && (
        <Button variant="secondary" size="sm" href={buildPageUrl(basePath, filters, currentPage - 1)}>
          Previous
        </Button>
      )}
      <span className="pagination-status">
        Page {currentPage} of {totalPages}
        {typeof totalCount === "number" ? ` · ${totalCount} ${label ?? "total"}` : ""}
      </span>
      {currentPage < totalPages && (
        <Button variant="secondary" size="sm" href={buildPageUrl(basePath, filters, currentPage + 1)}>
          Next
        </Button>
      )}
    </nav>
  );
}
