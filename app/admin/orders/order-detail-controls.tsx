"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  updateOrderStatusAction,
  updateInternalNotes,
  resendOrderConfirmation,
  exportOrderDetailAction,
} from "./actions";
import type { OrderStatus } from "@prisma/client";
import "./orders.css";

export function OrderDetailControls({
  orderId,
  currentStatus,
  validTransitions,
  internalNotes: initialNotes,
}: {
  orderId: string;
  currentStatus: string;
  validTransitions: OrderStatus[];
  internalNotes: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<OrderStatus | null>(null);
  const statusNotesRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  function handleStatusUpdate() {
    if (!confirmStatus) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const notes = statusNotesRef.current?.value || undefined;
      const result = await updateOrderStatusAction(orderId, confirmStatus, notes);
      if (result.error) setError(result.error);
      else setSuccess(`Status updated to ${confirmStatus}`);
      setConfirmStatus(null);
    });
  }

  function handleSaveNotes() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateInternalNotes(orderId, notesRef.current?.value ?? "");
      if (result.error) setError(result.error);
      else setSuccess("Notes saved");
    });
  }

  function handleResend() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await resendOrderConfirmation(orderId);
      if (result.error) setError(result.error);
      else setSuccess("Confirmation email sent");
    });
  }

  function handleExport() {
    startTransition(async () => {
      const csv = await exportOrderDetailAction(orderId);
      if (!csv) { setError("Failed to export"); return; }
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `order-${orderId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <>
      {/* Top-level feedback */}
      {error && <div className="status-message status-error">{error}</div>}
      {success && <div className="status-message status-success">{success}</div>}

      {/* Header action buttons */}
      <div className="ord-detail-header-actions">
        <Button variant="secondary" size="sm" onClick={handleResend} loading={isPending}>
          Resend Confirmation
        </Button>
        <Button variant="secondary" size="sm" onClick={handleExport} loading={isPending}>
          Export CSV
        </Button>
      </div>

      {/* Status update bar */}
      {validTransitions.length > 0 && (
        <div className="ord-status-update">
          <div className="form-field">
            <label>Update Status</label>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) setConfirmStatus(e.target.value as OrderStatus);
              }}
            >
              <option value="">Select...</option>
              {validTransitions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Internal notes */}
      <div className="ord-detail-card ord-internal-notes">
        <h3>Internal Notes (admin only)</h3>
        <textarea
          ref={notesRef}
          defaultValue={initialNotes}
          placeholder="Notes visible only to staff..."
        />
        <div className="ord-internal-notes-actions">
          <Button size="sm" onClick={handleSaveNotes} loading={isPending}>
            Save Notes
          </Button>
        </div>
      </div>

      {/* Status confirmation modal */}
      <Modal
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        title="Confirm Status Change"
      >
        <p>
          Change status from <strong>{currentStatus}</strong> to{" "}
          <strong>{confirmStatus}</strong>?
        </p>
        <div className="form-field" style={{ marginTop: "1rem" }}>
          <label className="form-label">Notes (optional)</label>
          <textarea
            ref={statusNotesRef}
            className="form-input form-textarea"
            placeholder="e.g., Tracking number, reason for change..."
            rows={3}
          />
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setConfirmStatus(null)}>
            Cancel
          </Button>
          <Button onClick={handleStatusUpdate} loading={isPending}>
            Update Status
          </Button>
        </div>
      </Modal>
    </>
  );
}
