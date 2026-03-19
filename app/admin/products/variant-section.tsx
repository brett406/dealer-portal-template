"use client";

import { useState, useTransition, useRef } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { addVariant, updateVariant, deleteVariant, toggleVariantActive } from "./actions";
import { calculateCustomerPrice } from "@/lib/pricing";
import "./products.css";

type Variant = {
  id: string;
  name: string;
  sku: string;
  baseRetailPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  active: boolean;
  sortOrder: number;
};

type PriceLevel = { id: string; name: string; discountPercent: number };

export function VariantSection({
  productId,
  variants,
  priceLevels,
}: {
  productId: string;
  variants: Variant[];
  priceLevels: PriceLevel[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Variant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Variant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(fd: FormData) {
    setError(null);
    setFormErrors({});
    startTransition(async () => {
      const result = await addVariant(productId, fd);
      if (result.errors) {
        setFormErrors(result.errors);
      } else if (result.error) {
        setError(result.error);
      } else {
        setShowForm(false);
        formRef.current?.reset();
      }
    });
  }

  function handleUpdate(fd: FormData) {
    if (!editTarget) return;
    setFormErrors({});
    startTransition(async () => {
      const result = await updateVariant(editTarget.id, fd);
      if (result.errors) {
        setFormErrors(result.errors);
      } else if (result.error) {
        setError(result.error);
      } else {
        setEditTarget(null);
      }
    });
  }

  function handleDelete(v: Variant) {
    setError(null);
    startTransition(async () => {
      const result = await deleteVariant(v.id);
      if (result.error) setError(result.error);
      setDeleteTarget(null);
    });
  }

  function handleToggle(v: Variant) {
    startTransition(async () => {
      const result = await toggleVariantActive(v.id);
      if (result.error) setError(result.error);
    });
  }

  const columns: TableColumn<Variant>[] = [
    {
      key: "name",
      label: "Variant",
      render: (row) => (
        <span className={!row.active ? "prod-inactive" : ""}>
          {row.name}
          {!row.active && <span className="prod-badge-inactive" style={{ marginLeft: "0.4rem" }}>Inactive</span>}
        </span>
      ),
    },
    { key: "sku", label: "SKU" },
    { key: "baseRetailPrice", label: "Retail Price", render: (row) => `$${row.baseRetailPrice.toFixed(2)}` },
    { key: "stockQuantity", label: "Stock", render: (row) => (
      <span className={
        row.stockQuantity === 0 ? "prod-stock-out" :
        row.stockQuantity <= row.lowStockThreshold ? "prod-stock-low" : "prod-stock-ok"
      }>
        {row.stockQuantity}
      </span>
    )},
    { key: "lowStockThreshold", label: "Low Threshold" },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="prod-actions">
          <Button variant="ghost" size="sm" onClick={() => handleToggle(row)} disabled={isPending}>
            {row.active ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setFormErrors({}); setEditTarget(row); }}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => { setError(null); setDeleteTarget(row); }}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="prod-edit-section">
      <h2>Variants</h2>

      {error && <div className="status-message status-error">{error}</div>}

      <Table columns={columns} data={variants} emptyMessage="No variants yet." />

      {/* Price preview for first variant */}
      {variants.length > 0 && priceLevels.length > 0 && (
        <div className="prod-price-grid" style={{ marginBottom: "1rem" }}>
          {priceLevels.map((pl) => (
            <div key={pl.id} className="prod-price-card">
              <div className="label">{pl.name} ({pl.discountPercent}%)</div>
              <div className="price">
                ${calculateCustomerPrice(variants[0].baseRetailPrice, pl.discountPercent).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm && !editTarget && (
        <Button size="sm" onClick={() => { setShowForm(true); setFormErrors({}); }}>
          Add Variant
        </Button>
      )}

      {showForm && (
        <form ref={formRef} action={handleAdd} className="prod-inline-form">
          <div className="form-field">
            <label>Name *</label>
            <input name="name" required placeholder="e.g., Large" />
            {formErrors.name && <p className="form-error-message">{formErrors.name}</p>}
          </div>
          <div className="form-field">
            <label>SKU *</label>
            <input name="sku" required placeholder="e.g., PROD-LG" />
            {formErrors.sku && <p className="form-error-message">{formErrors.sku}</p>}
          </div>
          <div className="form-field">
            <label>Retail Price *</label>
            <input name="baseRetailPrice" type="number" step="0.01" min="0" required placeholder="0.00" />
            {formErrors.baseRetailPrice && <p className="form-error-message">{formErrors.baseRetailPrice}</p>}
          </div>
          <div className="form-field">
            <label>Stock</label>
            <input name="stockQuantity" type="number" min="0" defaultValue="0" />
          </div>
          <div className="form-field">
            <label>Low Threshold</label>
            <input name="lowStockThreshold" type="number" min="0" defaultValue="5" />
          </div>
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
        </form>
      )}

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Variant">
        {editTarget && (
          <form action={handleUpdate}>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Name</label>
              <input name="name" className="form-input" required defaultValue={editTarget.name} />
              {formErrors.name && <p className="form-error-message">{formErrors.name}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">SKU</label>
              <input name="sku" className="form-input" required defaultValue={editTarget.sku} />
              {formErrors.sku && <p className="form-error-message">{formErrors.sku}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Retail Price</label>
              <input name="baseRetailPrice" type="number" step="0.01" min="0" className="form-input" required defaultValue={editTarget.baseRetailPrice} />
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Stock Quantity</label>
              <input name="stockQuantity" type="number" min="0" className="form-input" defaultValue={editTarget.stockQuantity} />
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Low Stock Threshold</label>
              <input name="lowStockThreshold" type="number" min="0" className="form-input" defaultValue={editTarget.lowStockThreshold} />
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="prod-toggle-label">
                <input type="checkbox" name="active" defaultChecked={editTarget.active} />
                <span>Active</span>
              </label>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" loading={isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Variant">
        <p>Delete variant <strong>{deleteTarget?.name}</strong> ({deleteTarget?.sku})?</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
