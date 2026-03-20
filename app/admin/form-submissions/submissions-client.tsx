"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteSubmission } from "./actions";

type Submission = {
  id: string;
  formKey: string;
  payload: Record<string, string>;
  createdAt: string;
};

export function FormSubmissionsClient({ submissions }: { submissions: Submission[] }) {
  const [viewTarget, setViewTarget] = useState<Submission | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteSubmission(id);
    });
  }

  if (submissions.length === 0) {
    return (
      <p style={{ color: "var(--color-text-muted)" }}>
        No form submissions yet.
      </p>
    );
  }

  return (
    <>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Form</th>
              <th>Name</th>
              <th>Email</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td>
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "var(--color-primary)",
                    background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}>
                    {s.formKey}
                  </span>
                </td>
                <td>{s.payload.name || "—"}</td>
                <td>{s.payload.email || "—"}</td>
                <td style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                  {new Date(s.createdAt).toLocaleString()}
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button variant="secondary" size="sm" onClick={() => setViewTarget(s)}>
                      View
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(s.id)} disabled={isPending}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Form Submission">
        {viewTarget && (
          <div>
            <div style={{ marginBottom: "0.75rem" }}>
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "var(--color-primary)",
              }}>
                {viewTarget.formKey}
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginLeft: "0.75rem" }}>
                {new Date(viewTarget.createdAt).toLocaleString()}
              </span>
            </div>
            <div style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "1rem",
            }}>
              {Object.entries(viewTarget.payload).map(([key, value]) => (
                <div key={key} style={{ marginBottom: "0.5rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "0.15rem" }}>
                    {key}
                  </div>
                  <div style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{value || "—"}</div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setViewTarget(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
