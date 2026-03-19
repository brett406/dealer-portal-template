import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function toCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));
  return [headerLine, ...dataLines].join("\n");
}

// ─── Order list export ───────────────────────────────────────────────────────

export type OrderExportFilters = {
  status?: OrderStatus;
  companyId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
};

export async function exportOrdersToCSV(
  filters: OrderExportFilters = {},
): Promise<string> {
  const where: Record<string, unknown> = {};

  if (filters.status) where.status = filters.status;
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.search) {
    where.orderNumber = { contains: filters.search, mode: "insensitive" };
  }

  if (filters.dateFrom || filters.dateTo) {
    const submittedAt: Record<string, Date> = {};
    if (filters.dateFrom) submittedAt.gte = filters.dateFrom;
    if (filters.dateTo) submittedAt.lte = filters.dateTo;
    where.submittedAt = submittedAt;
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    include: {
      company: { select: { name: true } },
      customer: { select: { name: true } },
    },
  });

  const headers = [
    "Order Number",
    "Date",
    "Company",
    "Customer",
    "PO Number",
    "Status",
    "Subtotal",
    "Shipping",
    "Total",
  ];

  const rows = orders.map((o) => [
    o.orderNumber,
    formatDate(o.submittedAt),
    o.company.name,
    o.customer.name,
    o.poNumber ?? "",
    o.status,
    Number(o.subtotal).toFixed(2),
    Number(o.shippingCost).toFixed(2),
    Number(o.total).toFixed(2),
  ]);

  return toCSV(headers, rows);
}

// ─── Single order detail export ──────────────────────────────────────────────

export async function exportOrderDetailsToCSV(
  orderId: string,
): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  if (!order) return null;

  const headers = [
    "Product",
    "Variant",
    "SKU",
    "UOM",
    "Qty",
    "Unit Price",
    "Retail Price",
    "Line Total",
  ];

  const rows = order.items.map((i) => [
    i.productNameSnapshot,
    i.variantNameSnapshot,
    i.skuSnapshot,
    i.uomConversionSnapshot > 1
      ? `${i.uomNameSnapshot} of ${i.uomConversionSnapshot}`
      : i.uomNameSnapshot,
    String(i.quantity),
    Number(i.unitPrice).toFixed(2),
    Number(i.baseRetailPriceSnapshot).toFixed(2),
    Number(i.lineTotal).toFixed(2),
  ]);

  return toCSV(headers, rows);
}
