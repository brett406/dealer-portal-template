"use client";

import { useActionState, useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { generateSlug } from "@/lib/slug";
import type { CategoryFormState } from "./actions";
import "./categories.css";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

interface CategoryFormProps {
  action: (state: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  defaultValues?: {
    name?: string;
    slug?: string;
    description?: string;
    sortOrder?: number;
    active?: boolean;
    featured?: boolean;
    imageUrl?: string;
  };
  submitLabel: string;
}

export function CategoryForm({ action, defaultValues, submitLabel }: CategoryFormProps) {
  const [state, formAction] = useActionState(action, {});
  const [slug, setSlug] = useState(defaultValues?.slug ?? "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [imageUrl, setImageUrl] = useState(defaultValues?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setImageUrl(data.url);
        if (fileRef.current) fileRef.current.value = "";
      }
    } finally {
      setUploading(false);
    }
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugManuallyEdited) {
      setSlug(generateSlug(e.target.value));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugManuallyEdited(true);
    setSlug(e.target.value);
  }

  return (
    <form action={formAction} className="cat-form">
      <div className="form-field">
        <label htmlFor="input-name" className="form-label">
          Name <span className="form-required" aria-hidden="true">*</span>
        </label>
        <input
          id="input-name"
          name="name"
          type="text"
          className="form-input"
          required
          defaultValue={defaultValues?.name}
          placeholder="e.g., Power Tools"
          onChange={handleNameChange}
        />
        {state.errors?.name && <p className="form-error-message">{state.errors.name}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="input-slug" className="form-label">
          Slug
        </label>
        <input
          id="input-slug"
          name="slug"
          type="text"
          className="form-input"
          value={slug}
          onChange={handleSlugChange}
          placeholder="auto-generated-from-name"
        />
        {slug && (
          <p className="cat-slug-preview">
            URL: /categories/<strong>{slug}</strong>
          </p>
        )}
        {state.errors?.slug && <p className="form-error-message">{state.errors.slug}</p>}
      </div>

      <Input
        label="Description"
        name="description"
        type="textarea"
        defaultValue={defaultValues?.description}
        error={state.errors?.description}
        placeholder="Optional description"
      />

      <div className="form-field">
        <label className="form-label">Category Image</label>
        <input type="hidden" name="imageUrl" value={imageUrl} />
        {imageUrl && (
          <div className="cat-image-preview">
            <img src={imageUrl} alt="Category" />
            <button type="button" className="cat-image-remove" onClick={() => setImageUrl("")} title="Remove image">
              &times;
            </button>
          </div>
        )}
        <div className="cat-image-upload">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
            style={{ fontSize: "0.85rem" }}
          />
          <Button type="button" size="sm" onClick={handleImageUpload} loading={uploading}>
            Upload
          </Button>
        </div>
        <p className="cat-toggle-hint">Optional image displayed on the storefront and homepage.</p>
      </div>

      <Input
        label="Sort Order"
        name="sortOrder"
        type="number"
        defaultValue={String(defaultValues?.sortOrder ?? 0)}
        error={state.errors?.sortOrder}
      />

      <div className="form-field">
        <label className="cat-toggle-label">
          <input
            type="checkbox"
            name="active"
            defaultChecked={defaultValues?.active ?? true}
          />
          <span>Active</span>
        </label>
        <p className="cat-toggle-hint">Inactive categories are hidden from the storefront.</p>
      </div>

      <div className="form-field">
        <label className="cat-toggle-label">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={defaultValues?.featured ?? false}
          />
          <span>Featured</span>
        </label>
        <p className="cat-toggle-hint">Featured categories appear on the homepage.</p>
      </div>

      <div className="cat-form-actions">
        <SubmitButton label={submitLabel} />
        <Button variant="secondary" href="/admin/categories">
          Cancel
        </Button>
      </div>
    </form>
  );
}
