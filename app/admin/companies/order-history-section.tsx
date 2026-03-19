"use client";

import { Table, type TableColumn } from "@/components/ui/Table";
import "./companies.css";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  submittedAt: string;
  customerName: string;
  placedByAdmin: string | null;
};

const statusClass: Record<string, string> = {
  RECEIVED: "co-order-status co-order-received",
  PROCESSING: "co-order-status co-order-processing",
  SHIPPED: "co-order-status co-order-shipped",
  DELIVERED: "co-order-status co-order-delivered",
  CANCELLED: "co-order-status co-order-cancelled",
};

export function OrderHistorySection({ orders }: { orders: OrderRow[] }) {
  const columns: TableColumn<OrderRow>[] = [
    { key: "orderNumber", label: "Order #", sortable: true },
    {
      key: "submittedAt",
      label: "Date",
      sortable: true,
      render: (row) => new Date(row.submittedAt).toLocaleDateString(),
    },
    {
      key: "total",
      label: "Total",
      sortable: true,
      render: (row) => `$${row.total.toFixed(2)}`,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <span className={statusClass[row.status] ?? ""}>{row.status}</span>,
    },
    { key: "customerName", label: "Placed By", render: (row) => (
      <span>
        {row.customerName}
        {row.placedByAdmin && (
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
            {" "}(by {row.placedByAdmin})
          </span>
        )}
      </span>
    )},
  ];

  return (
    <div className="co-edit-section">
      <h2>Order History</h2>
      <Table columns={columns} data={orders} emptyMessage="No orders yet." />
    </div>
  );
}
