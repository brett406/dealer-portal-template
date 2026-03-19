"use client";

import { useState, useActionState, useTransition, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  addGroupItem,
  updateGroupItem,
  deleteGroupItem,
  reorderGroupItems,
  type FormState,
} from "./actions";
import "./pages.css";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

type FieldDef = { key: string; type: string; label: string; default?: string };
type GroupDef = { key: string; label: string; fields: FieldDef[] };
type GroupItem = { id: string; sortOrder: number; payload: Record<string, unknown> };

export function PageEditorClient({
  pageKey,
  fieldDefs,
  groupDefs,
  currentPayload,
  currentSeo,
  currentGroups,
  formAction,
}: {
  pageKey: string;
  fieldDefs: FieldDef[];
  groupDefs: GroupDef[];
  currentPayload: Record<string, unknown>;
  currentSeo: Record<string, unknown>;
  currentGroups: Record<string, GroupItem[]>;
  formAction: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const hasGroups = groupDefs.length > 0;
  const [activeTab, setActiveTab] = useState<"content" | "groups" | "seo">("content");

  return (
    <>
      {(hasGroups || true) && (
        <div className="page-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={activeTab === "content"} className={`page-tab ${activeTab === "content" ? "active" : ""}`} onClick={() => setActiveTab("content")}>
            Content
          </button>
          {hasGroups && (
            <button type="button" role="tab" aria-selected={activeTab === "groups"} className={`page-tab ${activeTab === "groups" ? "active" : ""}`} onClick={() => setActiveTab("groups")}>
              Groups
            </button>
          )}
          <button type="button" role="tab" aria-selected={activeTab === "seo"} className={`page-tab ${activeTab === "seo" ? "active" : ""}`} onClick={() => setActiveTab("seo")}>
            SEO
          </button>
        </div>
      )}

      {activeTab === "content" && (
        <ContentTab
          fieldDefs={fieldDefs}
          currentPayload={currentPayload}
          currentSeo={currentSeo}
          formAction={formAction}
        />
      )}

      {activeTab === "groups" && hasGroups && (
        <GroupsTab pageKey={pageKey} groupDefs={groupDefs} currentGroups={currentGroups} />
      )}

      {activeTab === "seo" && (
        <SeoTab currentSeo={currentSeo} formAction={formAction} fieldDefs={fieldDefs} currentPayload={currentPayload} />
      )}
    </>
  );
}

// ─── Content Tab ─────────────────────────────────────────────────────────────

function ContentTab({
  fieldDefs,
  currentPayload,
  currentSeo,
  formAction,
}: {
  fieldDefs: FieldDef[];
  currentPayload: Record<string, unknown>;
  currentSeo: Record<string, unknown>;
  formAction: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, action] = useActionState(formAction, {});
  const [uploading, setUploading] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  async function handleImageUpload(fieldKey: string, file: File) {
    setUploading(fieldKey);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      setImageUrls((prev) => ({ ...prev, [fieldKey]: data.url }));
    }
    setUploading(null);
  }

  return (
    <div className="page-editor-section">
      <h2>Page Content</h2>
      {state.success && <div className="status-message status-success">Saved successfully.</div>}
      {state.error && <div className="status-message status-error">{state.error}</div>}

      <form action={action} className="page-form">
        {fieldDefs.map((field) => {
          const currentValue = (currentPayload[field.key] as string) ?? field.default ?? "";

          if (field.type === "image") {
            const displayUrl = imageUrls[field.key] || currentValue;
            return (
              <div key={field.key} className="form-field" style={{ marginBottom: "1rem" }}>
                <label className="form-label">{field.label}</label>
                <div className="page-image-field">
                  {displayUrl && (
                    <img src={displayUrl} alt="" className="page-image-preview" />
                  )}
                  <div className="page-image-controls">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(field.key, f);
                      }}
                      style={{ fontSize: "0.8rem" }}
                    />
                    <input type="hidden" name={`field_${field.key}`} value={displayUrl} />
                    {uploading === field.key && <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Uploading...</span>}
                  </div>
                </div>
              </div>
            );
          }

          if (field.type === "boolean") {
            return (
              <div key={field.key} className="form-field" style={{ marginBottom: "1rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 500 }}>
                  <input type="checkbox" name={`field_${field.key}`} defaultChecked={currentValue === "true"} />
                  {field.label}
                </label>
              </div>
            );
          }

          return (
            <Input
              key={field.key}
              label={field.label}
              name={`field_${field.key}`}
              type={field.type === "richtext" ? "textarea" : "text"}
              defaultValue={currentValue}
            />
          );
        })}

        {/* Include current SEO so it's not wiped on save */}
        <input type="hidden" name="seo_title" value={(currentSeo.title as string) ?? ""} />
        <input type="hidden" name="seo_description" value={(currentSeo.description as string) ?? ""} />

        <div className="page-form-actions">
          <SubmitButton label="Save Page" />
        </div>
      </form>
    </div>
  );
}

// ─── SEO Tab ─────────────────────────────────────────────────────────────────

