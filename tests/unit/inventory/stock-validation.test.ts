import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  productVariant: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { checkStockAvailability, checkCartStockAvailability } = await import("@/lib/inventory");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("checkStockAvailability", () => {
  beforeEach(() => vi.clearAllMocks());

  it("zero stock → out of stock", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      stockQuantity: 0,
      active: true,
      product: { active: true },
    });

    const result = await checkStockAvailability("v1", 5);
    expect(result.available).toBe(false);
    expect(result.currentStock).toBe(0);
    expect(result.requested).toBe(5);
  });

  it("validates against baseUnitQuantity not UOM quantity", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      stockQuantity: 30,
      active: true,
      product: { active: true },
    });

    // 3 boxes of 12 = 36 base units → not enough with only 30
    const result = await checkStockAvailability("v1", 36);
    expect(result.available).toBe(false);
    expect(result.currentStock).toBe(30);

    // 2 boxes of 12 = 24 base units → enough with 30
    const result2 = await checkStockAvailability("v1", 24);
    expect(result2.available).toBe(true);
  });

  it("inactive variant fails validation", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      stockQuantity: 100,
      active: false,
      product: { active: true },
    });

    const result = await checkStockAvailability("v1", 1);
    expect(result.available).toBe(false);
  });

  it("inactive product fails validation", async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      stockQuantity: 100,
      active: true,
      product: { active: false },
    });

    const result = await checkStockAvailability("v1", 1);
    expect(result.available).toBe(false);
  });
});

describe("checkCartStockAvailability", () => {
  it("validates across all items in cart (cumulative)", () => {
    const items = [
      {
        variantId: "v1",
        uomConversionFactor: 12,
        quantity: 3, // 36 base units
        variant: { active: true, stockQuantity: 50, product: { active: true } },
      },
      {
        variantId: "v1",
        uomConversionFactor: 1,
        quantity: 20, // 20 base units, total demand for v1 = 56
        variant: { active: true, stockQuantity: 50, product: { active: true } },
      },
    ];

    const result = checkCartStockAvailability(items);
    // Total demand for v1 = 56, but only 50 available
    expect(result.allAvailable).toBe(false);
  });

  it("inactive variant fails validation", () => {
    const items = [
      {
        variantId: "v1",
        uomConversionFactor: 1,
        quantity: 1,
        variant: { active: false, stockQuantity: 100, product: { active: true } },
      },
    ];

    const result = checkCartStockAvailability(items);
    expect(result.allAvailable).toBe(false);
    expect(result.items[0].reason).toMatch(/variant.*inactive/i);
  });

  it("inactive product fails validation", () => {
    const items = [
      {
        variantId: "v1",
        uomConversionFactor: 1,
        quantity: 1,
        variant: { active: true, stockQuantity: 100, product: { active: false } },
      },
    ];

    const result = checkCartStockAvailability(items);
    expect(result.allAvailable).toBe(false);
    expect(result.items[0].reason).toMatch(/product.*inactive/i);
  });
});
