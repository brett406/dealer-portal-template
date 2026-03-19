import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  order: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { exportOrdersToCSV, exportOrderDetailsToCSV } = await import("@/lib/export");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderNumber: "ORD-2026-0001",
    submittedAt: new Date("2026-03-15"),
    company: { name: "Acme Hardware" },
    customer: { name: "John Smith" },
    poNumber: "PO-123",
    status: "DELIVERED",
    subtotal: { toString: () => "160.00" },
    shippingCost: { toString: () => "15.00" },
    total: { toString: () => "175.00" },
    ...overrides,
  };
}

function makeOrderItem(overrides: Record<string, unknown> = {}) {
  return {
    productNameSnapshot: "Pro Drill",
    variantNameSnapshot: "Standard",
    skuSnapshot: "PT-DRILL-12",
    uomNameSnapshot: "Each",
    uomConversionSnapshot: 1,
    quantity: 5,
    unitPrice: { toString: () => "80.00" },
    baseRetailPriceSnapshot: { toString: () => "100.00" },
    lineTotal: { toString: () => "400.00" },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("exportOrdersToCSV", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exports with correct column headers", async () => {
    mockPrisma.order.findMany.mockResolvedValue([makeOrder()]);

    const csv = await exportOrdersToCSV();
    const lines = csv.split("\n");

    expect(lines[0]).toBe(
      "Order Number,Date,Company,Customer,PO Number,Status,Subtotal,Shipping,Total",
    );
  });

  it("exports data rows correctly", async () => {
    mockPrisma.order.findMany.mockResolvedValue([makeOrder()]);

    const csv = await exportOrdersToCSV();
    const lines = csv.split("\n");

    expect(lines[1]).toBe(
      "ORD-2026-0001,2026-03-15,Acme Hardware,John Smith,PO-123,DELIVERED,160.00,15.00,175.00",
    );
  });

  it("handles special characters in names (CSV escaping)", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      makeOrder({
        company: { name: 'O\'Brien & Sons, LLC' },
        customer: { name: 'Jane "JD" Doe' },
      }),
    ]);

    const csv = await exportOrdersToCSV();
    const lines = csv.split("\n");

    // Company name with comma should be quoted
    expect(lines[1]).toContain('"O\'Brien & Sons, LLC"');
    // Customer name with quotes should be double-quoted
    expect(lines[1]).toContain('"Jane ""JD"" Doe"');
  });

  it("consistent date formatting (YYYY-MM-DD)", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      makeOrder({ submittedAt: new Date("2026-01-05T14:30:00Z") }),
    ]);

    const csv = await exportOrdersToCSV();
    expect(csv).toContain("2026-01-05");
  });

  it("empty result → headers only", async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);

    const csv = await exportOrdersToCSV();
    const lines = csv.split("\n");

    expect(lines).toHaveLength(1); // Just headers
    expect(lines[0]).toContain("Order Number");
  });

  it("filters applied correctly — status filter", async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);

    await exportOrdersToCSV({ status: "SHIPPED" });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "SHIPPED" }),
      }),
    );
  });

  it("filters applied correctly — company filter", async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);

    await exportOrdersToCSV({ companyId: "co-123" });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: "co-123" }),
      }),
    );
  });

  it("filters applied correctly — date range", async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    const from = new Date("2026-01-01");
    const to = new Date("2026-03-31");

    await exportOrdersToCSV({ dateFrom: from, dateTo: to });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submittedAt: { gte: from, lte: to },
        }),
      }),
    );
  });

  it("handles missing PO number as empty string", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      makeOrder({ poNumber: null }),
    ]);

    const csv = await exportOrdersToCSV();
    const lines = csv.split("\n");
    const fields = lines[1].split(",");

    // PO Number is field index 4
    expect(fields[4]).toBe("");
  });
});

describe("exportOrderDetailsToCSV", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exports line items with correct headers", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      items: [makeOrderItem()],
    });

    const csv = await exportOrderDetailsToCSV("ord-1");
    const lines = csv!.split("\n");

    expect(lines[0]).toBe(
      "Product,Variant,SKU,UOM,Qty,Unit Price,Retail Price,Line Total",
    );
  });

  it("exports line item data correctly", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      items: [makeOrderItem()],
    });

    const csv = await exportOrderDetailsToCSV("ord-1");
    const lines = csv!.split("\n");

    expect(lines[1]).toBe(
      "Pro Drill,Standard,PT-DRILL-12,Each,5,80.00,100.00,400.00",
    );
  });

  it("formats UOM with conversion factor", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      items: [makeOrderItem({ uomNameSnapshot: "Box", uomConversionSnapshot: 12 })],
    });

    const csv = await exportOrderDetailsToCSV("ord-1");
    expect(csv).toContain("Box of 12");
  });

  it("returns null for non-existent order", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);

    const csv = await exportOrderDetailsToCSV("non-existent");
    expect(csv).toBeNull();
  });
});
