import { describe, it, expect } from "vitest";
import { calculateUOMBasePrice, calculateCustomerPrice } from "@/lib/pricing";

describe("calculateUOMBasePrice", () => {
  it("box price = baseRetailPrice × conversionFactor (no override)", () => {
    expect(calculateUOMBasePrice(9.99, 12, null)).toBe(119.88);
  });

  it("price override replaces calculated price", () => {
    // Override of 100 regardless of base × factor
    expect(calculateUOMBasePrice(9.99, 12, 100)).toBe(100);
  });

  it("skid pricing with large conversion factor", () => {
    expect(calculateUOMBasePrice(1.5, 144, null)).toBe(216);
  });

  it("each UOM (factor=1) same as base pricing", () => {
    expect(calculateUOMBasePrice(49.99, 1, null)).toBe(49.99);
  });

  it("priceOverride of 0 is valid (free)", () => {
    expect(calculateUOMBasePrice(49.99, 12, 0)).toBe(0);
  });

  it("null priceOverride vs 0 priceOverride are different", () => {
    const withNull = calculateUOMBasePrice(10, 12, null);
    const withZero = calculateUOMBasePrice(10, 12, 0);
    expect(withNull).toBe(120);
    expect(withZero).toBe(0);
    expect(withNull).not.toBe(withZero);
  });
});

describe("UOM + discount integration", () => {
  it("discount applies AFTER UOM pricing (calculated)", () => {
    const uomBase = calculateUOMBasePrice(10, 12, null); // 120
    const customerPrice = calculateCustomerPrice(uomBase, 20); // 120 * 0.8 = 96
    expect(customerPrice).toBe(96);
  });

  it("discount applies AFTER UOM pricing (override)", () => {
    const uomBase = calculateUOMBasePrice(10, 12, 100); // override → 100
    const customerPrice = calculateCustomerPrice(uomBase, 20); // 100 * 0.8 = 80
    expect(customerPrice).toBe(80);
  });
});
