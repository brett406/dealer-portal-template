"use client";

import { useEditMode } from "./EditModeProvider";
import "./cms-edit.css";

/**
 * Floating control to toggle inline edit mode. Editor-only (mounted by the
 * marketing layout inside EditModeProvider).
 */
export function EditToolbar() {
  const { editing, setEditing } = useEditMode();
  return (
    <div className="cms-edit-toolbar" data-editing={editing}>
      <button
        type="button"
        className="cms-edit-toggle"
        onClick={() => setEditing(!editing)}
      >
        {editing ? "✓ Done editing" : "✎ Edit page"}
      </button>
      {editing && <span className="cms-edit-hint">Click highlighted content to edit</span>}
    </div>
  );
}
