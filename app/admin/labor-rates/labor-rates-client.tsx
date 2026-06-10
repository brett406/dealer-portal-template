"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  createLaborRate,
  updateLaborRate,
  toggleLaborRateArchived,
  deleteLaborRate,
} from "./actions";

type LaborRate = {
  id: string;
  name: string;
  ratePerHour: number;
  archived: boolean;
  lineCount: number;
};

export function LaborRatesClient({ laborRates }: { laborRates: LaborRate[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<LaborRate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LaborRate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createLaborRate(fd);
      if (result.error) setError(result.error);
      else if (result.errors) setError(Object.values(result.errors).join(", "));
      else { setShowForm(false); formRef.current?.reset(); }
    });
  }

  function handleUpdate(fd: FormData) {
    if (!editTarget) return;
    setError(null);
    startTransition(async () => {
      const result = await updateLaborRate(editTarget.id, fd);
      if (result.error) setError(result.error);
      else if (result.errors) setError(Object.values(result.errors).join(", "));
      else setEditTarget(null);
    });
  }

  function handleToggleArchived(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await toggleLaborRateArchived(id);
      if (result.error) setError(result.error);
    });
  }

  function handleDelete(rate: LaborRate) {
    setError(null);
    startTransition(async () => {
      const result = await deleteLaborRate(rate.id);
      if (result.error) setError(result.error);
      setDeleteTarget(null);
    });
  }

  return (
    <>
      {error && <div className="status-message status-error">{error}</div>}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Rate / Hour</th>
              <th>In Use</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {laborRates.map((rate) => (
              <tr key={rate.id} style={{ opacity: rate.archived ? 0.5 : 1 }}>
                <td>{rate.name}</td>
                <td>${rate.ratePerHour.toFixed(2)}/hr</td>
                <td>
                  {rate.lineCount > 0
                    ? `${rate.lineCount} BOM line${rate.lineCount === 1 ? "" : "s"}`
                    : "—"}
                </td>
                <td>
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: rate.archived ? "var(--color-text-muted)" : "var(--color-success)",
                  }}>
                    {rate.archived ? "Archived" : "Active"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <Button variant="secondary" size="sm" onClick={() => setEditTarget(rate)}>Edit</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleArchived(rate.id)}
                      disabled={isPending}
                    >
                      {rate.archived ? "Unarchive" : "Archive"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => { setError(null); setDeleteTarget(rate); }}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {laborRates.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
                  No labor rates defined.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!showForm && (
        <Button size="sm" onClick={() => setShowForm(true)} style={{ marginTop: "1rem" }}>
          Add Labor Rate
        </Button>
      )}

      {showForm && (
        <form ref={formRef} action={handleAdd} style={{
          display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap",
          padding: "1rem", background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)", marginTop: "1rem",
        }}>
          <div className="form-field" style={{ flex: 1, minWidth: "160px", marginBottom: 0 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>Name</label>
            <input name="name" placeholder="e.g., Welder" style={{ padding: "0.4rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", width: "100%" }} />
          </div>
          <div className="form-field" style={{ minWidth: "110px", marginBottom: 0 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>Rate / Hour</label>
            <input name="ratePerHour" type="number" step="0.01" min="0" placeholder="60.00" style={{ padding: "0.4rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", width: "110px" }} />
          </div>
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
        </form>
      )}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Labor Rate">
        {editTarget && (
          <form action={handleUpdate}>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Name</label>
              <input name="name" className="form-input" required defaultValue={editTarget.name} />
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Rate / Hour</label>
              <input name="ratePerHour" type="number" step="0.01" min="0" className="form-input" required defaultValue={editTarget.ratePerHour.toFixed(2)} />
            </div>
            {editTarget.lineCount > 0 && (
              <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
                Changing the rate reprices every BOM-priced product that uses it
                ({editTarget.lineCount} BOM line{editTarget.lineCount === 1 ? "" : "s"}).
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" loading={isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Labor Rate">
        <p>
          Delete labor rate <strong>{deleteTarget?.name}</strong>? This only works when no BOM
          lines reference it — otherwise archive it instead.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
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
