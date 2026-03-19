"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { generateSlug, type FormState } from "./actions";
import "./products.css";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

type Category = { id: string; name: string };

interface ProductBasicFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  categories: Category[];
  defaultValues?: {
    name?: string;
    slug?: string;
    categoryId?: string;
    description?: string;
    minOrderQuantity?: number | null;
    sortOrder?: number;
    active?: boolean;
  };
  submitLabel: string;
  cancelHref: string;
}

export function ProductBasicForm({
  action,
  categories,
  defaultValues,
  submitLabel,
  cancelHref,
}: ProductBasicFormProps) {
  const [state, formAction] = useActionState(action, {});
  const [slug, setSlug] = useState(defaultValues?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugEdited) setSlug(generateSlug(e.target.value));
  }

  return (
    <form action={formAction} className="prod-form">
      {state.success && (
        <div className="status-message status-success">Product saved successfully.</div>
      )}

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
          placeholder="e.g., Pro Cordless Drill"
          onChange={handleNameChange}
        />
        {state.errors?.name && <p className="form-error-message">{state.errors.name}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="input-slug" className="form-label">Slug</label>
        <input
          id="input-slug"
          name="slug"
          type="text"
          className="form-input"
          value={slug}
          onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }}
          placeholder="auto-generated"
        />
        {slug && (
          <p className="prod-slug-preview">
            URL: /products/<strong>{slug}</strong>
          </p>
        )}
        {state.errors?.slug && <p className="form-error-message">{state.errors.slug}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="input-categoryId" className="form-label">
          Category <span className="form-required" aria-hidden="true">*</span>
        </label>
        <select
          id="input-categoryId"
          name="categoryId"
          className="form-input"
          required
          defaultValue={defaultValues?.categoryId ?? ""}
        >
          <option value="">Select a category...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {state.errors?.categoryId && (
          <p className="form-error-message">{state.errors.categoryId}</p>
        )}
      </div>

      <Input
        label="Description"
        name="description"
        type="textarea"
        defaultValue={defaultValues?.description}
        error={state.errors?.description}
        placeholder="Product description"
      />

      <div className="prod-form-row">
        <Input
          label="Min Order Qty"
          name="minOrderQuantity"
          type="number"
          defaultValue={
            defaultValues?.minOrderQuantity != null
              ? String(defaultValues.minOrderQuantity)
              : ""
          }
          error={state.errors?.minOrderQuantity}
          placeholder="Optional"
        />
        <Input
          label="Sort Order"
          name="sortOrder"
          type="number"
          defaultValue={String(defaultValues?.sortOrder ?? 0)}
          error={state.errors?.sortOrder}
        />
      </div>

      <div className="form-field">
        <label className="prod-toggle-label">
          <input
            type="checkbox"
            name="active"
            defaultChecked={defaultValues?.active ?? true}
          />
          <span>Active</span>
        </label>
      </div>

      <div className="prod-form-actions">
        <SubmitButton label={submitLabel} />
        <Button variant="secondary" href={cancelHref}>Cancel</Button>
      </div>
    </form>
  );
}
