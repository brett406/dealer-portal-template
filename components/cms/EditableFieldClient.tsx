"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEditMode } from "./EditModeProvider";
import { MediaPicker } from "./MediaPicker";
import { updatePageContent } from "@/app/admin/pages/actions";
import "./cms-edit.css";

type Props = {
  pageKey: string;
  fieldKey: string;
  type: "text" | "richtext" | "image";
  value: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Editor-only client wrapper. When edit mode is off it renders the normal
 * output. When on, the field becomes click-to-edit; saving posts ONLY this
 * field via updatePageContent with `__partial`, then refreshes the server
 * tree so the new value renders (force-dynamic re-reads the DB).
 */
export function EditableFieldClient({ pageKey, fieldKey, type, value, className, children }: Props) {
  const { editing } = useEditMode();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!editing) return <>{children}</>;

  if (!active) {
    return (
      <span
        className={`cms-editable ${className ?? ""}`}
        role="button"
        tabIndex={0}
        title="Click to edit"
        onClick={() => { setDraft(value); setActive(true); setError(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") { setDraft(value); setActive(true); } }}
      >
        {children}
      </span>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("__partial", "1");
      fd.append(`field_${fieldKey}`, draft);
      const res = await updatePageContent(pageKey, {}, fd);
      if (res?.error) {
        setError(res.error);
        setSaving(false);
        return;
      }
      setSaving(false);
      setActive(false);
      router.refresh();
    } catch {
      setError("Save failed");
      setSaving(false);
    }
  }

  return (
    <span className="cms-editing">
      {type === "image" ? (
        <span className="cms-image-edit">
          {draft && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft} alt="" className="cms-image-preview" />
          )}
          <input
            className="cms-editing-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Image URL"
          />
          <button type="button" className="cms-btn" onClick={() => setPickerOpen(true)}>
            Choose from library
          </button>
          {pickerOpen && (
            <MediaPicker
              onSelect={(url) => { setDraft(url); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </span>
      ) : (
        <textarea
          className="cms-editing-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={type === "richtext" ? 8 : 2}
        />
      )}
      <span className="cms-editing-actions">
        <button type="button" className="cms-btn cms-btn-save" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="cms-btn" onClick={() => setActive(false)} disabled={saving}>
          Cancel
        </button>
        {error && <span className="cms-editing-error">{error}</span>}
      </span>
    </span>
  );
}
