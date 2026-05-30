import { describe, it, expect } from "vitest";
import {
  PER_PAGE,
  firstParam,
  getPageParam,
  paginate,
  escapeLike,
  buildPageMeta,
  pageSlice,
  buildPageUrl,
} from "@/lib/pagination";

describe("firstParam", () => {
  it("passes a plain string through", () => {
    expect(firstParam("abc")).toBe("abc");
    expect(firstParam(undefined)).toBeUndefined();
  });

  it("takes the first entry of a repeated (array) param", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam([])).toBeUndefined();
  });
});

describe("getPageParam", () => {
  it("defaults missing/empty to page 1", () => {
    expect(getPageParam(undefined)).toBe(1);
    expect(getPageParam("")).toBe(1);
  });

  it("parses valid positive integers", () => {
    expect(getPageParam("1")).toBe(1);
    expect(getPageParam("7")).toBe(7);
    expect(getPageParam("42")).toBe(42);
  });

  it("rejects zero, negatives, and junk", () => {
    expect(getPageParam("0")).toBe(1);
    expect(getPageParam("-5")).toBe(1);
    expect(getPageParam("abc")).toBe(1);
    expect(getPageParam("NaN")).toBe(1);
  });

  it("truncates decimals to the integer part", () => {
    expect(getPageParam("2.9")).toBe(2);
  });

  it("handles a repeated (array) page param by taking the first", () => {
    expect(getPageParam(["3", "9"])).toBe(3);
    expect(getPageParam([])).toBe(1);
  });
});

describe("paginate", () => {
  it("computes skip/take for a 1-based page", () => {
    expect(paginate(1, 25)).toEqual({ skip: 0, take: 25 });
    expect(paginate(3, 25)).toEqual({ skip: 50, take: 25 });
  });
});

describe("escapeLike", () => {
  it("escapes LIKE metacharacters so terms match literally", () => {
    expect(escapeLike("50%")).toBe("50\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("back\\slash")).toBe("back\\\\slash");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeLike("widget 1200")).toBe("widget 1200");
  });
});

describe("buildPageMeta", () => {
  it("handles an empty result set as a single page", () => {
    expect(buildPageMeta(0, 1, 25)).toMatchObject({
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      hasPrev: false,
      hasNext: false,
    });
  });

  it("computes total pages with a partial last page", () => {
    expect(buildPageMeta(26, 1, 25)).toMatchObject({ totalPages: 2, hasNext: true });
    expect(buildPageMeta(50, 1, 25)).toMatchObject({ totalPages: 2 });
  });

  it("clamps an out-of-range page down to the last real page", () => {
    expect(buildPageMeta(30, 99, 25)).toMatchObject({
      currentPage: 2,
      totalPages: 2,
      hasNext: false,
      hasPrev: true,
    });
  });
});

describe("pageSlice (clamp-skip)", () => {
  it("uses the requested page when in range", () => {
    const { meta, skip, take } = pageSlice(100, 2, 25);
    expect(skip).toBe(25);
    expect(take).toBe(25);
    expect(meta.currentPage).toBe(2);
  });

  it("clamps skip to the last page when the request overshoots", () => {
    // 30 rows, 25/page => 2 pages. Asking for page 99 must NOT skip 2450 rows
    // (which would render an empty, stuck page) — it lands on page 2.
    const { meta, skip } = pageSlice(30, 99, 25);
    expect(meta.currentPage).toBe(2);
    expect(skip).toBe(25);
  });

  it("falls back to page 1 / skip 0 for an empty set", () => {
    const { meta, skip } = pageSlice(0, 5, 25);
    expect(meta.currentPage).toBe(1);
    expect(skip).toBe(0);
  });
});

describe("buildPageUrl", () => {
  it("drops the page param for page 1 (clean canonical URL)", () => {
    expect(buildPageUrl("/admin/products", {}, 1)).toBe("/admin/products");
  });

  it("adds page for pages beyond the first", () => {
    expect(buildPageUrl("/admin/products", {}, 3)).toBe("/admin/products?page=3");
  });

  it("preserves filters and omits empty/null/undefined values", () => {
    const url = buildPageUrl(
      "/admin/products",
      { category: "abc", active: "true", q: "", missing: undefined, none: null },
      2,
    );
    expect(url).toContain("category=abc");
    expect(url).toContain("active=true");
    expect(url).toContain("page=2");
    expect(url).not.toContain("q=");
    expect(url).not.toContain("missing");
    expect(url).not.toContain("none");
  });

  it("url-encodes filter values", () => {
    expect(buildPageUrl("/portal/files", { q: "spec sheet & more" }, 1)).toBe(
      "/portal/files?q=spec+sheet+%26+more",
    );
  });
});

describe("PER_PAGE defaults", () => {
  it("exposes sensible per-surface sizes", () => {
    expect(PER_PAGE.admin).toBeGreaterThan(0);
    expect(PER_PAGE.portal).toBeGreaterThan(0);
    expect(PER_PAGE.publicGrid).toBeGreaterThan(0);
  });
});