function SeoTab({
  currentSeo,
  formAction,
  fieldDefs,
  currentPayload,
}: {
  currentSeo: Record<string, unknown>;
  formAction: (state: FormState, formData: FormData) => Promise<FormState>;
  fieldDefs: FieldDef[];
  currentPayload: Record<string, unknown>;
}) {
  const [state, action] = useActionState(formAction, {});

  return (
    <div className="page-editor-section">
      <h2>SEO Settings</h2>
      {state.success && <div className="status-message status-success">Saved successfully.</div>}

      <form action={action} className="page-form">
        {/* Preserve content fields */}
        {fieldDefs.map((field) => (
          <input key={field.key} type="hidden" name={`field_${field.key}`} value={(currentPayload[field.key] as string) ?? field.default ?? ""} />
        ))}

        <Input
          label="Meta Title"
          name="seo_title"
          defaultValue={(currentSeo.title as string) ?? ""}
          placeholder="Page title for search engines"
        />
        <Input
          label="Meta Description"
          name="seo_description"
          type="textarea"
          defaultValue={(currentSeo.description as string) ?? ""}
          placeholder="Brief description for search results"
        />

        <div className="page-form-actions">
          <SubmitButton label="Save SEO" />
        </div>
      </form>
    </div>
  );
}

// ─── Groups Tab ──────────────────────────────────────────────────────────────

function GroupsTab({
  pageKey,
  groupDefs,
  currentGroups,
}: {
  pageKey: string;
  groupDefs: GroupDef[];
  currentGroups: Record<string, GroupItem[]>;
}) {
  return (
    <>
      {groupDefs.map((group) => (
        <GroupSection
          key={group.key}
          pageKey={pageKey}
          groupKey={group.key}
          groupLabel={group.label}
          fieldDefs={group.fields}
          items={currentGroups[group.key] ?? []}
        />
      ))}
    </>
  );
}

function GroupSection({
  pageKey,
  groupKey,
  groupLabel,
  fieldDefs,
  items,
}: {
  pageKey: string;
  groupKey: string;
  groupLabel: string;
  fieldDefs: FieldDef[];
  items: GroupItem[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<GroupItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addGroupItem(pageKey, groupKey, fd);
      if (result.error) setError(result.error);
      else { setShowForm(false); formRef.current?.reset(); }
    });
  }

  function handleUpdate(fd: FormData) {
    if (!editTarget) return;
    startTransition(async () => {
      const result = await updateGroupItem(editTarget.id, pageKey, groupKey, fd);
      if (result.error) setError(result.error);
      else setEditTarget(null);
    });
  }

  function handleDelete(item: GroupItem) {
    startTransition(async () => {
      const result = await deleteGroupItem(item.id, pageKey);
      if (result.error) setError(result.error);
    });
  }

  function handleMoveUp(idx: number) {
    if (idx === 0) return;
    const ids = items.map((i) => i.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    startTransition(async () => {
      await reorderGroupItems(pageKey, groupKey, ids);
    });
  }

  function handleMoveDown(idx: number) {
    if (idx >= items.length - 1) return;
    const ids = items.map((i) => i.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    startTransition(async () => {
      await reorderGroupItems(pageKey, groupKey, ids);
    });
  }

  // Get the first text field to use as the item title in the list
  const titleField = fieldDefs[0]?.key;

  return (
    <div className="page-editor-section">
      <h2>{groupLabel}</h2>

      {error && <div className="status-message status-error">{error}</div>}

      <div className="group-items">
        {items.map((item, idx) => (
          <div key={item.id} className="group-item-card">
            <div className="group-item-content">
              <strong>{(item.payload[titleField ?? ""] as string) || `Item ${idx + 1}`}</strong>
              {fieldDefs.slice(1).map((f) => (
                <p key={f.key} style={{ color: "var(--color-text-muted)" }}>
                  {f.label}: {(item.payload[f.key] as string) || "—"}
                </p>
              ))}
            </div>
            <div className="group-item-actions">
              <Button variant="ghost" size="sm" onClick={() => handleMoveUp(idx)} disabled={isPending || idx === 0}>
                ↑
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleMoveDown(idx)} disabled={isPending || idx === items.length - 1}>
                ↓
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditTarget(item)} disabled={isPending}>
                Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(item)} disabled={isPending}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
          No {groupLabel.toLowerCase()} yet.
        </p>
      )}

      {!showForm && !editTarget && (
        <Button size="sm" onClick={() => setShowForm(true)} style={{ marginTop: "0.75rem" }}>
          Add {groupLabel.replace(/s$/, "")}
        </Button>
      )}

      {showForm && (
        <form ref={formRef} action={handleAdd} className="group-add-form">
          {fieldDefs.map((f) => (
            <div key={f.key} className="form-field" style={{ minWidth: f.type === "text" ? "150px" : "auto", flex: 1 }}>
              <label>{f.label}</label>
              {f.type === "richtext" ? (
                <textarea name={`group_${f.key}`} rows={3} style={{ width: "100%" }} />
              ) : (
                <input name={`group_${f.key}`} placeholder={f.label} />
              )}
            </div>
          ))}
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
        </form>
      )}

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit ${groupLabel.replace(/s$/, "")}`}>
        {editTarget && (
          <form action={handleUpdate}>
            {fieldDefs.map((f) => (
              <div key={f.key} className="form-field" style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">{f.label}</label>
                {f.type === "richtext" ? (
                  <textarea name={`group_${f.key}`} className="form-input form-textarea" defaultValue={(editTarget.payload[f.key] as string) ?? ""} rows={4} />
                ) : (
                  <input name={`group_${f.key}`} className="form-input" defaultValue={(editTarget.payload[f.key] as string) ?? ""} />
                )}
              </div>
            ))}
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" loading={isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
