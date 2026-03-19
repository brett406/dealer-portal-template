import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  cart: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  cartItem: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  },
  productVariant: { findUnique: vi.fn() },
  productUOM: { findUnique: vi.fn() },
  priceLevel: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { getCart, addToCart, updateCartItemQuantity, removeCartItem, clearCart } =
  await import("@/lib/cart");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyCart = { id: "cart-1", customerId: "cust-1", items: [] };

function makeVariant(overrides = {}) {
  return {
    id: "v1",
    productId: "p1",
    active: true,
    product: { id: "p1", active: true, minOrderQuantity: null },
    ...overrides,
  };
}

function makeUOM(overrides = {}) {
  return { id: "uom-1", productId: "p1", name: "Each", conversionFactor: 1, ...overrides };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("getCart", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing cart", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(emptyCart);

    const cart = await getCart("cust-1");
    expect(cart.id).toBe("cart-1");
    expect(mockPrisma.cart.create).not.toHaveBeenCalled();
  });

  it("creates cart if none exists", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(null);
    mockPrisma.cart.create.mockResolvedValue(emptyCart);

    const cart = await getCart("cust-1");
    expect(cart.id).toBe("cart-1");
    expect(mockPrisma.cart.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { customerId: "cust-1" } }),
    );
  });

  it("cart is unique per customer", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(emptyCart);

    await getCart("cust-1");
    expect(mockPrisma.cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: "cust-1" } }),
    );
  });
});

describe("addToCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.productVariant.findUnique.mockResolvedValue(makeVariant());
    mockPrisma.productUOM.findUnique.mockResolvedValue(makeUOM());
    mockPrisma.cart.findUnique.mockResolvedValue(emptyCart);
    mockPrisma.cartItem.create.mockResolvedValue({ id: "ci-1" });
  });

  it("adds item to empty cart", async () => {
    const result = await addToCart("cust-1", "v1", "uom-1", 3);
    expect(result).toEqual({ success: true });
    expect(mockPrisma.cartItem.create).toHaveBeenCalledWith({
      data: { cartId: "cart-1", variantId: "v1", uomId: "uom-1", quantity: 3 },
    });
  });

  it("same variant+UOM increments quantity", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue({
      ...emptyCart,
      items: [{ id: "ci-1", variantId: "v1", uomId: "uom-1", quantity: 2 }],
    });

    const result = await addToCart("cust-1", "v1", "uom-1", 3);
    expect(result).toEqual({ success: true });
    expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: "ci-1" },
      data: { quantity: 5 },
    });
    expect(mockPrisma.cartItem.create).not.toHaveBeenCalled();
  });

  it("same variant, different UOM creates separate line", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue({
      ...emptyCart,
      items: [{ id: "ci-1", variantId: "v1", uomId: "uom-each", quantity: 2 }],
    });

    const result = await addToCart("cust-1", "v1", "uom-box", 1);
    expect(result).toEqual({ success: true });
    expect(mockPrisma.cartItem.create).toHaveBeenCalled();
    expect(mockPrisma.cartItem.update).not.toHaveBeenCalled();
  });
});

describe("removeCartItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes item", async () => {
    mockPrisma.cartItem.delete.mockResolvedValue({});

    await removeCartItem("ci-1");
    expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: "ci-1" } });
  });
});

describe("updateCartItemQuantity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates quantity", async () => {
    mockPrisma.cartItem.update.mockResolvedValue({});

    const result = await updateCartItemQuantity("ci-1", 5);
    expect(result).toEqual({ success: true });
    expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: "ci-1" },
      data: { quantity: 5 },
    });
  });

  it("deletes item when quantity is 0", async () => {
    mockPrisma.cartItem.delete.mockResolvedValue({});

    const result = await updateCartItemQuantity("ci-1", 0);
    expect(result).toEqual({ success: true });
    expect(mockPrisma.cartItem.delete).toHaveBeenCalled();
  });
});

describe("clearCart", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes all items from cart", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue({ id: "cart-1" });
    mockPrisma.cartItem.deleteMany.mockResolvedValue({});

    await clearCart("cust-1");
    expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart-1" },
    });
  });
});
