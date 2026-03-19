import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
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
  productVariant: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
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

const { addVariant, deleteVariant } = await import("@/app/admin/products/actions");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("addVariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.productVariant.findFirst.mockResolvedValue(null);
    mockPrisma.productVariant.create.mockResolvedValue({ id: "var-new" });
  });

  it("creates variant with unique SKU", async () => {
    const result = await addVariant(
      "prod-1",
      makeFormData({
        name: "Large",
        sku: "PROD-LG",
        baseRetailPrice: "29.99",
        stockQuantity: "100",
        lowStockThreshold: "5",
      }),
    );

    expect(result.error).toBeUndefined();
    expect(mockPrisma.productVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: "prod-1",
        name: "Large",
        sku: "PROD-LG",
        baseRetailPrice: 29.99,
        stockQuantity: 100,
      }),
    });
  });

  it("rejects duplicate SKU", async () => {
    mockPrisma.productVariant.findFirst.mockResolvedValue({ id: "existing", sku: "PROD-LG" });

    const result = await addVariant(
      "prod-1",
      makeFormData({
        name: "Large",
        sku: "PROD-LG",
        baseRetailPrice: "29.99",
        stockQuantity: "100",
        lowStockThreshold: "5",
      }),
    );

    expect(result.errors?.sku).toMatch(/already exists/i);
  });
});

describe("deleteVariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cannot delete variant in active orders (RECEIVED)", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      id: "var-1",
      productId: "prod-1",
      orderItems: [{ order: { status: "RECEIVED" } }],
      cartItems: [],
    });

    const result = await deleteVariant("var-1");
    expect(result.error).toMatch(/active order/i);
    expect(mockPrisma.productVariant.delete).not.toHaveBeenCalled();
  });

  it("cannot delete variant in active orders (PROCESSING)", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      id: "var-1",
      productId: "prod-1",
      orderItems: [{ order: { status: "PROCESSING" } }],
      cartItems: [],
    });

    const result = await deleteVariant("var-1");
    expect(result.error).toMatch(/active order/i);
  });

  it("can delete variant only in DELIVERED/CANCELLED orders", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      id: "var-1",
      productId: "prod-1",
      orderItems: [
        { order: { status: "DELIVERED" } },
        { order: { status: "CANCELLED" } },
      ],
      cartItems: [],
    });
    mockPrisma.productVariant.delete.mockResolvedValue({});

    const result = await deleteVariant("var-1");
    expect(result.error).toBeUndefined();
    expect(mockPrisma.productVariant.delete).toHaveBeenCalledWith({
      where: { id: "var-1" },
    });
  });
});
