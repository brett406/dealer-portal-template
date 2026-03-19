"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { addAddress, updateAddress, deleteAddress, setDefaultAddress } from "./actions";
import "./companies.css";

type Address = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

export function AddressSection({
  companyId,
  addresses,
}: {
  companyId: string;
  addresses: Address[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Address | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(fd: FormData) {
    setError(null);
    setFormErrors({});
    startTransition(async () => {
      const result = await addAddress(companyId, fd);
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
      const result = await updateAddress(editTarget.id, fd);
      if (result.errors) {
        setFormErrors(result.errors);
      } else if (result.error) {
        setError(result.error);
      } else {
        setEditTarget(null);
      }
    });
  }

  function handleDelete(a: Address) {
    setError(null);
    startTransition(async () => {
      const result = await deleteAddress(a.id);
      if (result.error) setError(result.error);
      setDeleteTarget(null);
    });
  }

  function handleSetDefault(a: Address) {
    startTransition(async () => {
      const result = await setDefaultAddress(a.id);
      if (result.error) setError(result.error);
    });
  }

  function formatAddress(a: Address): string {
    let addr = a.line1;
    if (a.line2) addr += `, ${a.line2}`;
    addr += `\n${a.city}, ${a.state} ${a.postalCode}`;
    if (a.country !== "US") addr += ` ${a.country}`;
    return addr;
  }

  return (
    <div className="co-edit-section">
      <h2>Address Book</h2>

      {error && <div className="status-message status-error">{error}</div>}

      {addresses.length > 0 ? (
        <div className="co-address-list">
          {addresses.map((a) => (
            <div key={a.id} className={`co-address-card ${a.isDefault ? "is-default" : ""}`}>
              <div className="co-address-label">
                {a.label}
                {a.isDefault && <span className="co-badge co-badge-approved">Default</span>}
              </div>
              <div className="co-address-body">
                {formatAddress(a).split("\n").map((line, i) => (
                  <span key={i}>{line}<br /></span>
                ))}
              </div>
              <div className="co-address-actions">
                {!a.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => handleSetDefault(a)} disabled={isPending}>
                    Set Default
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => { setFormErrors({}); setEditTarget(a); }}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => { setError(null); setDeleteTarget(a); }}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
          No addresses yet.
        </p>
      )}

      {!showForm && !editTarget && (
        <Button size="sm" onClick={() => { setShowForm(true); setFormErrors({}); }} style={{ marginTop: "1rem" }}>
          Add Address
        </Button>
      )}

      {showForm && (
        <form ref={formRef} action={handleAdd} className="co-inline-form" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="form-field" style={{ minWidth: "150px" }}>
              <label>Label *</label>
              <input name="label" required placeholder="e.g., Main Warehouse" />
              {formErrors.label && <p className="form-error-message">{formErrors.label}</p>}
            </div>
            <div className="form-field" style={{ flex: 2, minWidth: "200px" }}>
              <label>Address Line 1 *</label>
              <input name="line1" required placeholder="Street address" />
              {formErrors.line1 && <p className="form-error-message">{formErrors.line1}</p>}
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: "150px" }}>
              <label>Line 2</label>
              <input name="line2" placeholder="Suite, unit, etc." />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: 2, minWidth: "150px" }}>
              <label>City *</label>
              <input name="city" required placeholder="City" />
              {formErrors.city && <p className="form-error-message">{formErrors.city}</p>}
            </div>
            <div className="form-field" style={{ minWidth: "80px" }}>
              <label>State *</label>
              <input name="state" required placeholder="ST" />
              {formErrors.state && <p className="form-error-message">{formErrors.state}</p>}
            </div>
            <div className="form-field" style={{ minWidth: "100px" }}>
              <label>Postal Code *</label>
              <input name="postalCode" required placeholder="12345" />
              {formErrors.postalCode && <p className="form-error-message">{formErrors.postalCode}</p>}
            </div>
            <div className="form-field" style={{ minWidth: "80px" }}>
              <label>Country</label>
              <input name="country" defaultValue="US" placeholder="US" />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <label className="co-toggle-label">
              <input type="checkbox" name="isDefault" />
              <span>Set as default</span>
            </label>
            <Button type="submit" size="sm" loading={isPending}>Add</Button>
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Address">
        {editTarget && (
          <form action={handleUpdate}>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Label</label>
              <input name="label" className="form-input" required defaultValue={editTarget.label} />
              {formErrors.label && <p className="form-error-message">{formErrors.label}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Address Line 1</label>
              <input name="line1" className="form-input" required defaultValue={editTarget.line1} />
              {formErrors.line1 && <p className="form-error-message">{formErrors.line1}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Line 2</label>
              <input name="line2" className="form-input" defaultValue={editTarget.line2 ?? ""} />
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <div className="form-field" style={{ flex: 2, marginBottom: "0.75rem" }}>
                <label className="form-label">City</label>
                <input name="city" className="form-input" required defaultValue={editTarget.city} />
                {formErrors.city && <p className="form-error-message">{formErrors.city}</p>}
              </div>
              <div className="form-field" style={{ flex: 1, marginBottom: "0.75rem" }}>
                <label className="form-label">State</label>
                <input name="state" className="form-input" required defaultValue={editTarget.state} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <div className="form-field" style={{ flex: 1, marginBottom: "0.75rem" }}>
                <label className="form-label">Postal Code</label>
                <input name="postalCode" className="form-input" required defaultValue={editTarget.postalCode} />
              </div>
              <div className="form-field" style={{ flex: 1, marginBottom: "0.75rem" }}>
                <label className="form-label">Country</label>
                <input name="country" className="form-input" defaultValue={editTarget.country} />
              </div>
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="co-toggle-label">
                <input type="checkbox" name="isDefault" defaultChecked={editTarget.isDefault} />
                <span>Default address</span>
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
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Address">
        <p>Delete the <strong>{deleteTarget?.label}</strong> address?</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
