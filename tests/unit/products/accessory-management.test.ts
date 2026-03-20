import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const mockRevalidate = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => mockRevalidate(...args) }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: "admin-1", email: "admin@test.com", name: "Admin", role: "SUPER_ADMIN", mustChangePassword: false },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
  ),
}));

const mockPrisma = {
  product: { findMany: vi.fn() },
  productAccessory: {
    create: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ─── Import after mocks ──────────────────────────────────────────────────────

const {
  addAccessory,
  removeAccessory,
  searchProductsForAccessory,
  reorderAccessories,
} = await import("@/app/admin/products/actions");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("addAccessory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.productAccessory.count.mockResolvedValue(0);
    mockPrisma.productAccessory.create.mockResolvedValue({ id: "pa-new" });
  });

  it("creates accessory link between two products", async () => {
    const result = await addAccessory("prod-1", "prod-2");

    expect(result.success).toBe(true);
    expect(mockPrisma.productAccessory.create).toHaveBeenCalledWith({
      data: { productId: "prod-1", accessoryId: "prod-2", sortOrder: 0 },
    });
  });

  it("sets sortOrder to next value", async () => {
    mockPrisma.productAccessory.count.mockResolvedValue(3);

    await addAccessory("prod-1", "prod-2");

    expect(mockPrisma.productAccessory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sortOrder: 3 }),
    });
  });

  it("revalidates the product edit page path", async () => {
    await addAccessory("prod-1", "prod-2");
    expect(mockRevalidate).toHaveBeenCalledWith("/admin/products/prod-1");
  });
});

describe("removeAccessory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the accessory link", async () => {
    mockPrisma.productAccessory.findUnique.mockResolvedValue({
      id: "pa-1",
      productId: "prod-1",
    });
    mockPrisma.productAccessory.delete.mockResolvedValue({});

    const result = await removeAccessory("pa-1");
    expect(result.error).toBeUndefined();
    expect(mockPrisma.productAccessory.delete).toHaveBeenCalledWith({
      where: { id: "pa-1" },
    });
  });

  it("returns error for non-existent link", async () => {
    mockPrisma.productAccessory.findUnique.mockResolvedValue(null);
    const result = await removeAccessory("missing");
    expect(result.error).toMatch(/not found/i);
  });
});

describe("searchProductsForAccessory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.productAccessory.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([]);
  });

  it("excludes already-linked accessories", async () => {
    mockPrisma.productAccessory.findMany.mockResolvedValue([
      { accessoryId: "prod-linked" },
    ]);

    await searchProductsForAccessory("prod-1", "drill");

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: expect.arrayContaining(["prod-1", "prod-linked"]) },
        }),
      }),
    );
  });

  it("only returns active products", async () => {
    await searchProductsForAccessory("prod-1", "drill");

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      }),
    );
  });

  it("limits results to 10", async () => {
    await searchProductsForAccessory("prod-1", "drill");

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it("returns correct shape for each result", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Drill",
        variants: [{ sku: "SKU-1" }],
        images: [{ url: "/img.jpg" }],
      },
    ]);

    const results = await searchProductsForAccessory("prod-1", "drill");

    expect(results[0]).toEqual({
      id: "p1",
      name: "Drill",
      sku: "SKU-1",
      imageUrl: "/img.jpg",
    });
  });

  it("returns empty for short queries", async () => {
    const results = await searchProductsForAccessory("prod-1", "d");
    expect(results).toEqual([]);
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
  });
});

describe("reorderAccessories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  it("updates sortOrder for each accessory", async () => {
    await reorderAccessories("prod-1", ["id-c", "id-a", "id-b"]);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const txArgs = mockPrisma.$transaction.mock.calls[0][0];
    expect(txArgs).toHaveLength(3);
  });

  it("revalidates the product page", async () => {
    await reorderAccessories("prod-1", ["id-a"]);
    expect(mockRevalidate).toHaveBeenCalledWith("/admin/products/prod-1");
  });
});
