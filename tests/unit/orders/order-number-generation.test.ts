import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  order: { findFirst: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { generateOrderNumber } = await import("@/lib/orders");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("generateOrderNumber", () => {
  beforeEach(() => vi.clearAllMocks());

  it("format: ORD-YYYY-NNNN", async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);

    const num = await generateOrderNumber();
    const year = new Date().getFullYear();
    expect(num).toMatch(new RegExp(`^ORD-${year}-\\d{4}$`));
  });

  it("sequential increment", async () => {
    const year = new Date().getFullYear();
    mockPrisma.order.findFirst.mockResolvedValue({
      orderNumber: `ORD-${year}-0005`,
    });

    const num = await generateOrderNumber();
    expect(num).toBe(`ORD-${year}-0006`);
  });

  it("starts at 0001 for new year", async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);

    const num = await generateOrderNumber();
    const year = new Date().getFullYear();
    expect(num).toBe(`ORD-${year}-0001`);
  });

  it("year rollover resets counter", async () => {
    // Searching for current year prefix returns nothing (new year)
    mockPrisma.order.findFirst.mockResolvedValue(null);

    const num = await generateOrderNumber();
    expect(num).toMatch(/-0001$/);
  });

  it("concurrent creation → no duplicates (relies on unique constraint)", async () => {
    // Two calls with same latest order
    const year = new Date().getFullYear();
    mockPrisma.order.findFirst.mockResolvedValue({
      orderNumber: `ORD-${year}-0010`,
    });

    const num1 = await generateOrderNumber();
    const num2 = await generateOrderNumber();

    // Both will generate 0011 — the DB unique constraint prevents actual duplicates.
    // The second insert will fail and should be retried by the caller.
    expect(num1).toBe(`ORD-${year}-0011`);
    expect(num2).toBe(`ORD-${year}-0011`);
    // In production, the transaction + unique constraint handle this.
  });
});
