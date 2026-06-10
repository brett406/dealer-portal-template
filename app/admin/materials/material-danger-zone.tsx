"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toggleMaterialArchived, deleteMaterial } from "./actions";
import "./materials.css";

export function MaterialDangerZone({
  materialId,
  materialName,
  archived,
  usedInCount,
}: {
  materialId: string;
  materialName: string;
  archived: boolean;
  usedInCount: number;
}) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggleArchived() {
    setError(null);
    startTransition(async () => {
      const result = await toggleMaterialArchived(materialId);
      if (result.error) setError(result.error);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteMaterial(materialId);
      if (result.error) {
        setError(result.error);
        setShowDelete(false);
      } else {
        router.push("/admin/materials");
      }
    });
  }

  return (
    <div className="mat-edit-section mat-danger-zone">
      <h2>Danger Zone</h2>

      {error && <div className="status-message status-error">{error}</div>}

      <div className="mat-danger-row">
        <p>
          {archived
            ? "This material is archived: hidden from add-pickers but still costing normally in existing BOMs."
            : "Archiving hides this material from add-pickers. BOMs that already use it keep costing normally."}
        </p>
        <Button variant="secondary" size="sm" onClick={handleToggleArchived} disabled={isPending}>
          {archived ? "Unarchive" : "Archive"}
        </Button>
      </div>

      <div className="mat-danger-row">
        <p>
          {usedInCount > 0
            ? `Delete is blocked — in use by ${usedInCount} BOM line${usedInCount === 1 ? "" : "s"}. Archive instead.`
            : "Permanently delete this material. Only possible while nothing references it."}
        </p>
        <Button
          variant="danger"
          size="sm"
          onClick={() => { setError(null); setShowDelete(true); }}
          disabled={isPending || usedInCount > 0}
        >
          Delete
        </Button>
      </div>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Material">
        <p>
          Permanently delete <strong>{materialName}</strong>? Its own BOM lines (components and
          labor) are deleted with it. This cannot be undone.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
