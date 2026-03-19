import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  order: { findUnique: vi.fn() },
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
    mockPrisma.cart.findUnique.mockResolvedValue({ id: "cart-1" });
    mockPrisma.cartItem.findUnique.mockResolvedValue(null);
    mockPrisma.cartItem.create.mockResolvedValue({});
  });

  it("copies all items from previous order to cart", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
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
    mockPrisma.order.findUnique.mockResolvedValue({
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
    mockPrisma.order.findUnique.mockResolvedValue({
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
    mockPrisma.order.findUnique.mockResolvedValue({
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

    mockPrisma.order.findUnique.mockResolvedValue({
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
});
