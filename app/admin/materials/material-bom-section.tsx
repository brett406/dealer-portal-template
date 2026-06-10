"use client";

import { useState, useTransition, useRef } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  addMaterialComponent,
  updateMaterialComponent,
  removeMaterialComponent,
  addMaterialLaborLine,
  updateMaterialLaborLine,
  removeMaterialLaborLine,
} from "./actions";
import "./materials.css";

type ComponentLine = {
  id: string;
  materialId: string;
  name: string;
  kind: "raw" | "subassembly";
  unit: string;
  archived: boolean;
  uncosted: boolean;
  unitCost: number | null;
  quantity: number;
  notes: string | null;
};

type LaborLine = {
  id: string;
  laborRateId: string;
  name: string;
  ratePerHour: number;
  archived: boolean;
  hours: number;
  notes: string | null;
};

type MaterialOption = { id: string; name: string; sku: string | null; kind: "raw" | "subassembly" };
type LaborRateOption = { id: string; name: string; ratePerHour: number };

export function MaterialBomSection({
  materialId,
  components,
  laborLines,
  materialOptions,
  laborRateOptions,
}: {
  materialId: string;
  components: ComponentLine[];
  laborLines: LaborLine[];
  materialOptions: MaterialOption[];
  laborRateOptions: LaborRateOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [showAddLabor, setShowAddLabor] = useState(false);
  const [editComponent, setEditComponent] = useState<ComponentLine | null>(null);
  const [editLabor, setEditLabor] = useState<LaborLine | null>(null);
  const [removeTarget, setRemoveTarget] = useState<
    | { type: "component"; line: ComponentLine }
    | { type: "labor"; line: LaborLine }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const componentFormRef = useRef<HTMLFormElement>(null);
  const laborFormRef = useRef<HTMLFormElement>(null);

  const archivedRefs = [
    ...components.filter((c) => c.archived).map((c) => `material ${c.name}`),
    ...laborLines.filter((l) => l.archived).map((l) => `labor rate ${l.name}`),
  ];
  const uncostedRefs = components.filter((c) => c.uncosted).map((c) => c.name);
  const emptyBom = components.length === 0 && laborLines.length === 0;

  function run(action: () => Promise<{ errors?: Record<string, string>; error?: string }>, onOk: () => void) {
    setError(null);
    setFormErrors({});
    startTransition(async () => {
      const result = await action();
      if (result.errors) setFormErrors(result.errors);
      else if (result.error) setError(result.error);
      else onOk();
    });
  }

  const componentColumns: TableColumn<ComponentLine>[] = [
    {
      key: "name",
      label: "Material",
      render: (row) => (
        <span>
          {row.name}
          <span className={`mat-badge mat-badge-${row.kind}`} style={{ marginLeft: "0.4rem" }}>
            {row.kind === "raw" ? "Raw" : "Sub-assembly"}
          </span>
          {row.archived && (
            <span className="mat-badge mat-badge-archived" style={{ marginLeft: "0.4rem" }}>
              Archived
            </span>
          )}
          {row.uncosted && (
            <span className="mat-badge mat-badge-warning" style={{ marginLeft: "0.4rem" }}>
              Uncosted
            </span>
          )}
        </span>
      ),
    },
    {
      key: "quantity",
      label: "Quantity",
      render: (row) => `${row.quantity} ${row.unit}`,
    },
    {
      key: "unitCost",
      label: "Unit Cost",
      render: (row) => (row.unitCost !== null ? `$${row.unitCost.toFixed(4)}` : "—"),
    },
    {
      key: "extended",
      label: "Extended",
      render: (row) =>
        row.unitCost !== null ? `$${(row.unitCost * row.quantity).toFixed(4)}` : "—",
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="mat-actions">
          <Button variant="secondary" size="sm" onClick={() => { setFormErrors({}); setEditComponent(row); }}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setRemoveTarget({ type: "component", line: row })}>
            Remove
          </Button>
        </div>
      ),
    },
  ];

  const laborColumns: TableColumn<LaborLine>[] = [
    {
      key: "name",
      label: "Labor Rate",
      render: (row) => (
        <span>
          {row.name}
          {row.archived && (
            <span className="mat-badge mat-badge-archived" style={{ marginLeft: "0.4rem" }}>
              Archived
            </span>
          )}
        </span>
      ),
    },
    { key: "hours", label: "Hours", render: (row) => row.hours.toFixed(2) },
    { key: "ratePerHour", label: "Rate", render: (row) => `$${row.ratePerHour.toFixed(2)}/hr` },
    {
      key: "extended",
      label: "Extended",
      render: (row) => `$${(row.hours * row.ratePerHour).toFixed(2)}`,
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="mat-actions">
          <Button variant="secondary" size="sm" onClick={() => { setFormErrors({}); setEditLabor(row); }}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setRemoveTarget({ type: "labor", line: row })}>
            Remove
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mat-edit-section">
      <h2>Bill of Materials</h2>

      {error && <div className="status-message status-error">{error}</div>}

      {emptyBom && (
        <div className="mat-warning">
          This sub-assembly has an empty BOM — it costs $0 until components or labor are added.
        </div>
      )}
      {archivedRefs.length > 0 && (
        <div className="mat-warning">
          Uses archived {archivedRefs.join(", ")} — archived items still cost normally, but
          consider replacing them.
        </div>
      )}
      {uncostedRefs.length > 0 && (
        <div className="mat-warning">
          {uncostedRefs.join(", ")} {uncostedRefs.length === 1 ? "has" : "have"} no unit cost and
          contribute{uncostedRefs.length === 1 ? "s" : ""} $0.
        </div>
      )}

      <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem 0" }}>Components</h3>
      <Table columns={componentColumns} data={components} emptyMessage="No components yet." />

      {!showAddComponent && (
        <Button size="sm" onClick={() => { setShowAddComponent(true); setFormErrors({}); }} style={{ marginTop: "0.5rem" }}>
          Add Component
        </Button>
      )}
      {showAddComponent && (
        <form
          ref={componentFormRef}
          action={(fd) =>
            run(
              () => addMaterialComponent(materialId, fd),
              () => { setShowAddComponent(false); componentFormRef.current?.reset(); },
            )
          }
          className="mat-inline-form"
        >
          <div className="form-field" style={{ minWidth: "220px" }}>
            <label>Material *</label>
            <select name="materialId" required defaultValue="" style={{ width: "100%" }}>
              <option value="" disabled>Choose a material...</option>
              {materialOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.sku ? ` (${m.sku})` : ""}{m.kind === "subassembly" ? " — sub-assembly" : ""}
                </option>
              ))}
            </select>
            {formErrors.materialId && <p className="form-error-message">{formErrors.materialId}</p>}
          </div>
          <div className="form-field">
            <label>Quantity *</label>
            <input name="quantity" type="number" step="0.0001" min="0" required placeholder="1" />
            {formErrors.quantity && <p className="form-error-message">{formErrors.quantity}</p>}
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: "140px" }}>
            <label>Notes</label>
            <input name="notes" placeholder="Optional" style={{ width: "100%" }} />
            {formErrors.notes && <p className="form-error-message">{formErrors.notes}</p>}
          </div>
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddComponent(false)}>Cancel</Button>
        </form>
      )}

      <h3 style={{ fontSize: "0.95rem", margin: "1.5rem 0 0.5rem 0" }}>Labor</h3>
      <Table columns={laborColumns} data={laborLines} emptyMessage="No labor lines yet." />

      {!showAddLabor && (
        <Button size="sm" onClick={() => { setShowAddLabor(true); setFormErrors({}); }} style={{ marginTop: "0.5rem" }}>
          Add Labor
        </Button>
      )}
      {showAddLabor && (
        <form
          ref={laborFormRef}
          action={(fd) =>
            run(
              () => addMaterialLaborLine(materialId, fd),
              () => { setShowAddLabor(false); laborFormRef.current?.reset(); },
            )
          }
          className="mat-inline-form"
        >
          <div className="form-field" style={{ minWidth: "220px" }}>
            <label>Labor Rate *</label>
            <select name="laborRateId" required defaultValue="" style={{ width: "100%" }}>
              <option value="" disabled>Choose a rate...</option>
              {laborRateOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (${r.ratePerHour.toFixed(2)}/hr)
                </option>
              ))}
            </select>
            {formErrors.laborRateId && <p className="form-error-message">{formErrors.laborRateId}</p>}
          </div>
          <div className="form-field">
            <label>Hours *</label>
            <input name="hours" type="number" step="0.01" min="0" required placeholder="0.25" />
            {formErrors.hours && <p className="form-error-message">{formErrors.hours}</p>}
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: "140px" }}>
            <label>Notes</label>
            <input name="notes" placeholder="Optional" style={{ width: "100%" }} />
            {formErrors.notes && <p className="form-error-message">{formErrors.notes}</p>}
          </div>
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddLabor(false)}>Cancel</Button>
        </form>
      )}

      {/* Edit component modal */}
      <Modal open={!!editComponent} onClose={() => setEditComponent(null)} title="Edit Component">
        {editComponent && (
          <form
            action={(fd) =>
              run(
                () => updateMaterialComponent(editComponent.id, fd),
                () => setEditComponent(null),
              )
            }
          >
            <p style={{ marginTop: 0 }}>
              <strong>{editComponent.name}</strong>
            </p>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Quantity ({editComponent.unit})</label>
              <input
                name="quantity"
                type="number"
                step="0.0001"
                min="0"
                className="form-input"
                required
                defaultValue={editComponent.quantity}
              />
              {formErrors.quantity && <p className="form-error-message">{formErrors.quantity}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Notes</label>
              <input name="notes" className="form-input" defaultValue={editComponent.notes ?? ""} />
            </div>
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setEditComponent(null)}>Cancel</Button>
              <Button type="submit" loading={isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Edit labor modal */}
      <Modal open={!!editLabor} onClose={() => setEditLabor(null)} title="Edit Labor Line">
        {editLabor && (
          <form
            action={(fd) =>
              run(
                () => updateMaterialLaborLine(editLabor.id, fd),
                () => setEditLabor(null),
              )
            }
          >
            <p style={{ marginTop: 0 }}>
              <strong>{editLabor.name}</strong> (${editLabor.ratePerHour.toFixed(2)}/hr)
            </p>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Hours</label>
              <input
                name="hours"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                required
                defaultValue={editLabor.hours.toFixed(2)}
              />
              {formErrors.hours && <p className="form-error-message">{formErrors.hours}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Notes</label>
              <input name="notes" className="form-input" defaultValue={editLabor.notes ?? ""} />
            </div>
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setEditLabor(null)}>Cancel</Button>
              <Button type="submit" loading={isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Remove confirmation */}
      <Modal open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove BOM Line">
        <p>
          Remove <strong>{removeTarget?.line.name}</strong> from this BOM? Every BOM-priced
          product using this sub-assembly will be repriced.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={isPending}
            onClick={() => {
              if (!removeTarget) return;
              const { type, line } = removeTarget;
              run(
                () =>
                  type === "component"
                    ? removeMaterialComponent(line.id)
                    : removeMaterialLaborLine(line.id),
                () => setRemoveTarget(null),
              );
            }}
          >
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}
