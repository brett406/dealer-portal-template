import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  pageContent: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { calculateShipping, calculateShippingFromSettings, getShippingSettings } =
  await import("@/lib/shipping");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("calculateShippingFromSettings (pure)", () => {
  it("flat rate applies fixed amount", () => {
    const result = calculateShippingFromSettings(50, {
      shippingMethod: "flat",
      flatShippingRate: 15,
      freeShippingThreshold: null,
    });
    expect(result).toBe(15);
  });

  it("free shipping above threshold", () => {
    const result = calculateShippingFromSettings(200, {
      shippingMethod: "flat",
      flatShippingRate: 15,
      freeShippingThreshold: 100,
    });
    expect(result).toBe(0);
  });

  it("shipping applies below threshold", () => {
    const result = calculateShippingFromSettings(50, {
      shippingMethod: "flat",
      flatShippingRate: 15,
      freeShippingThreshold: 100,
    });
    expect(result).toBe(15);
  });

  it("free shipping at exact threshold", () => {
    const result = calculateShippingFromSettings(100, {
      shippingMethod: "flat",
      flatShippingRate: 15,
      freeShippingThreshold: 100,
    });
    expect(result).toBe(0);
  });

  it("zero shipping when not configured (safe default)", () => {
    const result = calculateShippingFromSettings(50, {
      shippingMethod: "unknown",
      flatShippingRate: 15,
      freeShippingThreshold: null,
    });
    expect(result).toBe(0);
  });

  it("zero flat rate returns $0", () => {
    const result = calculateShippingFromSettings(50, {
      shippingMethod: "flat",
      flatShippingRate: 0,
      freeShippingThreshold: null,
    });
    expect(result).toBe(0);
  });
});

describe("getShippingSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads settings from dealer-settings page content", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue({
      payload: {
        shippingMethod: "flat",
        flatShippingRate: "12.50",
        freeShippingThreshold: "200",
      },
    });

    const settings = await getShippingSettings();
    expect(settings.shippingMethod).toBe("flat");
    expect(settings.flatShippingRate).toBe(12.5);
    expect(settings.freeShippingThreshold).toBe(200);
  });

  it("returns safe defaults when no settings exist", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue(null);

    const settings = await getShippingSettings();
    expect(settings.shippingMethod).toBe("flat");
    expect(settings.flatShippingRate).toBe(0);
    expect(settings.freeShippingThreshold).toBeNull();
  });
});

describe("calculateShipping (integration with settings)", () => {
  it("reads settings and applies flat rate", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue({
      payload: {
        shippingMethod: "flat",
        flatShippingRate: "15.00",
      },
    });

    const result = await calculateShipping(50);
    expect(result).toBe(15);
  });
});
