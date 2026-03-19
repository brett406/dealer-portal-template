"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { FormState } from "./actions";
import "./companies.css";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

type PriceLevel = { id: string; name: string };

interface CompanyInfoFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  priceLevels: PriceLevel[];
  defaultValues?: {
    name?: string;
    priceLevelId?: string;
    phone?: string;
    notes?: string;
    active?: boolean;
  };
  submitLabel: string;
  cancelHref: string;
}

export function CompanyInfoForm({
  action,
  priceLevels,
  defaultValues,
  submitLabel,
  cancelHref,
}: CompanyInfoFormProps) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="co-form">
      {state.success && (
        <div className="status-message status-success">Company saved successfully.</div>
      )}

      <Input
        label="Company Name"
        name="name"
        required
        defaultValue={defaultValues?.name}
        error={state.errors?.name}
        placeholder="e.g., Acme Hardware"
      />

      <div className="form-field">
        <label htmlFor="input-priceLevelId" className="form-label">
          Price Level <span className="form-required" aria-hidden="true">*</span>
        </label>
        <select
          id="input-priceLevelId"
          name="priceLevelId"
          className="form-input"
          required
          defaultValue={defaultValues?.priceLevelId ?? ""}
        >
          <option value="">Select a price level...</option>
          {priceLevels.map((pl) => (
            <option key={pl.id} value={pl.id}>{pl.name}</option>
          ))}
        </select>
        {state.errors?.priceLevelId && (
          <p className="form-error-message">{state.errors.priceLevelId}</p>
        )}
      </div>

      <Input
        label="Phone"
        name="phone"
        defaultValue={defaultValues?.phone}
        error={state.errors?.phone}
        placeholder="(555) 123-4567"
      />

      <Input
        label="Notes"
        name="notes"
        type="textarea"
        defaultValue={defaultValues?.notes}
        error={state.errors?.notes}
        placeholder="Internal notes about this company"
      />

      <div className="form-field">
        <label className="co-toggle-label">
          <input type="checkbox" name="active" defaultChecked={defaultValues?.active ?? true} />
          <span>Active</span>
        </label>
      </div>

      <div className="co-form-actions">
        <SubmitButton label={submitLabel} />
        <Button variant="secondary" href={cancelHref}>Cancel</Button>
      </div>
    </form>
  );
}
