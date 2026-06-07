import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  // reorderToCart now scopes the order to the caller's company (IDOR fix), so it
  // looks up the customer's companyId and uses order.findFirst with that filter.
  customer: { findUnique: vi.fn() },
  order: { findFirst: vi.fn() },
  cart: { findUnique: vi.fn(), create: vi.fn() },
  cartItem: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { reorderToCart } = await import("@/lib/orders");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOrderItem(overrides: Record<string, unknown> = {}) {
  return {
    variantId: "v1",
    quantity: 2,
    uomNameSnapshot: "Each",
    variant: {
      id: "v1",
      active: true,
      product: {
        id: "p1",
        active: true,
        unitsOfMeasure: [{ id: "uom-1", name: "Each" }],
      },
    },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("reorderToCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.customer.findUnique.mockResolvedValue({ companyId: "co-1" });
    mockPrisma.cart.findUnique.mockResolvedValue({ id: "cart-1" });
    mockPrisma.cartItem.findUnique.mockResolvedValue(null);
    mockPrisma.cartItem.create.mockResolvedValue({});
  });

  it("copies all items from previous order to cart", async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "ord-1",
      items: [
        makeOrderItem({ variantId: "v1", quantity: 2, uomNameSnapshot: "Each" }),
        makeOrderItem({ variantId: "v2", quantity: 5, uomNameSnapshot: "Each",
          variant: { id: "v2", active: true, product: { id: "p2", active: true, unitsOfMeasure: [{ id: "uom-2", name: "Each" }] } }
        }),
      ],
    });

    const result = await reorderToCart("ord-1", "cust-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.addedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
    }
    expect(mockPrisma.cartItem.create).toHaveBeenCalledTimes(2);
  });

  it("skips inactive products", async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "ord-1",
      items: [
        makeOrderItem({
          variant: { id: "v1", active: true, product: { id: "p1", active: false, unitsOfMeasure: [{ id: "uom-1", name: "Each" }] } },
        }),
      ],
    });

    const result = await reorderToCart("ord-1", "cust-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.addedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
    }
  });

  it("skips inactive variants", async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "ord-1",
      items: [
        makeOrderItem({
          variant: { id: "v1", active: false, product: { id: "p1", active: true, unitsOfMeasure: [{ id: "uom-1", name: "Each" }] } },
        }),
      ],
    });

    const result = await reorderToCart("ord-1", "cust-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.addedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
    }
  });

  it("uses current UOMs (not historical)", async () => {
    // Order had "Box" UOM but product no longer has it
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "ord-1",
      items: [
        makeOrderItem({
          uomNameSnapshot: "Box",
          variant: { id: "v1", active: true, product: { id: "p1", active: true, unitsOfMeasure: [{ id: "uom-1", name: "Each" }] } },
        }),
      ],
    });

    const result = await reorderToCart("ord-1", "cust-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.skippedCount).toBe(1); // Box UOM no longer exists
    }
  });

  it("merges with existing cart items", async () => {
    // Cart already has 3 of variant v1 Each
    mockPrisma.cartItem.findUnique.mockResolvedValue({ id: "ci-1", quantity: 3 });
    mockPrisma.cartItem.update.mockResolvedValue({});

    mockPrisma.order.findFirst.mockResolvedValue({
      id: "ord-1",
      items: [makeOrderItem({ quantity: 2 })], // add 2 more
    });

    const result = await reorderToCart("ord-1", "cust-1");
    expect(result.success).toBe(true);

    // Should update, not create
    expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: "ci-1" },
      data: { quantity: 5 }, // 3 + 2
    });
    expect(mockPrisma.cartItem.create).not.toHaveBeenCalled();
  });

  it("does not reorder an order from another company (IDOR fix)", async () => {
    // The order belongs to a different company, so the companyId-scoped
    // findFirst returns nothing — even though the orderId is valid.
    mockPrisma.customer.findUnique.mockResolvedValue({ companyId: "co-1" });
    mockPrisma.order.findFirst.mockResolvedValue(null);

    const result = await reorderToCart("other-companys-order", "cust-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Order not found");
    }
    // The scoping filter must be present on the query.
    expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "other-companys-order", companyId: "co-1" }),
      }),
    );
    expect(mockPrisma.cartItem.create).not.toHaveBeenCalled();
    expect(mockPrisma.cartItem.update).not.toHaveBeenCalled();
  });
});
