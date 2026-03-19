import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  pageContent: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { getDealerSettings } = await import("@/lib/settings");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("feature toggles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("showProductsToPublic=true → public catalog accessible", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue({
      payload: { showProductsToPublic: "true" },
    });

    const settings = await getDealerSettings();
    expect(settings.showProductsToPublic).toBe(true);
  });

  it("showProductsToPublic=false → public catalog blocked", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue({
      payload: { showProductsToPublic: "false" },
    });

    const settings = await getDealerSettings();
    expect(settings.showProductsToPublic).toBe(false);
  });

  it("showPricesToPublic=true → retail prices shown", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue({
      payload: { showPricesToPublic: "true" },
    });

    const settings = await getDealerSettings();
    expect(settings.showPricesToPublic).toBe(true);
  });

  it("showPricesToPublic=false → prices hidden", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue({
      payload: { showPricesToPublic: "false" },
    });

    const settings = await getDealerSettings();
    expect(settings.showPricesToPublic).toBe(false);
  });

  it("toggles have sensible defaults if settings don't exist", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue(null);

    const settings = await getDealerSettings();

    // Secure defaults: don't show products or prices publicly
    expect(settings.showProductsToPublic).toBe(false);
    expect(settings.showPricesToPublic).toBe(false);
    expect(settings.allowSelfRegistration).toBe(false);
    expect(settings.requireApprovalForRegistration).toBe(true);
    expect(settings.requirePONumber).toBe(false);
    expect(settings.shippingMethod).toBe("flat");
    expect(settings.flatShippingRate).toBe(0);
    expect(settings.freeShippingThreshold).toBeNull();
  });

  it("partial settings use defaults for missing keys", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue({
      payload: { showProductsToPublic: "true" },
    });

    const settings = await getDealerSettings();
    expect(settings.showProductsToPublic).toBe(true);
    // Missing keys get defaults
    expect(settings.showPricesToPublic).toBe(false);
    expect(settings.requirePONumber).toBe(false);
  });

  it("requireApprovalForRegistration defaults to true", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue({
      payload: {},
    });

    const settings = await getDealerSettings();
    expect(settings.requireApprovalForRegistration).toBe(true);
  });

  it("shipping settings parse correctly", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue({
      payload: {
        shippingMethod: "flat",
        flatShippingRate: "12.50",
        freeShippingThreshold: "250",
      },
    });

    const settings = await getDealerSettings();
    expect(settings.shippingMethod).toBe("flat");
    expect(settings.flatShippingRate).toBe(12.5);
    expect(settings.freeShippingThreshold).toBe(250);
  });
});
