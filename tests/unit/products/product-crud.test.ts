import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error("REDIRECT");
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
  product: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  productUOM: {
    create: vi.fn(),
  },
  productImage: {
    deleteMany: vi.fn(),
  },
  productVariant: {
    deleteMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

// ─── Import after mocks ──────────────────────────────────────────────────────

const { createProduct } = await import("@/app/admin/products/actions");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: "prod-new" });
    mockPrisma.productUOM.create.mockResolvedValue({ id: "uom-new" });
    mockRedirect.mockClear();
  });

  it("creates product with valid data and redirects", async () => {
    await expect(
      createProduct(
        {},
        makeFormData({
          name: "Test Product",
          slug: "test-product",
          categoryId: "cat-1",
          description: "",
          sortOrder: "0",
        }),
      ),
    ).rejects.toThrow("REDIRECT");

    expect(mockPrisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Test Product",
        slug: "test-product",
        categoryId: "cat-1",
      }),
    });
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining("/admin/products/"));
  });

  it("auto-creates default Each UOM on product creation", async () => {
    await expect(
      createProduct(
        {},
        makeFormData({
          name: "UOM Test",
          slug: "uom-test",
          categoryId: "cat-1",
          description: "",
          sortOrder: "0",
        }),
      ),
    ).rejects.toThrow("REDIRECT");

    expect(mockPrisma.productUOM.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: "prod-new",
        name: "Each",
        conversionFactor: 1,
        sortOrder: 0,
      }),
    });
  });

  it("product slug auto-generates and must be unique", async () => {
    mockPrisma.product.findFirst.mockResolvedValue({ id: "existing", slug: "test-product" });

    const result = await createProduct(
      {},
      makeFormData({
        name: "Test Product",
        slug: "test-product",
        categoryId: "cat-1",
        description: "",
        sortOrder: "0",
      }),
    );

    expect(result.errors?.slug).toMatch(/already exists/i);
  });

  it("cannot create product without category", async () => {
    const result = await createProduct(
      {},
      makeFormData({
        name: "No Category",
        slug: "no-category",
        categoryId: "",
        description: "",
        sortOrder: "0",
      }),
    );

    expect(result.errors?.categoryId).toBeDefined();
  });

  it("minimum order quantity is optional and must be positive when set", async () => {
    const result = await createProduct(
      {},
      makeFormData({
        name: "Bad MOQ",
        slug: "bad-moq",
        categoryId: "cat-1",
        description: "",
        sortOrder: "0",
        minOrderQuantity: "-1",
      }),
    );

    expect(result.errors?.minOrderQuantity).toBeDefined();
  });

  it("minimum order quantity accepts empty (optional)", async () => {
    await expect(
      createProduct(
        {},
        makeFormData({
          name: "No MOQ",
          slug: "no-moq",
          categoryId: "cat-1",
          description: "",
          sortOrder: "0",
          minOrderQuantity: "",
        }),
      ),
    ).rejects.toThrow("REDIRECT");
  });
});
