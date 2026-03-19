import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const txOrder = { create: vi.fn() };
const txStatusHistory = { create: vi.fn() };
const txVariant = { update: vi.fn() };
const txCartItem = { deleteMany: vi.fn() };

const mockPrisma = {
  cart: { findUnique: vi.fn() },
  customer: { findUnique: vi.fn() },
  productVariant: { findUnique: vi.fn() },
  order: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn({
      order: txOrder,
      orderStatusHistory: txStatusHistory,
      productVariant: txVariant,
      cartItem: txCartItem,
    });
  }),
  pageContent: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { createOrderFromCart } = await import("@/lib/orders");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupMocks() {
  mockPrisma.cart.findUnique.mockResolvedValue({
    id: "cart-1",
    customerId: "cust-1",
    items: [
      {
        id: "ci-1",
        variantId: "v1",
        quantity: 2,
        variant: {
          id: "v1",
          name: "Standard",
          sku: "SKU-001",
          baseRetailPrice: { toString: () => "100" },
          active: true,
          product: { id: "p1", name: "Test Product", active: true },
        },
        uom: {
          id: "uom-1",
          name: "Each",
          conversionFactor: 1,
          priceOverride: null,
        },
      },
    ],
  });

  mockPrisma.customer.findUnique.mockResolvedValue({
    id: "cust-1",
    userId: "user-1",
    companyId: "co-1",
    company: {
      id: "co-1",
      priceLevel: {
        id: "pl-1",
        name: "Dealer",
        discountPercent: { toString: () => "20" },
      },
    },
  });

  mockPrisma.productVariant.findUnique.mockResolvedValue({
    stockQuantity: 100,
    name: "Standard",
  });

  mockPrisma.order.findFirst.mockResolvedValue(null); // no previous orders
  mockPrisma.pageContent.findUnique.mockResolvedValue({
    payload: { shippingMethod: "flat", flatShippingRate: "15.00" },
  });

  txOrder.create.mockResolvedValue({
    id: "order-1",
    orderNumber: "ORD-2026-0001",
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createOrderFromCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("creates order with correct totals", async () => {
    const result = await createOrderFromCart("cust-1");

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Verify order was created
    const createCall = txOrder.create.mock.calls[0][0];
    // Unit price: 100 * 0.8 = 80, line total: 80 * 2 = 160, shipping: 15, total: 175
    expect(createCall.data.subtotal).toBe(160);
    expect(createCall.data.shippingCost).toBe(15);
    expect(createCall.data.total).toBe(175);
  });

  it("snapshot data is all captured correctly", async () => {
    const result = await createOrderFromCart("cust-1");
    expect(result.success).toBe(true);

    const createCall = txOrder.create.mock.calls[0][0];
    expect(createCall.data.priceLevelSnapshot).toBe("Dealer");
    expect(createCall.data.discountPercentSnapshot).toBe(20);

    const item = createCall.data.items.create[0];
    expect(item.productNameSnapshot).toBe("Test Product");
    expect(item.variantNameSnapshot).toBe("Standard");
    expect(item.skuSnapshot).toBe("SKU-001");
    expect(item.uomNameSnapshot).toBe("Each");
    expect(item.uomConversionSnapshot).toBe(1);
    expect(item.baseRetailPriceSnapshot).toBe(100);
  });

  it("clears cart after order", async () => {
    await createOrderFromCart("cust-1");

    expect(txCartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart-1" },
    });
  });

  it("initial status is RECEIVED", async () => {
    await createOrderFromCart("cust-1");

    const createCall = txOrder.create.mock.calls[0][0];
    expect(createCall.data.status).toBe("RECEIVED");
  });

  it("creates initial status history entry", async () => {
    await createOrderFromCart("cust-1");

    expect(txStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "RECEIVED",
        notes: "Order placed",
      }),
    });
  });

  it("records placedByAdminId when admin places order", async () => {
    const result = await createOrderFromCart("cust-1", {
      placedByAdminId: "admin-1",
    });

    expect(result.success).toBe(true);
    const createCall = txOrder.create.mock.calls[0][0];
    expect(createCall.data.placedByAdminId).toBe("admin-1");

    // Status history should use admin's ID
    expect(txStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ changedById: "admin-1" }),
    });
  });

  it("placedByAdminId is null for normal customer orders", async () => {
    await createOrderFromCart("cust-1");

    const createCall = txOrder.create.mock.calls[0][0];
    expect(createCall.data.placedByAdminId).toBeNull();

    // Status history should use customer's userId
    expect(txStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ changedById: "user-1" }),
    });
  });

  it("fails when cart is empty", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue({ id: "cart-1", items: [] });

    const result = await createOrderFromCart("cust-1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/empty/i);
  });

  it("fails when product is inactive", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue({
      id: "cart-1",
      items: [
        {
          id: "ci-1",
          variantId: "v1",
          quantity: 1,
          variant: {
            id: "v1", name: "X", sku: "X", baseRetailPrice: { toString: () => "10" },
            active: true,
            product: { id: "p1", name: "Inactive Product", active: false },
          },
          uom: { id: "uom-1", name: "Each", conversionFactor: 1, priceOverride: null },
        },
      ],
    });

    const result = await createOrderFromCart("cust-1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/no longer available/i);
  });
});
