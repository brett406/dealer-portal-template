import { describe, it, expect, vi, beforeEach } from "vitest";
import { invalidateAll } from "@/lib/cache";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  product: { findMany: vi.fn() },
  productVariant: { findMany: vi.fn() },
  productImage: { findMany: vi.fn() },
  $queryRawUnsafe: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { searchProducts, searchSuggestions } = await import("@/lib/search");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "Test Drill",
    slug: "test-drill",
    description: "A cordless drill",
    categoryId: "cat1",
    minOrderQuantity: null,
    category: { name: "Power Tools" },
    variants: [{ baseRetailPrice: { toString: () => "99.99" } }],
    images: [{ url: "/uploads/drill.jpg" }],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("searchProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateAll();
  });

  it("returns products with no query (browse all)", async () => {
    mockPrisma.product.findMany.mockResolvedValue([makeProduct()]);

    const result = await searchProducts({});
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe("Test Drill");
    expect(result.products[0].categoryName).toBe("Power Tools");
  });

  it("returns correct price range from variants", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      makeProduct({
        variants: [
          { baseRetailPrice: { toString: () => "50" } },
          { baseRetailPrice: { toString: () => "150" } },
        ],
      }),
    ]);

    const result = await searchProducts({});
    expect(result.products[0].priceRange).toEqual({ min: 50, max: 150 });
  });

  it("returns null priceRange when no variants", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      makeProduct({ variants: [] }),
    ]);

    const result = await searchProducts({});
    expect(result.products[0].priceRange).toBeNull();
    expect(result.products[0].variantCount).toBe(0);
  });

  it("returns primary image URL", async () => {
    mockPrisma.product.findMany.mockResolvedValue([makeProduct()]);

    const result = await searchProducts({});
    expect(result.products[0].primaryImageUrl).toBe("/uploads/drill.jpg");
  });

  it("returns null image when none exists", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      makeProduct({ images: [] }),
    ]);

    const result = await searchProducts({});
    expect(result.products[0].primaryImageUrl).toBeNull();
  });

  it("applies category filter", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    await searchProducts({ categoryId: "cat-123" });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: "cat-123" }),
      }),
    );
  });

  it("applies search query filter", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    await searchProducts({ query: "dr" });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: { contains: "dr", mode: "insensitive" } }),
          ]),
        }),
      }),
    );
  });

  it("cursor-based pagination: returns nextCursor when more results", async () => {
    // 21 results = 20 page + 1 extra
    const products = Array.from({ length: 21 }, (_, i) =>
      makeProduct({ id: `p${i}`, slug: `prod-${i}` }),
    );
    mockPrisma.product.findMany.mockResolvedValue(products);

    const result = await searchProducts({ limit: 20 });
    expect(result.products).toHaveLength(20);
    expect(result.nextCursor).toBe("p19");
  });

  it("cursor-based pagination: null nextCursor at end", async () => {
    mockPrisma.product.findMany.mockResolvedValue([makeProduct()]);

    const result = await searchProducts({ limit: 20 });
    expect(result.products).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it("uses cache on repeated calls", async () => {
    mockPrisma.product.findMany.mockResolvedValue([makeProduct()]);

    await searchProducts({ query: "cached-test" });
    await searchProducts({ query: "cached-test" });

    // Only one DB call due to caching
    expect(mockPrisma.product.findMany).toHaveBeenCalledTimes(1);
  });

  it("falls back to Prisma when FTS throws", async () => {
    mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error("no pg_trgm"));
    mockPrisma.product.findMany.mockResolvedValue([makeProduct()]);

    const result = await searchProducts({ query: "cordless drill" });
    expect(result.products).toHaveLength(1);
  });

  it("uses FTS with ranking when $queryRawUnsafe succeeds", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: "fts-1",
        name: "Cordless Drill",
        slug: "cordless-drill",
        description: "A great drill",
        categoryId: "cat1",
        minOrderQuantity: null,
        categoryName: "Power Tools",
        rank: 0.5,
      },
    ]);
    mockPrisma.productVariant.findMany.mockResolvedValue([
      { productId: "fts-1", baseRetailPrice: { toString: () => "129.99" } },
    ]);
    mockPrisma.productImage.findMany.mockResolvedValue([
      { productId: "fts-1", url: "/uploads/drill.jpg" },
    ]);

    const result = await searchProducts({ query: "cordless drill set" });

    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe("Cordless Drill");
    expect(result.products[0].primaryImageUrl).toBe("/uploads/drill.jpg");
    expect(result.products[0].priceRange).toEqual({ min: 129.99, max: 129.99 });
  });

  it("FTS handles category filter", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    mockPrisma.productVariant.findMany.mockResolvedValue([]);
    mockPrisma.productImage.findMany.mockResolvedValue([]);

    await searchProducts({ query: "power drill", categoryId: "cat-xyz" });

    // Verify the raw query was called (FTS path)
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
  });

  it("FTS handles cursor", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    mockPrisma.productVariant.findMany.mockResolvedValue([]);
    mockPrisma.productImage.findMany.mockResolvedValue([]);

    await searchProducts({ query: "hammer tool", cursor: "some-id" });
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
  });

  it("FTS handles empty tsquery gracefully", async () => {
    // Query with only special chars → empty tsQuery → falls back to Prisma
    mockPrisma.product.findMany.mockResolvedValue([]);

    const result = await searchProducts({ query: "!@#" });
    expect(result.products).toHaveLength(0);
  });
});

describe("searchSuggestions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns suggestions for 2+ char query", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: "p1", name: "Drill", slug: "drill", category: { name: "Tools" } },
    ]);

    const result = await searchSuggestions("dr");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Drill");
  });

  it("returns empty for short query", async () => {
    const result = await searchSuggestions("d");
    expect(result).toEqual([]);
  });

  it("returns empty for empty query", async () => {
    const result = await searchSuggestions("");
    expect(result).toEqual([]);
  });
});
