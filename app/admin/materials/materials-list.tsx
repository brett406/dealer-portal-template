"use client";

import { useState, useTransition, useRef } from "react";
import { HelpTip } from "@/components/ui/HelpTip";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { createMaterial } from "./actions";
import "./materials.css";

type MaterialRow = {
  id: string;
  name: string;
  sku: string | null;
  kind: "raw" | "subassembly";
  unit: string;
  cost: number | null;
  uncosted: boolean;
  archived: boolean;
  categoryName: string | null;
  usedInCount: number;
};

type Category = { id: string; name: string };

export function MaterialsList({
  data,
  categories,
  filters,
}: {
  data: MaterialRow[];
  categories: Category[];
  filters: { category?: string; kind?: string; q?: string };
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function buildUrl(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    return `/admin/materials${qs ? `?${qs}` : ""}`;
  }

  function handleFilter(key: string, value: string) {
    const next = { ...filters, [key]: value || undefined };
    router.push(buildUrl(next));
  }

  function handleCreate(fd: FormData) {
    setError(null);
    setFormErrors({});
    startTransition(async () => {
      // On success the action redirects to the new material's detail page.
      const result = await createMaterial(fd);
      if (result?.errors) setFormErrors(result.errors);
      else if (result?.error) setError(result.error);
    });
  }

  const columns: TableColumn<MaterialRow>[] = [
    {
      key: "name",
      label: "Material",
      sortable: true,
      render: (row) => (
        <span className={!row.archived ? "" : "mat-inactive"}>
          <Link href={`/admin/materials/${row.id}`} className="mat-name-link">
            {row.name}
          </Link>
          {row.archived && (
            <span className="mat-badge mat-badge-archived" style={{ marginLeft: "0.4rem" }}>
              Archived
            </span>
          )}
          {row.uncosted && (
            <span
              className="mat-badge mat-badge-warning"
              style={{ marginLeft: "0.4rem" }}
              title="This raw material has no unit cost — it contributes $0 to every BOM that uses it"
            >
              Uncosted
            </span>
          )}
        </span>
      ),
    },
    { key: "sku", label: "SKU", sortable: true, render: (row) => row.sku ?? "—" },
    {
      key: "kind",
      label: "Kind",
      sortable: true,
      render: (row) => (
        <span className={`mat-badge mat-badge-${row.kind}`}>
          {row.kind === "raw" ? "Raw" : "Sub-assembly"}
        </span>
      ),
    },
    { key: "unit", label: "Unit" },
    {
      key: "cost",
      label: "Cost",
      sortable: true,
      render: (row) =>
        row.cost !== null ? (
          <span>
            ${row.cost.toFixed(4)}
            {row.kind === "subassembly" && (
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", marginLeft: "0.3rem" }}>
                (computed)
              </span>
            )}
          </span>
        ) : (
          <span style={{ color: "var(--color-text-muted)" }}>—</span>
        ),
    },
    {
      key: "categoryName",
      label: "Category",
      sortable: true,
      render: (row) => row.categoryName ?? "—",
    },
    {
      key: "usedInCount",
      label: "Used In",
      sortable: true,
      render: (row) => (row.usedInCount > 0 ? `${row.usedInCount} BOM line${row.usedInCount === 1 ? "" : "s"}` : "—"),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="mat-actions">
          <Button variant="secondary" size="sm" href={`/admin/materials/${row.id}`}>
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mat-toolbar">
        <div className="mat-filters">
          <input
            type="search"
            aria-label="Search materials"
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
            aria-label="Filter by kind"
            defaultValue={filters.kind ?? ""}
            onChange={(e) => handleFilter("kind", e.target.value)}
          >
            <option value="">All Kinds</option>
            <option value="raw">Raw</option>
            <option value="subassembly">Sub-assembly</option>
          </select>
        </div>
        <Button onClick={() => { setShowCreate(true); setFormErrors({}); }}>New Material</Button>
      </div>

      {error && <div className="status-message status-error">{error}</div>}

      <Table columns={columns} data={data} emptyMessage="No materials found." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Material">
        <form ref={formRef} action={handleCreate}>
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">Name *</label>
            <input name="name" className="form-input" required placeholder="e.g., Steel tube" />
            {formErrors.name && <p className="form-error-message">{formErrors.name}</p>}
          </div>
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">SKU</label>
            <input name="sku" className="form-input" placeholder="Optional" />
            {formErrors.sku && <p className="form-error-message">{formErrors.sku}</p>}
          </div>
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">Kind <HelpTip text="Raw material: you enter what it costs you. Sub-assembly: a part you build yourself — its cost is calculated from its own components and labor." /></label>
            <select name="kind" className="form-input" defaultValue="raw">
              <option value="raw">Raw material (entered cost)</option>
              <option value="subassembly">Sub-assembly (computed from its own BOM)</option>
            </select>
            {formErrors.kind && <p className="form-error-message">{formErrors.kind}</p>}
          </div>
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">Unit</label>
            <input name="unit" className="form-input" defaultValue="each" placeholder="each, ft, lb..." />
            {formErrors.unit && <p className="form-error-message">{formErrors.unit}</p>}
          </div>
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">Unit Cost <HelpTip text="Your standard cost for one unit of this material — what it costs you to buy or make, not what you sell it for." /></label>
            <input
              name="unitCost"
              type="number"
              step="0.0001"
              min="0"
              className="form-input"
              placeholder="Optional — raw materials only"
            />
            {formErrors.unitCost && <p className="form-error-message">{formErrors.unitCost}</p>}
          </div>
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">Category</label>
            <select name="categoryId" className="form-input" defaultValue="">
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
