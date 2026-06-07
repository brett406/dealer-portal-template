import { describe, it, expect, beforeEach, vi } from "vitest";

// revalidatePath needs a request scope at runtime; mock it as a spy so we can
// assert which public routes get refreshed without a Next server context.
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

import { getCached, setCached, invalidateAll } from "@/lib/cache";
import {
  invalidateProductCaches,
  invalidateCategoryCaches,
} from "@/lib/cache-invalidation";

describe("invalidateProductCaches", () => {
  beforeEach(() => {
    invalidateAll();
    revalidatePath.mockClear();
  });

  it("clears product search, pricing, and customer-pricing entries", () => {
    setCached("products:search:rake::", { products: [] }, 60);
    setCached("pricing:p1:lvl1", { price: 1 }, 60);
    setCached("customer-pricing:c1", { price: 2 }, 60);

    invalidateProductCaches();

    expect(getCached("products:search:rake::")).toBeNull();
    expect(getCached("pricing:p1:lvl1")).toBeNull();
    expect(getCached("customer-pricing:c1")).toBeNull();
  });

  it("scopes the pricing key to one product when an id is given", () => {
    setCached("pricing:keep:lvl1", { price: 1 }, 60);
    setCached("pricing:drop:lvl1", { price: 2 }, 60);

    invalidateProductCaches("drop");

    // Only the targeted product's pricing is dropped; the other survives.
    expect(getCached("pricing:drop:lvl1")).toBeNull();
    expect(getCached("pricing:keep:lvl1")).toEqual({ price: 1 });
  });

  it("revalidates the public catalog routes", () => {
    invalidateProductCaches();
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(expect.arrayContaining(["/", "/products", "/portal/catalog"]));
  });
});

describe("invalidateCategoryCaches", () => {
  beforeEach(() => {
    invalidateAll();
    revalidatePath.mockClear();
  });

  it("clears product listings/search and revalidates catalog routes", () => {
    setCached("products:search:::", { products: [] }, 60);

    invalidateCategoryCaches();

    expect(getCached("products:search:::")).toBeNull();
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(expect.arrayContaining(["/", "/products", "/portal/catalog"]));
  });
});
