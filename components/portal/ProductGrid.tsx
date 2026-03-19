"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProductCard } from "./ProductCard";
import { loadMoreProducts, getSearchSuggestions } from "@/app/(portal)/portal/catalog/actions";
import type { ProductSearchResult, SearchSuggestion } from "@/lib/search";
import "@/app/(portal)/portal/catalog/catalog.css";

type Category = { id: string; name: string; slug: string };

export function ProductGrid({
  initialProducts,
  initialCursor,
  categories,
  filters,
  discountPercent,
  priceLevelName,
}: {
  initialProducts: ProductSearchResult[];
  initialCursor: string | null;
  categories: Category[];
  filters: { q?: string; category?: string };
  discountPercent: number;
  priceLevelName: string;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  // Search suggestions state
  const [searchValue, setSearchValue] = useState(filters.q ?? "");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const searchRef = useRef<HTMLDivElement>(null);

  // Reset when filters change via server
  useEffect(() => {
    setProducts(initialProducts);
    setCursor(initialCursor);
  }, [initialProducts, initialCursor]);

  // Infinite scroll observer with preloading
  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    const result = await loadMoreProducts(cursor, filters.q, filters.category);
    setProducts((prev) => [...prev, ...result.products]);
    setCursor(result.nextCursor);
    setLoading(false);
  }, [cursor, loading, filters.q, filters.category]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "400px" }, // Preload earlier
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Debounced search suggestions
  useEffect(() => {
    if (searchValue.length < 2) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await getSearchSuggestions(searchValue);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [searchValue]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleFilter(key: string, value: string) {
    const sp = new URLSearchParams();
    const next = { ...filters, [key]: value || undefined };
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    router.push(`/portal/catalog${qs ? `?${qs}` : ""}`);
  }

  function handleSearch() {
    setShowSuggestions(false);
    handleFilter("q", searchValue);
  }

  return (
    <>
      <div className="catalog-toolbar">
        <div ref={searchRef} style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <input
            type="search"
            placeholder="Search products..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            style={{ width: "100%" }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="catalog-suggestions">
              {suggestions.map((s) => (
                <Link
                  key={s.id}
                  href={`/portal/catalog/${s.slug}`}
                  className="catalog-suggestion-item"
                  onClick={() => setShowSuggestions(false)}
                >
                  <span className="catalog-suggestion-name">{s.name}</span>
                  <span className="catalog-suggestion-cat">{s.categoryName}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <select
          aria-label="Filter by category"
          defaultValue={filters.category ?? ""}
          onChange={(e) => handleFilter("category", e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
          Your level: <strong>{priceLevelName}</strong>
        </span>
      </div>

      {products.length === 0 ? (
        <div className="catalog-empty">
          <p>No products found.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} discountPercent={discountPercent} />
          ))}
        </div>
      )}

      {cursor && (
        <>
          <div ref={sentinelRef} className="catalog-sentinel" />
          {loading && <div className="catalog-loading">Loading more products...</div>}
        </>
      )}
    </>
  );
}
