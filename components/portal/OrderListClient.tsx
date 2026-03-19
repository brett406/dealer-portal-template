"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/pricing";
import { reorderAction } from "@/app/(portal)/portal/orders/actions";
import "@/app/(portal)/portal/orders/orders.css";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  poNumber: string | null;
  submittedAt: string;
  itemCount: number;
};

const badgeClass: Record<string, string> = {
  RECEIVED: "order-badge order-badge-received",
  PROCESSING: "order-badge order-badge-processing",
  SHIPPED: "order-badge order-badge-shipped",
  DELIVERED: "order-badge order-badge-delivered",
  CANCELLED: "order-badge order-badge-cancelled",
};

export function OrderListClient({
  orders,
  currentPage,
  totalPages,
  filters,
}: {
  orders: OrderRow[];
  currentPage: number;
  totalPages: number;
  filters: { status?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleFilter(key: string, value: string) {
    const sp = new URLSearchParams();
    const next = { ...filters, [key]: value || undefined };
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    router.push(`/portal/orders${qs ? `?${qs}` : ""}`);
  }

  function handleReorder(orderId: string) {
    startTransition(async () => {
      const result = await reorderAction(orderId);
      if (result?.error) alert(result.error);
    });
  }

  const columns: TableColumn<OrderRow>[] = [
    {
      key: "orderNumber",
      label: "Order #",
      render: (row) => (
        <Link href={`/portal/orders/${row.id}`} style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 600 }}>
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "submittedAt",
      label: "Date",
      sortable: true,
      render: (row) => new Date(row.submittedAt).toLocaleDateString(),
    },
    { key: "itemCount", label: "Items" },
    { key: "total", label: "Total", sortable: true, render: (row) => formatPrice(row.total) },
    {
      key: "status",
      label: "Status",
      render: (row) => <span className={badgeClass[row.status]}>{row.status}</span>,
    },
    { key: "poNumber", label: "PO #", render: (row) => row.poNumber || "—" },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="orders-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleReorder(row.id)}
            disabled={isPending}
          >
            Re-order
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="orders-toolbar">
        <select
          aria-label="Filter by status"
          defaultValue={filters.status ?? ""}
          onChange={(e) => handleFilter("status", e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="RECEIVED">Received</option>
          <option value="PROCESSING">Processing</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <Table columns={columns} data={orders} emptyMessage="No orders found." />

      {totalPages > 1 && (
        <div className="orders-pagination">
          {currentPage > 1 && (
            <Button
              variant="secondary"
              size="sm"
              href={`/portal/orders?page=${currentPage - 1}${filters.status ? `&status=${filters.status}` : ""}`}
            >
              Previous
            </Button>
          )}
          <span>Page {currentPage} of {totalPages}</span>
          {currentPage < totalPages && (
            <Button
              variant="secondary"
              size="sm"
              href={`/portal/orders?page=${currentPage + 1}${filters.status ? `&status=${filters.status}` : ""}`}
            >
              Next
            </Button>
          )}
        </div>
      )}
    </>
  );
}
