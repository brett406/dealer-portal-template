"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/pricing";
import { exportOrdersAction } from "./actions";
import "./orders.css";

type OrderRow = {
  id: string;
  orderNumber: string;
  companyName: string;
  customerName: string;
  itemCount: number;
  subtotal: number;
  total: number;
  status: string;
  poNumber: string | null;
  submittedAt: string;
};

type Company = { id: string; name: string };

const badgeClass: Record<string, string> = {
  RECEIVED: "ord-badge ord-badge-received",
  PROCESSING: "ord-badge ord-badge-processing",
  SHIPPED: "ord-badge ord-badge-shipped",
  DELIVERED: "ord-badge ord-badge-delivered",
  CANCELLED: "ord-badge ord-badge-cancelled",
};

export function OrderList({
  data,
  companies,
  filters,
  currentPage,
  totalPages,
}: {
  data: OrderRow[];
  companies: Company[];
  filters: { status?: string; company?: string; q?: string; dateFrom?: string; dateTo?: string };
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function buildUrl(params: Record<string, string | undefined>, pg?: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    if (pg && pg > 1) sp.set("page", String(pg));
    const qs = sp.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  }

  function handleFilter(key: string, value: string) {
    router.push(buildUrl({ ...filters, [key]: value || undefined }));
  }

  function handleExport() {
    startTransition(async () => {
      const csv = await exportOrdersAction(filters);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const columns: TableColumn<OrderRow>[] = [
    {
      key: "orderNumber",
      label: "Order #",
      sortable: true,
      render: (row) => (
        <Link href={`/admin/orders/${row.id}`} style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 600 }}>
          {row.orderNumber}
        </Link>
      ),
    },
    { key: "companyName", label: "Company", sortable: true },
    { key: "customerName", label: "Customer" },
    { key: "itemCount", label: "Items" },
    { key: "subtotal", label: "Subtotal", sortable: true, render: (row) => formatPrice(row.subtotal) },
    { key: "total", label: "Total", sortable: true, render: (row) => formatPrice(row.total) },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <span className={badgeClass[row.status]}>{row.status}</span>,
    },
    { key: "poNumber", label: "PO #", render: (row) => row.poNumber || "—" },
    {
      key: "submittedAt",
      label: "Date",
      sortable: true,
      render: (row) => new Date(row.submittedAt).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="ord-row-actions">
          <Button variant="secondary" size="sm" href={`/admin/orders/${row.id}`}>
            View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="ord-toolbar">
        <div className="ord-filters">
          <input
            type="search"
            aria-label="Search orders"
            placeholder="Search order #..."
            defaultValue={filters.q}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFilter("q", (e.target as HTMLInputElement).value);
            }}
          />
          <select aria-label="Filter by status" defaultValue={filters.status ?? ""} onChange={(e) => handleFilter("status", e.target.value)}>
            <option value="">All Statuses</option>
            <option value="RECEIVED">Received</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select aria-label="Filter by company" defaultValue={filters.company ?? ""} onChange={(e) => handleFilter("company", e.target.value)}>
            <option value="">All Companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" aria-label="From date" defaultValue={filters.dateFrom} onChange={(e) => handleFilter("dateFrom", e.target.value)} />
          <input type="date" aria-label="To date" defaultValue={filters.dateTo} onChange={(e) => handleFilter("dateTo", e.target.value)} />
        </div>
        <div className="ord-actions-bar">
          <Button variant="secondary" onClick={handleExport} loading={isPending} size="sm">
            Export CSV
          </Button>
        </div>
      </div>

      <Table columns={columns} data={data} emptyMessage="No orders found." />

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1rem", alignItems: "center", fontSize: "0.85rem" }}>
          {currentPage > 1 && (
            <Button variant="secondary" size="sm" href={buildUrl(filters, currentPage - 1)}>Previous</Button>
          )}
          <span>Page {currentPage} of {totalPages}</span>
          {currentPage < totalPages && (
            <Button variant="secondary" size="sm" href={buildUrl(filters, currentPage + 1)}>Next</Button>
          )}
        </div>
      )}
    </>
  );
}
