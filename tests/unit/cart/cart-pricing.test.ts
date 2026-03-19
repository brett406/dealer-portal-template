import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  cart: { findUnique: vi.fn(), create: vi.fn() },
  priceLevel: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { getCartWithPricing } = await import("@/lib/cart");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCartWithItems(items: unknown[]) {
  return {
    id: "cart-1",
    customerId: "cust-1",
    items,
  };
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "ci-1",
    variantId: "v1",
    uomId: "uom-1",
    quantity: 1,
    variant: {
      name: "Standard",
      sku: "SKU-001",
      baseRetailPrice: { toString: () => "100" },
      active: true,
      stockQuantity: 100,
      product: { id: "p1", name: "Test Product", active: true, minOrderQuantity: null },
    },
    uom: {
      id: "uom-1",
      name: "Each",
      conversionFactor: 1,
      priceOverride: null,
    },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("getCartWithPricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.priceLevel.findUnique.mockResolvedValue({
      id: "pl-1",
      name: "Dealer",
      discountPercent: { toString: () => "20" },
    });
  });

  it("correct per-item pricing for price level (20% discount)", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(
      makeCartWithItems([makeItem({ quantity: 2 })]),
    );

    const result = await getCartWithPricing("cust-1", "pl-1");

    expect(result.items[0].retailPrice).toBe(100);
    expect(result.items[0].customerPrice).toBe(80); // 100 * 0.8
    expect(result.items[0].lineTotal).toBe(160); // 80 * 2
  });

  it("cart total sums correctly", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(
      makeCartWithItems([
        makeItem({ id: "ci-1", quantity: 2 }),
        makeItem({
          id: "ci-2",
          variantId: "v2",
          uomId: "uom-2",
          quantity: 3,
          variant: {
            name: "Large",
            sku: "SKU-002",
            baseRetailPrice: { toString: () => "50" },
            product: { id: "p1", name: "Test Product", active: true, minOrderQuantity: null },
          },
          uom: { id: "uom-2", name: "Each", conversionFactor: 1, priceOverride: null },
        }),
      ]),
    );

    const result = await getCartWithPricing("cust-1", "pl-1");

    // Item 1: 100 * 0.8 * 2 = 160
    // Item 2: 50 * 0.8 * 3 = 120
    expect(result.subtotal).toBe(280);
  });

  it("shows retail alongside customer price", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(
      makeCartWithItems([makeItem()]),
    );

    const result = await getCartWithPricing("cust-1", "pl-1");

    expect(result.items[0].retailPrice).toBe(100);
    expect(result.items[0].customerPrice).toBe(80);
    expect(result.discountPercent).toBe(20);
    expect(result.priceLevelName).toBe("Dealer");
  });

  it("handles Box UOM with conversion factor", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(
      makeCartWithItems([
        makeItem({
          quantity: 2,
          uom: { id: "uom-box", name: "Box", conversionFactor: 12, priceOverride: null },
        }),
      ]),
    );

    const result = await getCartWithPricing("cust-1", "pl-1");

    // Retail: 100 * 12 = 1200, Customer: 1200 * 0.8 = 960
    expect(result.items[0].retailPrice).toBe(1200);
    expect(result.items[0].customerPrice).toBe(960);
    expect(result.items[0].lineTotal).toBe(1920); // 960 * 2
    expect(result.items[0].baseUnitQuantity).toBe(24); // 2 * 12
  });

  it("handles price override UOM", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(
      makeCartWithItems([
        makeItem({
          quantity: 1,
          uom: {
            id: "uom-box",
            name: "Box",
            conversionFactor: 12,
            priceOverride: { toString: () => "99.99" },
          },
        }),
      ]),
    );

    const result = await getCartWithPricing("cust-1", "pl-1");

    // Override price: 99.99, Customer: 99.99 * 0.8 = 79.99
    expect(result.items[0].retailPrice).toBe(99.99);
    expect(result.items[0].customerPrice).toBe(79.99);
  });

  it("includes warning for inactive product", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(
      makeCartWithItems([
        makeItem({
          variant: {
            name: "Std",
            sku: "SKU-1",
            baseRetailPrice: { toString: () => "100" },
            active: true,
            stockQuantity: 50,
            product: { id: "p1", name: "Inactive Prod", active: false, minOrderQuantity: null },
          },
        }),
      ]),
    );

    const result = await getCartWithPricing("cust-1", "pl-1");
    expect(result.items[0].warnings).toContain("This product is no longer available");
    expect(result.canSubmit).toBe(false);
    expect(result.hasWarnings).toBe(true);
  });

  it("includes warning for inactive variant", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(
      makeCartWithItems([
        makeItem({
          variant: {
            name: "Std",
            sku: "SKU-1",
            baseRetailPrice: { toString: () => "100" },
            active: false,
            stockQuantity: 50,
            product: { id: "p1", name: "Prod", active: true, minOrderQuantity: null },
          },
        }),
      ]),
    );

    const result = await getCartWithPricing("cust-1", "pl-1");
    expect(result.items[0].warnings).toContain("This variant is no longer available");
    expect(result.canSubmit).toBe(false);
  });

  it("includes warning for out of stock", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(
      makeCartWithItems([
        makeItem({
          variant: {
            name: "Std",
            sku: "SKU-1",
            baseRetailPrice: { toString: () => "100" },
            active: true,
            stockQuantity: 0,
            product: { id: "p1", name: "Prod", active: true, minOrderQuantity: null },
          },
        }),
      ]),
    );

    const result = await getCartWithPricing("cust-1", "pl-1");
    expect(result.items[0].warnings).toContain("Out of stock");
  });

  it("includes warning for insufficient stock", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(
      makeCartWithItems([
        makeItem({
          quantity: 10,
          variant: {
            name: "Std",
            sku: "SKU-1",
            baseRetailPrice: { toString: () => "100" },
            active: true,
            stockQuantity: 5,
            product: { id: "p1", name: "Prod", active: true, minOrderQuantity: null },
          },
        }),
      ]),
    );

    const result = await getCartWithPricing("cust-1", "pl-1");
    expect(result.items[0].warnings).toContain("Only 5 units available");
  });

  it("canSubmit is true when all items are healthy", async () => {
    mockPrisma.cart.findUnique.mockResolvedValue(
      makeCartWithItems([makeItem()]),
    );

    const result = await getCartWithPricing("cust-1", "pl-1");
    expect(result.canSubmit).toBe(true);
    expect(result.hasWarnings).toBe(false);
  });
});
