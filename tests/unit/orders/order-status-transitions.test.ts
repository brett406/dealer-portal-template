import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  order: { findUnique: vi.fn(), update: vi.fn() },
  orderStatusHistory: { create: vi.fn() },
  $transaction: vi.fn().mockResolvedValue([{}, {}]),
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { getValidStatusTransitions, updateOrderStatus } = await import("@/lib/orders");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("getValidStatusTransitions", () => {
  it("RECEIVED → PROCESSING: valid", () => {
    expect(getValidStatusTransitions("RECEIVED")).toContain("PROCESSING");
  });

  it("PROCESSING → SHIPPED: valid", () => {
    expect(getValidStatusTransitions("PROCESSING")).toContain("SHIPPED");
  });

  it("SHIPPED → DELIVERED: valid", () => {
    expect(getValidStatusTransitions("SHIPPED")).toContain("DELIVERED");
  });

  it("any non-terminal → CANCELLED: valid", () => {
    expect(getValidStatusTransitions("RECEIVED")).toContain("CANCELLED");
    expect(getValidStatusTransitions("PROCESSING")).toContain("CANCELLED");
    expect(getValidStatusTransitions("SHIPPED")).toContain("CANCELLED");
  });

  it("DELIVERED → anything: invalid (terminal)", () => {
    expect(getValidStatusTransitions("DELIVERED")).toEqual([]);
  });

  it("CANCELLED → anything: invalid (terminal)", () => {
    expect(getValidStatusTransitions("CANCELLED")).toEqual([]);
  });

  it("DELIVERED → PROCESSING: invalid (no backward)", () => {
    expect(getValidStatusTransitions("DELIVERED")).not.toContain("PROCESSING");
  });
});

describe("updateOrderStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);
  });

  it("valid transition succeeds", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ status: "RECEIVED" });

    const result = await updateOrderStatus("ord-1", "PROCESSING", "user-1", "Starting to process");
    expect(result.success).toBe(true);
  });

  it("invalid transition fails", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ status: "DELIVERED" });

    const result = await updateOrderStatus("ord-1", "PROCESSING", "user-1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot transition/i);
  });

  it("CANCELLED → anything fails", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ status: "CANCELLED" });

    const result = await updateOrderStatus("ord-1", "RECEIVED", "user-1");
    expect(result.success).toBe(false);
  });

  it("status change creates history entry", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ status: "RECEIVED" });

    await updateOrderStatus("ord-1", "PROCESSING", "user-1", "Processing started");

    expect(mockPrisma.orderStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "ord-1",
        status: "PROCESSING",
        changedById: "user-1",
        notes: "Processing started",
      }),
    });
  });
});
