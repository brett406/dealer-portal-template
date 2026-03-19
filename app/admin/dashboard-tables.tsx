"use client";

import Link from "next/link";
import { Table, type TableColumn } from "@/components/ui/Table";
import "./dashboard.css";

// ─── Recent Orders ───────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  orderNumber: string;
  companyName: string;
  customerName: string;
  total: number;
  status: string;
  submittedAt: string;
};

const statusClass: Record<string, string> = {
  RECEIVED: "dash-order-status dash-status-received",
  PROCESSING: "dash-order-status dash-status-processing",
  SHIPPED: "dash-order-status dash-status-shipped",
  DELIVERED: "dash-order-status dash-status-delivered",
  CANCELLED: "dash-order-status dash-status-cancelled",
};

const orderColumns: TableColumn<OrderRow>[] = [
  {
    key: "orderNumber",
    label: "Order",
    render: (row) => (
      <Link href={`/admin/orders/${row.id}`} style={{ color: "var(--color-primary, #2563eb)", textDecoration: "none" }}>
        {row.orderNumber}
      </Link>
    ),
  },
  { key: "companyName", label: "Company" },
  { key: "customerName", label: "Customer" },
  { key: "total", label: "Total", render: (row) => `$${row.total.toFixed(2)}` },
  {
    key: "status",
    label: "Status",
    render: (row) => <span className={statusClass[row.status] ?? ""}>{row.status}</span>,
  },
  {
    key: "submittedAt",
    label: "Date",
    render: (row) => new Date(row.submittedAt).toLocaleDateString(),
  },
];

export function RecentOrdersTable({ data }: { data: OrderRow[] }) {
  return <Table columns={orderColumns} data={data} emptyMessage="No recent orders." />;
}

// ─── Low Stock ───────────────────────────────────────────────────────────────

type StockRow = {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
};

const stockColumns: TableColumn<StockRow>[] = [
  {
    key: "productName",
    label: "Product",
    render: (row) => (
      <Link href={`/admin/products/${row.productId}`} style={{ color: "var(--color-primary, #2563eb)", textDecoration: "none" }}>
        {row.productName}
      </Link>
    ),
  },
  { key: "variantName", label: "Variant" },
  { key: "sku", label: "SKU" },
  {
    key: "stockQuantity",
    label: "Stock",
    render: (row) => (
      <span className={row.stockQuantity === 0 ? "dash-stock-out" : "dash-stock-warn"}>
        {row.stockQuantity}
      </span>
    ),
  },
  { key: "lowStockThreshold", label: "Threshold" },
];

export function LowStockTable({ data }: { data: StockRow[] }) {
  return <Table columns={stockColumns} data={data} emptyMessage="All stock levels are healthy." />;
}
