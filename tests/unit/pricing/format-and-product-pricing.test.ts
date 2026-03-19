import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  product: { findUnique: vi.fn() },
  priceLevel: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { formatPrice, getProductPricing } = await import("@/lib/pricing");
const { invalidateAll } = await import("@/lib/cache");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("formatPrice", () => {
  it("formats a whole number", () => {
    expect(formatPrice(100)).toBe("$100.00");
  });

  it("formats with cents", () => {
    expect(formatPrice(49.99)).toBe("$49.99");
  });

  it("formats zero", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("rounds to 2 decimal places", () => {
    expect(formatPrice(10.999)).toBe("$11.00");
    expect(formatPrice(10.994)).toBe("$10.99");
  });
});

describe("getProductPricing", () => {
  beforeEach(() => { vi.clearAllMocks(); invalidateAll(); });

  it("returns null when product not found", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.priceLevel.findUnique.mockResolvedValue({ id: "pl-1", name: "Retail", discountPercent: { toString: () => "0" } });

    const result = await getProductPricing("missing", "pl-1");
    expect(result).toBeNull();
  });

  it("returns null when price level not found", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: "p1", name: "Test", variants: [], unitsOfMeasure: [] });
    mockPrisma.priceLevel.findUnique.mockResolvedValue(null);

    const result = await getProductPricing("p1", "missing");
    expect(result).toBeNull();
  });

  it("returns full pricing for all variants and UOMs", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "Test Drill",
      variants: [
        { id: "v1", name: "Standard", sku: "DRILL-STD", baseRetailPrice: { toString: () => "100" } },
        { id: "v2", name: "Pro", sku: "DRILL-PRO", baseRetailPrice: { toString: () => "150" } },
      ],
      unitsOfMeasure: [
        { id: "uom-1", name: "Each", conversionFactor: 1, priceOverride: null },
        { id: "uom-2", name: "Box", conversionFactor: 12, priceOverride: null },
      ],
    });
    mockPrisma.priceLevel.findUnique.mockResolvedValue({
      id: "pl-1",
      name: "Dealer",
      discountPercent: { toString: () => "20" },
    });

    const result = await getProductPricing("p1", "pl-1");

    expect(result).not.toBeNull();
    expect(result!.productName).toBe("Test Drill");
    expect(result!.priceLevelName).toBe("Dealer");
    expect(result!.discountPercent).toBe(20);
    expect(result!.variants).toHaveLength(2);

    // Standard variant
    const std = result!.variants[0];
    expect(std.variantName).toBe("Standard");
    expect(std.uomPrices).toHaveLength(2);

    // Each: 100 * 0.8 = 80
    expect(std.uomPrices[0].uomName).toBe("Each");
    expect(std.uomPrices[0].retailPrice).toBe(100);
    expect(std.uomPrices[0].customerPrice).toBe(80);

    // Box: 100 * 12 = 1200, 1200 * 0.8 = 960
    expect(std.uomPrices[1].uomName).toBe("Box");
    expect(std.uomPrices[1].retailPrice).toBe(1200);
    expect(std.uomPrices[1].customerPrice).toBe(960);
  });

  it("handles price override on UOM", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "Test",
      variants: [
        { id: "v1", name: "Std", sku: "X", baseRetailPrice: { toString: () => "10" } },
      ],
      unitsOfMeasure: [
        { id: "uom-1", name: "Box", conversionFactor: 12, priceOverride: { toString: () => "99.99" } },
      ],
    });
    mockPrisma.priceLevel.findUnique.mockResolvedValue({
      id: "pl-1",
      name: "Retail",
      discountPercent: { toString: () => "0" },
    });

    const result = await getProductPricing("p1", "pl-1");
    expect(result!.variants[0].uomPrices[0].retailPrice).toBe(99.99);
    expect(result!.variants[0].uomPrices[0].customerPrice).toBe(99.99);
  });
});
