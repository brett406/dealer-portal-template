import { describe, it, expect } from "vitest";
import { calculateCustomerPrice } from "@/lib/pricing";

describe("calculateCustomerPrice", () => {
  it("retail price (0% discount) → exact retail", () => {
    expect(calculateCustomerPrice(49.99, 0)).toBe(49.99);
  });

  it("dealer price (20% discount) → 80% of retail", () => {
    expect(calculateCustomerPrice(100, 20)).toBe(80);
  });

  it("distributor price (30% discount) → 70% of retail", () => {
    expect(calculateCustomerPrice(100, 30)).toBe(70);
  });

  it("100% discount → $0.00", () => {
    expect(calculateCustomerPrice(199.99, 100)).toBe(0);
  });

  it("fractional cents round to 2 decimal places", () => {
    // 33.33% off $10 = 10 * 0.6667 = 6.667 → 6.67
    expect(calculateCustomerPrice(10, 33.33)).toBe(6.67);
  });

  it("very small prices ($0.01) don't round to $0.00", () => {
    expect(calculateCustomerPrice(0.01, 0)).toBe(0.01);
    expect(calculateCustomerPrice(0.01, 50)).toBe(0.01); // 0.005 rounds to 0.01
  });

  it("zero base price → $0.00", () => {
    expect(calculateCustomerPrice(0, 20)).toBe(0);
  });
});
