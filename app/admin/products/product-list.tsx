"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteProduct, toggleProductActive } from "./actions";
import "./products.css";

type ProductRow = {
  id: string;
  name: string;
  categoryName: string;
  variantCount: number;
  totalStock: number;
  stockStatus: "ok" | "low" | "out";
  active: boolean;
  sortOrder: number;
  thumbUrl: string | null;
};

type Category = { id: string; name: string };

export function ProductList({
  data,
  categories,
  filters,
}: {
  data: ProductRow[];
  categories: Category[];
  filters: { category?: string; active?: string; q?: string };
}) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function buildUrl(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    return `/admin/products${qs ? `?${qs}` : ""}`;
  }

  function handleFilter(key: string, value: string) {
    const next = { ...filters, [key]: value || undefined };
    router.push(buildUrl(next));
  }

  function handleDelete(row: ProductRow) {
    setError(null);
    startTransition(async () => {
      const result = await deleteProduct(row.id);
      if (result.error) {
        setError(result.error);
      }
      setDeleteTarget(null);
    });
  }

  function handleToggle(row: ProductRow) {
    startTransition(async () => {
      const result = await toggleProductActive(row.id);
      if (result.error) setError(result.error);
    });
  }

  const stockLabel = { ok: "In Stock", low: "Low Stock", out: "Out of Stock" };
  const stockClass = { ok: "prod-stock-ok", low: "prod-stock-low", out: "prod-stock-out" };

  const columns: TableColumn<ProductRow>[] = [
    {
      key: "name",
      label: "Product",
      sortable: true,
      render: (row) => (
        <div className={`prod-name-cell ${!row.active ? "prod-inactive" : ""}`}>
          {row.thumbUrl ? (
            <Image src={row.thumbUrl} alt="" width={40} height={40} className="prod-thumb" />
          ) : (
            <div className="prod-thumb-placeholder">IMG</div>
          )}
          <span>
            {row.name}
            {!row.active && <span className="prod-badge-inactive" style={{ marginLeft: "0.4rem" }}>Inactive</span>}
          </span>
        </div>
      ),
    },
    { key: "categoryName", label: "Category", sortable: true },
    { key: "variantCount", label: "Variants", sortable: true },
    {
      key: "totalStock",
      label: "Stock",
      sortable: true,
      render: (row) => (
        <span className={stockClass[row.stockStatus]}>
          {row.totalStock} ({stockLabel[row.stockStatus]})
        </span>
      ),
    },
    { key: "sortOrder", label: "Sort", sortable: true },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="prod-actions">
          <Button variant="ghost" size="sm" onClick={() => handleToggle(row)} disabled={isPending}>
            {row.active ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="secondary" size="sm" href={`/admin/products/${row.id}`}>
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => { setError(null); setDeleteTarget(row); }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="prod-toolbar">
        <div className="prod-filters">
          <input
            type="search"
            aria-label="Search products"
            placeholder="Search name or SKU..."
            defaultValue={filters.q}
            onChange={(e) => handleFilter("q", e.target.value)}
          />
          <select
            aria-label="Filter by category"
            defaultValue={filters.category ?? ""}
            onChange={(e) => handleFilter("category", e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            defaultValue={filters.active ?? ""}
            onChange={(e) => handleFilter("active", e.target.value)}
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <Button href="/admin/products/new">New Product</Button>
      </div>

      {error && <div className="status-message status-error">{error}</div>}

      <Table columns={columns} data={data} emptyMessage="No products found." />

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Product">
        <p>
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will also
          delete all variants, UOMs, and images.
        </p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={isPending}
            onClick={() => deleteTarget && handleDelete(deleteTarget)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
