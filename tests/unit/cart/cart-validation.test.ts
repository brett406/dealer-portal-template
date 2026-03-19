import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  cart: { findUnique: vi.fn(), create: vi.fn() },
  cartItem: { create: vi.fn(), update: vi.fn() },
  productVariant: { findUnique: vi.fn() },
  productUOM: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { addToCart } = await import("@/lib/cart");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyCart = { id: "cart-1", customerId: "cust-1", items: [] };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("addToCart validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.cart.findUnique.mockResolvedValue(emptyCart);
    mockPrisma.cartItem.create.mockResolvedValue({ id: "ci-1" });
  });

  it("rejects inactive product", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      id: "v1", productId: "p1", active: true,
      product: { id: "p1", active: false, minOrderQuantity: null },
    });
    mockPrisma.productUOM.findUnique.mockResolvedValue({ id: "uom-1", productId: "p1" });

    const result = await addToCart("cust-1", "v1", "uom-1", 1);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/product.*no longer/i);
  });

  it("rejects inactive variant", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      id: "v1", productId: "p1", active: false,
      product: { id: "p1", active: true, minOrderQuantity: null },
    });
    mockPrisma.productUOM.findUnique.mockResolvedValue({ id: "uom-1", productId: "p1" });

    const result = await addToCart("cust-1", "v1", "uom-1", 1);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/variant.*no longer/i);
  });

  it("rejects quantity ≤ 0", async () => {
    const result = await addToCart("cust-1", "v1", "uom-1", 0);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/greater than 0/i);

    const result2 = await addToCart("cust-1", "v1", "uom-1", -1);
    expect(result2).toHaveProperty("error");
  });

  it("validates min order quantity", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      id: "v1", productId: "p1", active: true,
      product: { id: "p1", active: true, minOrderQuantity: 6 },
    });
    mockPrisma.productUOM.findUnique.mockResolvedValue({ id: "uom-1", productId: "p1" });

    const result = await addToCart("cust-1", "v1", "uom-1", 3);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/minimum.*6/i);
  });

  it("validates UOM belongs to product", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      id: "v1", productId: "p1", active: true,
      product: { id: "p1", active: true, minOrderQuantity: null },
    });
    // UOM belongs to different product
    mockPrisma.productUOM.findUnique.mockResolvedValue({ id: "uom-1", productId: "p-other" });

    const result = await addToCart("cust-1", "v1", "uom-1", 1);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/does not belong/i);
  });

  it("validates variant exists", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(null);

    const result = await addToCart("cust-1", "v-missing", "uom-1", 1);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/variant not found/i);
  });
});
