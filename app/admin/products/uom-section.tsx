"use client";

import { useState, useTransition, useRef } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { addUOM, updateUOM, deleteUOM } from "./actions";
import { calculateUOMBasePrice } from "@/lib/pricing";
import "./products.css";

type UOM = {
  id: string;
  name: string;
  conversionFactor: number;
  priceOverride: number | null;
  sortOrder: number;
};

export function UOMSection({
  productId,
  uoms,
  baseRetailPrice,
}: {
  productId: string;
  uoms: UOM[];
  baseRetailPrice: number;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<UOM | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UOM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(fd: FormData) {
    setError(null);
    setFormErrors({});
    startTransition(async () => {
      const result = await addUOM(productId, fd);
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
      const result = await updateUOM(editTarget.id, fd);
      if (result.errors) {
        setFormErrors(result.errors);
      } else if (result.error) {
        setError(result.error);
      } else {
        setEditTarget(null);
      }
    });
  }

  function handleDelete(u: UOM) {
    setError(null);
    startTransition(async () => {
      const result = await deleteUOM(u.id);
      if (result.error) setError(result.error);
      setDeleteTarget(null);
    });
  }

  const columns: TableColumn<UOM>[] = [
    { key: "name", label: "Name" },
    { key: "conversionFactor", label: "Factor", render: (row) => `×${row.conversionFactor}` },
    {
      key: "priceOverride",
      label: "Price Override",
      render: (row) =>
        row.priceOverride !== null ? `$${row.priceOverride.toFixed(2)}` : "—",
    },
    {
      key: "calculatedPrice",
      label: "Retail Price",
      render: (row) => {
        const price = calculateUOMBasePrice(
          baseRetailPrice,
          row.conversionFactor,
          row.priceOverride,
        );
        return `$${price.toFixed(2)}`;
      },
    },
    { key: "sortOrder", label: "Sort" },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="prod-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setFormErrors({}); setEditTarget(row); }}
          >
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
    <div className="prod-edit-section">
      <h2>Units of Measure</h2>

      {error && <div className="status-message status-error">{error}</div>}

      <Table columns={columns} data={uoms} emptyMessage="No UOMs yet." />

      {!showForm && !editTarget && (
        <Button size="sm" onClick={() => { setShowForm(true); setFormErrors({}); }} style={{ marginTop: "0.75rem" }}>
          Add UOM
        </Button>
      )}

      {showForm && (
        <form ref={formRef} action={handleAdd} className="prod-inline-form">
          <div className="form-field">
            <label>Name *</label>
            <input name="name" required placeholder="e.g., Box" />
            {formErrors.name && <p className="form-error-message">{formErrors.name}</p>}
          </div>
          <div className="form-field">
            <label>Factor *</label>
            <input name="conversionFactor" type="number" min="1" required placeholder="12" />
            {formErrors.conversionFactor && <p className="form-error-message">{formErrors.conversionFactor}</p>}
          </div>
          <div className="form-field">
            <label>Price Override</label>
            <input name="priceOverride" type="number" step="0.01" min="0" placeholder="Optional" />
            {formErrors.priceOverride && <p className="form-error-message">{formErrors.priceOverride}</p>}
          </div>
          <div className="form-field">
            <label>Sort</label>
            <input name="sortOrder" type="number" defaultValue="0" />
          </div>
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
        </form>
      )}

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit UOM">
        {editTarget && (
          <form action={handleUpdate}>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Name</label>
              <input name="name" className="form-input" required defaultValue={editTarget.name} />
              {formErrors.name && <p className="form-error-message">{formErrors.name}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Conversion Factor</label>
              <input name="conversionFactor" type="number" min="1" className="form-input" required defaultValue={editTarget.conversionFactor} />
              {formErrors.conversionFactor && <p className="form-error-message">{formErrors.conversionFactor}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Price Override</label>
              <input name="priceOverride" type="number" step="0.01" min="0" className="form-input" defaultValue={editTarget.priceOverride ?? ""} placeholder="Leave empty for calculated price" />
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Sort Order</label>
              <input name="sortOrder" type="number" className="form-input" defaultValue={editTarget.sortOrder} />
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" loading={isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete UOM">
        <p>Delete UOM <strong>{deleteTarget?.name}</strong> (x{deleteTarget?.conversionFactor})?</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
