import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  product: { findUnique: vi.fn() },
  priceLevel: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { formatPrice, resolveBasePrice, resolveUomOverride } = await import("@/lib/pricing");
const { getProductPricing } = await import("@/lib/pricing-server");
const { invalidateAll } = await import("@/lib/cache");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("formatPrice", () => {
  it("formats CAD with a CA$ prefix", () => {
    expect(formatPrice(100, "CAD")).toBe("CA$100.00");
    expect(formatPrice(49.99, "CAD")).toBe("CA$49.99");
  });

  it("formats USD with a US$ prefix", () => {
    expect(formatPrice(100, "USD")).toBe("US$100.00");
    expect(formatPrice(49.99, "USD")).toBe("US$49.99");
  });

  it("formats zero", () => {
    expect(formatPrice(0, "CAD")).toBe("CA$0.00");
  });

  it("rounds to 2 decimal places", () => {
    expect(formatPrice(10.999, "CAD")).toBe("CA$11.00");
    expect(formatPrice(10.994, "USD")).toBe("US$10.99");
  });
});

describe("resolveBasePrice", () => {
  it("returns the CAD price for CAD", () => {
    expect(resolveBasePrice("CAD", 100, 80)).toBe(100);
    expect(resolveBasePrice("CAD", 100, null)).toBe(100);
  });

  it("returns the USD price for USD", () => {
    expect(resolveBasePrice("USD", 100, 80)).toBe(80);
  });

  it("returns null for USD with no USD price (never falls back to CAD)", () => {
    expect(resolveBasePrice("USD", 100, null)).toBeNull();
  });
});

describe("resolveUomOverride", () => {
  it("picks the currency-appropriate override; null stays null", () => {
    expect(resolveUomOverride("CAD", 9, 7)).toBe(9);
    expect(resolveUomOverride("USD", 9, 7)).toBe(7);
    expect(resolveUomOverride("USD", 9, null)).toBeNull();
    expect(resolveUomOverride("CAD", null, 7)).toBeNull();
  });
});

describe("getProductPricing", () => {
  beforeEach(() => { vi.clearAllMocks(); invalidateAll(); });

  it("returns null when product not found", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.priceLevel.findUnique.mockResolvedValue({ id: "pl-1", name: "Retail", discountPercent: { toString: () => "0" } });

    const result = await getProductPricing("missing", "pl-1", "CAD");
    expect(result).toBeNull();
  });

  it("returns null when price level not found", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: "p1", name: "Test", variants: [], unitsOfMeasure: [] });
    mockPrisma.priceLevel.findUnique.mockResolvedValue(null);

    const result = await getProductPricing("p1", "missing", "CAD");
    expect(result).toBeNull();
  });

  it("returns full CAD pricing for all variants and UOMs", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "Test Drill",
      variants: [
        { id: "v1", name: "Standard", sku: "DRILL-STD", baseRetailPrice: { toString: () => "100" }, baseRetailPriceUsd: { toString: () => "80" } },
        { id: "v2", name: "Pro", sku: "DRILL-PRO", baseRetailPrice: { toString: () => "150" }, baseRetailPriceUsd: null },
      ],
      unitsOfMeasure: [
        { id: "uom-1", name: "Each", conversionFactor: 1, priceOverride: null, priceOverrideUsd: null },
        { id: "uom-2", name: "Box", conversionFactor: 12, priceOverride: null, priceOverrideUsd: null },
      ],
    });
    mockPrisma.priceLevel.findUnique.mockResolvedValue({
      id: "pl-1",
      name: "Dealer",
      discountPercent: { toString: () => "20" },
    });

    const result = await getProductPricing("p1", "pl-1", "CAD");

    expect(result).not.toBeNull();
    expect(result!.currency).toBe("CAD");
    expect(result!.variants).toHaveLength(2);

    const std = result!.variants[0];
    expect(std.pricedInCurrency).toBe(true);
    // Each: 100 * 0.8 = 80
    expect(std.uomPrices[0].retailPrice).toBe(100);
    expect(std.uomPrices[0].customerPrice).toBe(80);
    // Box: 100 * 12 = 1200, * 0.8 = 960
    expect(std.uomPrices[1].retailPrice).toBe(1200);
    expect(std.uomPrices[1].customerPrice).toBe(960);
  });

  it("prices in USD off the USD column, and flags a variant unpriced in USD", async () => {
    const product = {
      id: "p1",
      name: "Test Drill",
      variants: [
        { id: "v1", name: "Standard", sku: "S", baseRetailPrice: { toString: () => "100" }, baseRetailPriceUsd: { toString: () => "80" } },
        { id: "v2", name: "Pro", sku: "P", baseRetailPrice: { toString: () => "150" }, baseRetailPriceUsd: null },
      ],
      unitsOfMeasure: [
        { id: "uom-1", name: "Each", conversionFactor: 1, priceOverride: null, priceOverrideUsd: null },
      ],
    };
    mockPrisma.product.findUnique.mockResolvedValue(product);
    mockPrisma.priceLevel.findUnique.mockResolvedValue({ id: "pl-1", name: "Dealer", discountPercent: { toString: () => "20" } });

    const result = await getProductPricing("p1", "pl-1", "USD");

    // Priced in USD off the 80 column: 80 * 0.8 = 64
    expect(result!.variants[0].pricedInCurrency).toBe(true);
    expect(result!.variants[0].uomPrices[0].retailPrice).toBe(80);
    expect(result!.variants[0].uomPrices[0].customerPrice).toBe(64);

    // No USD price → flagged unpriced, prices null (never the CAD 150)
    expect(result!.variants[1].pricedInCurrency).toBe(false);
    expect(result!.variants[1].baseRetailPrice).toBeNull();
    expect(result!.variants[1].uomPrices[0].retailPrice).toBeNull();
  });

  it("uses a currency-specific cache key (CAD and USD do not collide)", async () => {
    const product = {
      id: "p1",
      name: "T",
      variants: [{ id: "v1", name: "S", sku: "S", baseRetailPrice: { toString: () => "100" }, baseRetailPriceUsd: { toString: () => "70" } }],
      unitsOfMeasure: [{ id: "u1", name: "Each", conversionFactor: 1, priceOverride: null, priceOverrideUsd: null }],
    };
    mockPrisma.product.findUnique.mockResolvedValue(product);
    mockPrisma.priceLevel.findUnique.mockResolvedValue({ id: "pl-1", name: "Retail", discountPercent: { toString: () => "0" } });

    const cad = await getProductPricing("p1", "pl-1", "CAD");
    const usd = await getProductPricing("p1", "pl-1", "USD");

    expect(cad!.variants[0].uomPrices[0].retailPrice).toBe(100);
    expect(usd!.variants[0].uomPrices[0].retailPrice).toBe(70);
  });

  it("handles a USD price override on a UOM", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      name: "Test",
      variants: [{ id: "v1", name: "Std", sku: "X", baseRetailPrice: { toString: () => "10" }, baseRetailPriceUsd: { toString: () => "8" } }],
      unitsOfMeasure: [{ id: "uom-1", name: "Box", conversionFactor: 12, priceOverride: { toString: () => "99.99" }, priceOverrideUsd: { toString: () => "79.99" } }],
    });
    mockPrisma.priceLevel.findUnique.mockResolvedValue({ id: "pl-1", name: "Retail", discountPercent: { toString: () => "0" } });

    const result = await getProductPricing("p1", "pl-1", "USD");
    expect(result!.variants[0].uomPrices[0].retailPrice).toBe(79.99);
    expect(result!.variants[0].uomPrices[0].customerPrice).toBe(79.99);
  });
});
