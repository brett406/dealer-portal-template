"use client";

import { useState, useTransition, useRef } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  addCustomerContact,
  updateCustomerContact,
  toggleCustomerActive,
  resetCustomerPassword,
  deleteCustomerContact,
} from "./actions";
import "./companies.css";

type Contact = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  active: boolean;
  createdAt: string;
};

export function ContactSection({
  companyId,
  contacts,
  canActAs = false,
  companyApproved = false,
}: {
  companyId: string;
  contacts: Contact[];
  canActAs?: boolean;
  companyApproved?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [resetTarget, setResetTarget] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(fd: FormData) {
    setError(null);
    setFormErrors({});
    setTempPassword(null);
    startTransition(async () => {
      const result = await addCustomerContact(companyId, fd);
      if (result.errors) {
        setFormErrors(result.errors);
      } else if (result.error) {
        setError(result.error);
      } else {
        setShowForm(false);
        formRef.current?.reset();
        if (result.tempPassword) setTempPassword(result.tempPassword);
      }
    });
  }

  function handleUpdate(fd: FormData) {
    if (!editTarget) return;
    setFormErrors({});
    startTransition(async () => {
      const result = await updateCustomerContact(editTarget.id, fd);
      if (result.errors) {
        setFormErrors(result.errors);
      } else if (result.error) {
        setError(result.error);
      } else {
        setEditTarget(null);
      }
    });
  }

  function handleDelete(c: Contact) {
    setError(null);
    startTransition(async () => {
      const result = await deleteCustomerContact(c.id);
      if (result.error) setError(result.error);
      setDeleteTarget(null);
    });
  }

  function handleToggle(c: Contact) {
    startTransition(async () => {
      const result = await toggleCustomerActive(c.id);
      if (result.error) setError(result.error);
    });
  }

  function handleResetPassword(c: Contact, customPassword?: string) {
    setTempPassword(null);
    startTransition(async () => {
      const result = await resetCustomerPassword(c.id, customPassword);
      if (result.error) setError(result.error);
      if (result.tempPassword) setTempPassword(result.tempPassword);
      setResetTarget(null);
    });
  }

  function handleActAs(c: Contact) {
    startTransition(async () => {
      const { startActingAsCustomer } = await import("./act-as-actions");
      const validation = await startActingAsCustomer(c.id);
      if (validation.error) {
        setError(validation.error);
        return;
      }
      // Set the JWT via API route
      const res = await fetch("/api/auth/act-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: c.id }),
      });
      if (res.ok) {
        window.location.href = "/portal/dashboard";
      } else {
        const data = await res.json();
        setError(data.error || "Failed to enter customer portal");
      }
    });
  }

  const columns: TableColumn<Contact>[] = [
    {
      key: "name",
      label: "Name",
      render: (row) => (
        <span className={!row.active ? "co-inactive" : ""}>
          {row.name}
          {!row.active && <span className="co-badge co-badge-inactive" style={{ marginLeft: "0.4rem" }}>Inactive</span>}
        </span>
      ),
    },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone", render: (row) => row.phone || "—" },
    { key: "title", label: "Title", render: (row) => row.title || "—" },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="co-actions">
          {canActAs && row.active && companyApproved && (
            <Button variant="primary" size="sm" onClick={() => handleActAs(row)} disabled={isPending}>
              Enter Portal
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => { setError(null); setResetTarget(row); }} disabled={isPending}>
            Reset PW
          </Button>
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
    <div className="co-edit-section">
      <h2>Customer Contacts</h2>

      {error && <div className="status-message status-error">{error}</div>}
      {tempPassword && (
        <div className="co-temp-password">
          Temporary password: <code>{tempPassword}</code> — share this with the user securely. It will not be shown again.
        </div>
      )}

      <Table columns={columns} data={contacts} emptyMessage="No contacts yet." />

      {!showForm && !editTarget && (
        <Button size="sm" onClick={() => { setShowForm(true); setFormErrors({}); setTempPassword(null); }} style={{ marginTop: "0.75rem" }}>
          Add Contact
        </Button>
      )}

      {showForm && (
        <form ref={formRef} action={handleAdd} className="co-inline-form">
          <div className="form-field">
            <label>Name *</label>
            <input name="name" required placeholder="Full name" />
            {formErrors.name && <p className="form-error-message">{formErrors.name}</p>}
          </div>
          <div className="form-field">
            <label>Email *</label>
            <input name="email" type="email" required placeholder="user@company.com" />
            {formErrors.email && <p className="form-error-message">{formErrors.email}</p>}
          </div>
          <div className="form-field">
            <label>Phone</label>
            <input name="phone" placeholder="(555) 123-4567" />
          </div>
          <div className="form-field">
            <label>Title</label>
            <input name="title" placeholder="e.g., Buyer" />
          </div>
          <div className="form-field">
            <label>Password (optional)</label>
            <input name="password" type="text" placeholder="Leave blank to auto-generate" />
            {formErrors.password && <p className="form-error-message">{formErrors.password}</p>}
          </div>
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
        </form>
      )}

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Contact">
        {editTarget && (
          <form action={handleUpdate}>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Name</label>
              <input name="name" className="form-input" required defaultValue={editTarget.name} />
              {formErrors.name && <p className="form-error-message">{formErrors.name}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Email</label>
              <input name="email" type="email" className="form-input" required defaultValue={editTarget.email} />
              {formErrors.email && <p className="form-error-message">{formErrors.email}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Phone</label>
              <input name="phone" className="form-input" defaultValue={editTarget.phone ?? ""} />
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Title</label>
              <input name="title" className="form-input" defaultValue={editTarget.title ?? ""} />
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" loading={isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Contact">
        <p>Delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})? This will also remove their user account.</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </div>
      </Modal>

      {/* Reset password */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset Password">
        {resetTarget && (
          <ResetPasswordForm
            contact={resetTarget}
            onReset={handleResetPassword}
            onCancel={() => setResetTarget(null)}
            isPending={isPending}
          />
        )}
      </Modal>
    </div>
  );
}

function ResetPasswordForm({
  contact,
  onReset,
  onCancel,
  isPending,
}: {
  contact: Contact;
  onReset: (c: Contact, password?: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [password, setPassword] = useState("");

  return (
    <div>
      <p>Reset password for <strong>{contact.name}</strong> ({contact.email})</p>
      <div className="form-field" style={{ marginTop: "16px", marginBottom: "16px" }}>
        <label className="form-label">New Password (optional)</label>
        <input
          type="text"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave blank to auto-generate"
        />
        <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }}>
          Min 8 characters if setting a custom password.
        </p>
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button
          loading={isPending}
          onClick={() => onReset(contact, password || undefined)}
        >
          {password ? "Set Password" : "Auto-Generate"}
        </Button>
      </div>
    </div>
  );
}
