"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  createCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
} from "./actions";
import "@/app/admin/pages/pages.css";

type FieldDef = { key: string; type: string; label: string; default?: string };

export function CollectionEditorClient({
  collectionKey,
  fields,
  defaultValues,
  defaultSlug,
  defaultPublished,
  itemId,
}: {
  collectionKey: string;
  fields: FieldDef[];
  defaultValues: Record<string, unknown>;
  defaultSlug: string;
  defaultPublished: boolean;
  itemId: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isPublished, setIsPublished] = useState(defaultPublished);
  const publishIntentRef = useRef<boolean>(false);
  const router = useRouter();

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

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);

    // Set published based on which button was clicked
    if (publishIntentRef.current) {
      formData.set("published", "on");
    } else {
      formData.delete("published");
    }

    startTransition(async () => {
      const result = itemId
        ? await updateCollectionItem(itemId, collectionKey, formData)
        : await createCollectionItem(collectionKey, formData);
      if (result.error) setError(result.error);
      else {
        setSuccess(true);
        setIsPublished(publishIntentRef.current);
      }
    });
  }

  function handleDelete() {
    if (!itemId || !confirm("Delete this item? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteCollectionItem(itemId, collectionKey);
    });
  }

  return (
    <div className="page-editor-section">
      <h2>{itemId ? "Edit Item" : "New Item"}</h2>

      {success && <div className="status-message status-success">Saved successfully.</div>}
      {error && <div className="status-message status-error">{error}</div>}

      <form action={handleSubmit} className="page-form">
        <Input
          label="Slug"
          name="slug"
          defaultValue={defaultSlug}
          placeholder="auto-generated-from-title"
        />

        {isPublished && (
          <div style={{ marginBottom: "1rem", padding: "0.5rem 0.75rem", background: "color-mix(in srgb, var(--color-success, #22c55e) 10%, transparent)", borderRadius: "var(--radius-md)", fontSize: "0.85rem", color: "var(--color-success, #22c55e)", fontWeight: 500 }}>
            Published
          </div>
        )}

        {fields.map((field) => {
          const currentValue = (defaultValues[field.key] as string) ?? field.default ?? "";

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
                    {uploading === field.key && (
                      <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Uploading...</span>
                    )}
                  </div>
                </div>
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

        <div className="page-form-actions">
          <Button
            type="submit"
            loading={isPending}
            onClick={() => { publishIntentRef.current = true; }}
          >
            {isPublished ? "Save & Keep Published" : "Publish"}
          </Button>
          <Button
            type="submit"
            variant="secondary"
            loading={isPending}
            onClick={() => { publishIntentRef.current = false; }}
          >
            {itemId ? (isPublished ? "Unpublish" : "Save as Draft") : "Save as Draft"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/admin/collections/${collectionKey}`)}
          >
            Cancel
          </Button>
          {itemId && (
            <Button type="button" variant="danger" onClick={handleDelete} loading={isPending}>
              Delete
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
