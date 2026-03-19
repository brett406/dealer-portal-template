"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { PriceLevelFormState } from "./actions";
import "./price-levels.css";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

function PricePreview({ discount }: { discount: number }) {
  const price = (100 * (100 - discount)) / 100;
  return (
    <div className="pl-price-preview">
      A <strong>$100.00</strong> product at this level = <strong>${price.toFixed(2)}</strong>
    </div>
  );
}

interface PriceLevelFormProps {
  action: (state: PriceLevelFormState, formData: FormData) => Promise<PriceLevelFormState>;
  defaultValues?: {
    name?: string;
    discountPercent?: number;
    description?: string;
    sortOrder?: number;
  };
  submitLabel: string;
}

export function PriceLevelForm({ action, defaultValues, submitLabel }: PriceLevelFormProps) {
  const [state, formAction] = useActionState(action, {});
  const [discount, setDiscount] = useState(defaultValues?.discountPercent ?? 0);

  return (
    <form action={formAction} className="pl-form">
      <Input
        label="Name"
        name="name"
        required
        defaultValue={defaultValues?.name}
        error={state.errors?.name}
        placeholder="e.g., Wholesale"
      />

      <div className="form-field">
        <label htmlFor="input-discountPercent" className="form-label">
          Discount Percentage <span className="form-required" aria-hidden="true">*</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            id="input-discountPercent"
            name="discountPercent"
            type="number"
            className="form-input"
            required
            min={0}
            max={100}
            step="0.01"
            defaultValue={defaultValues?.discountPercent ?? 0}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val >= 0 && val <= 100) setDiscount(val);
            }}
            style={{ maxWidth: "120px" }}
          />
          <span style={{ color: "var(--color-text-muted)" }}>%</span>
        </div>
        {state.errors?.discountPercent && (
          <p className="form-error-message">{state.errors.discountPercent}</p>
        )}
      </div>

      <PricePreview discount={discount} />

      <Input
        label="Description"
        name="description"
        type="textarea"
        defaultValue={defaultValues?.description}
        error={state.errors?.description}
        placeholder="Optional description"
      />

      <Input
        label="Sort Order"
        name="sortOrder"
        type="number"
        defaultValue={String(defaultValues?.sortOrder ?? 0)}
        error={state.errors?.sortOrder}
      />

      <div className="pl-form-actions">
        <SubmitButton label={submitLabel} />
        <Button variant="secondary" href="/admin/price-levels">
          Cancel
        </Button>
      </div>
    </form>
  );
}
