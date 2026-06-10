"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { updateMaterial } from "./actions";
import "./materials.css";

type Category = { id: string; name: string };

export function MaterialBasicForm({
  materialId,
  categories,
  hasOwnBomLines,
  defaultValues,
  computedCost,
}: {
  materialId: string;
  categories: Category[];
  hasOwnBomLines: boolean;
  defaultValues: {
    name: string;
    sku: string | null;
    unit: string;
    kind: "raw" | "subassembly";
    unitCost: number | null;
    categoryId: string | null;
  };
  computedCost: number | null;
}) {
  const [kind, setKind] = useState<"raw" | "subassembly">(defaultValues.kind);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(fd: FormData) {
    setError(null);
    setFormErrors({});
    setSaved(false);
    startTransition(async () => {
      const result = await updateMaterial(materialId, fd);
      if (result.errors) setFormErrors(result.errors);
      else if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form action={handleSubmit} className="mat-form">
      {error && <div className="status-message status-error">{error}</div>}
      {saved && <div className="status-message status-success">Material saved.</div>}

      <div className="form-field" style={{ marginBottom: "0.75rem" }}>
        <label className="form-label">Name *</label>
        <input name="name" className="form-input" required defaultValue={defaultValues.name} />
        {formErrors.name && <p className="form-error-message">{formErrors.name}</p>}
      </div>

      <div className="mat-form-row">
        <div className="form-field" style={{ marginBottom: "0.75rem" }}>
          <label className="form-label">SKU</label>
          <input name="sku" className="form-input" defaultValue={defaultValues.sku ?? ""} placeholder="Optional" />
          {formErrors.sku && <p className="form-error-message">{formErrors.sku}</p>}
        </div>
        <div className="form-field" style={{ marginBottom: "0.75rem" }}>
          <label className="form-label">Unit</label>
          <input name="unit" className="form-input" required defaultValue={defaultValues.unit} />
          {formErrors.unit && <p className="form-error-message">{formErrors.unit}</p>}
        </div>
      </div>

      <div className="mat-form-row">
        <div className="form-field" style={{ marginBottom: "0.75rem" }}>
          <label className="form-label">Kind</label>
          <select
            name="kind"
            className="form-input"
            value={kind}
            onChange={(e) => setKind(e.target.value as "raw" | "subassembly")}
          >
            <option value="raw">Raw material (entered cost)</option>
            <option value="subassembly">Sub-assembly (computed from its own BOM)</option>
          </select>
          {formErrors.kind && <p className="form-error-message">{formErrors.kind}</p>}
          {defaultValues.kind === "subassembly" && kind === "raw" && hasOwnBomLines && (
            <p className="form-error-message">
              This sub-assembly has its own BOM — remove its components first.
            </p>
          )}
        </div>
        <div className="form-field" style={{ marginBottom: "0.75rem" }}>
          <label className="form-label">Category</label>
          <select name="categoryId" className="form-input" defaultValue={defaultValues.categoryId ?? ""}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-field" style={{ marginBottom: "0.75rem" }}>
        <label className="form-label">Unit Cost</label>
        <input
          name="unitCost"
          type="number"
          step="0.0001"
          min="0"
          className="form-input"
          defaultValue={defaultValues.unitCost !== null ? defaultValues.unitCost.toFixed(4) : ""}
          placeholder={kind === "raw" ? "Leave blank if not costed yet" : "Ignored for sub-assemblies"}
        />
        {formErrors.unitCost && <p className="form-error-message">{formErrors.unitCost}</p>}
        {kind === "raw" ? (
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
            Changing the cost reprices every BOM-priced product that uses this material.
            {defaultValues.unitCost === null &&
              " An uncosted material contributes $0 until a cost is entered."}
          </p>
        ) : (
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
            Sub-assembly cost is computed from its own BOM:{" "}
            <strong>
              {computedCost !== null ? `$${computedCost.toFixed(4)}` : "not computed yet"}
            </strong>{" "}
            (at cost, no markup).
          </p>
        )}
      </div>

      <div className="mat-form-actions">
        <Button type="submit" loading={isPending}>Save Changes</Button>
      </div>
    </form>
  );
}
