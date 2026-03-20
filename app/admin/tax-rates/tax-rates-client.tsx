"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { createTaxRate, updateTaxRate, toggleTaxRateActive } from "./actions";

type TaxRate = {
  id: string;
  name: string;
  label: string;
  percent: number;
  description: string | null;
  active: boolean;
  companyCount: number;
};

export function TaxRatesClient({ taxRates }: { taxRates: TaxRate[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<TaxRate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createTaxRate(fd);
      if (result.error) setError(result.error);
      else if (result.errors) setError(Object.values(result.errors).join(", "));
      else { setShowForm(false); formRef.current?.reset(); }
    });
  }

  function handleUpdate(fd: FormData) {
    if (!editTarget) return;
    startTransition(async () => {
      const result = await updateTaxRate(editTarget.id, fd);
      if (result.error) setError(result.error);
      else if (result.errors) setError(Object.values(result.errors).join(", "));
      else setEditTarget(null);
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleTaxRateActive(id);
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
              <th>Label</th>
              <th>Rate</th>
              <th>Description</th>
              <th>Companies</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {taxRates.map((tr) => (
              <tr key={tr.id} style={{ opacity: tr.active ? 1 : 0.5 }}>
                <td>{tr.name}</td>
                <td>{tr.label}</td>
                <td>{tr.percent}%</td>
                <td style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>{tr.description ?? "—"}</td>
                <td>{tr.companyCount}</td>
                <td>
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: tr.active ? "var(--color-success)" : "var(--color-text-muted)",
                  }}>
                    {tr.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button variant="secondary" size="sm" onClick={() => setEditTarget(tr)}>Edit</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(tr.id)}
                      disabled={isPending}
                    >
                      {tr.active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {taxRates.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
                  No tax rates defined.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!showForm && (
        <Button size="sm" onClick={() => setShowForm(true)} style={{ marginTop: "1rem" }}>
          Add Tax Rate
        </Button>
      )}

      {showForm && (
        <form ref={formRef} action={handleAdd} style={{
          display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap",
          padding: "1rem", background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)", marginTop: "1rem",
        }}>
          <div className="form-field" style={{ flex: 1, minWidth: "120px", marginBottom: 0 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>Name</label>
            <input name="name" placeholder="Province name" style={{ padding: "0.4rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", width: "100%" }} />
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: "120px", marginBottom: 0 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>Label</label>
            <input name="label" placeholder="AB - GST 5%" style={{ padding: "0.4rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", width: "100%" }} />
          </div>
          <div className="form-field" style={{ minWidth: "80px", marginBottom: 0 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>Rate %</label>
            <input name="percent" type="number" step="0.001" placeholder="5.00" style={{ padding: "0.4rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", width: "80px" }} />
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: "120px", marginBottom: 0 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>Description</label>
            <input name="description" placeholder="5% GST + 7% PST" style={{ padding: "0.4rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", width: "100%" }} />
          </div>
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
        </form>
      )}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Tax Rate">
        {editTarget && (
          <form action={handleUpdate}>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Name</label>
              <input name="name" className="form-input" required defaultValue={editTarget.name} />
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Label</label>
              <input name="label" className="form-input" required defaultValue={editTarget.label} />
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Rate %</label>
              <input name="percent" type="number" step="0.001" className="form-input" required defaultValue={editTarget.percent} />
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Description</label>
              <input name="description" className="form-input" defaultValue={editTarget.description ?? ""} />
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" loading={isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
