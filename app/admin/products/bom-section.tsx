"use client";

/**
 * BOM costing section on the product edit page (docs/BOM-COSTING.md §7).
 * Rendered only when SiteSetting.bomCostingEnabled — the page omits it
 * entirely when the module is off (§6).
 *
 * Product level: priceFromBom default, markup overrides, the product BOM
 * (components + labor) and a live breakdown. Variant level: tri-state
 * priceFromBom, markup overrides, the variant's own override BOM with the
 * §16 inherit/override warnings, and a per-variant breakdown.
 */

import { useState, useTransition, useRef } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatPrice } from "@/lib/pricing";
import {
  addBomComponent,
  addBomLaborLine,
  deleteBomComponent,
  deleteBomLaborLine,
  updateBomComponent,
  updateBomLaborLine,
  updateProductBomPricing,
  updateVariantBomPricing,
  type FormState,
} from "./actions";
import type {
  BomBreakdownView,
  BomLaborView,
  BomLineView,
  BomSectionData,
  VariantBomView,
} from "./bom-data";
import "./products.css";

type BomParentRef = { productId: string } | { productVariantId: string };

/** §4.3 — implied gross margin of a markup-on-cost percentage. */
function impliedMarginPercent(markup: number): string {
  if (!Number.isFinite(markup) || markup <= 0) return "0.0";
  return ((markup / (100 + markup)) * 100).toFixed(1);
}

function MarkupHint({ value, inherited }: { value: string; inherited: number }) {
  const markup = value.trim() === "" ? inherited : Number(value);
  const usingInherited = value.trim() === "";
  return (
    <p className="bom-markup-hint">
      {usingInherited ? `Inherits ${inherited}%` : `${markup}% markup`} ≈{" "}
      {impliedMarginPercent(markup)}% gross margin
    </p>
  );
}

// ─── Live cost breakdown (§7) ────────────────────────────────────────────────

function BreakdownCard({
  breakdown,
  emptyMessage,
}: {
  breakdown: BomBreakdownView | null;
  emptyMessage: string;
}) {
  if (!breakdown) return null;

  if (breakdown.empty) {
    return (
      <div className="bom-breakdown">
        <span className="bom-badge bom-badge-warn">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="bom-breakdown">
      <div className="prod-price-grid">
        <div className="prod-price-card">
          <div className="label">Material cost (+{breakdown.materialMarkupPercent}%)</div>
          <div className="price">${breakdown.materialCost}</div>
          <div className="bom-markup-line">+ ${breakdown.materialMarkupAmount} markup</div>
        </div>
        <div className="prod-price-card">
          <div className="label">Labor cost (+{breakdown.laborMarkupPercent}%)</div>
          <div className="price">${breakdown.laborCost}</div>
          <div className="bom-markup-line">+ ${breakdown.laborMarkupAmount} markup</div>
        </div>
        <div className="prod-price-card">
          <div className="label">Total cost</div>
          <div className="price">${breakdown.totalCost}</div>
        </div>
        <div className="prod-price-card">
          <div className="label">Computed price</div>
          <div className="price">{breakdown.price !== null ? formatPrice(breakdown.price) : "—"}</div>
          {breakdown.impliedGrossMarginPercent !== null && (
            <div className="bom-markup-line">
              {breakdown.impliedGrossMarginPercent}% gross margin
            </div>
          )}
        </div>
      </div>
      {breakdown.warnings.length > 0 && (
        <ul className="bom-warning-list">
          {breakdown.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Shared BOM line editor (product parent or variant parent) ───────────────

function BomEditor({
  parent,
  components,
  labor,
  materialOptions,
  laborOptions,
  firstAddComponentWarning,
  lastDeleteComponentWarning,
  firstAddLaborWarning,
  lastDeleteLaborWarning,
}: {
  parent: BomParentRef;
  components: BomLineView[];
  labor: BomLaborView[];
  materialOptions: BomSectionData["materialOptions"];
  laborOptions: BomSectionData["laborOptions"];
  /** §16 — shown when this add would be the variant's FIRST own line. */
  firstAddComponentWarning?: string;
  /** §16 — shown when this delete removes the variant's LAST own line. */
  lastDeleteComponentWarning?: string;
  firstAddLaborWarning?: string;
  lastDeleteLaborWarning?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showComponentForm, setShowComponentForm] = useState(false);
  const [showLaborForm, setShowLaborForm] = useState(false);
  const [editComponent, setEditComponent] = useState<BomLineView | null>(null);
  const [editLabor, setEditLabor] = useState<BomLaborView | null>(null);
  const [deleteComponentTarget, setDeleteComponentTarget] = useState<BomLineView | null>(null);
  const [deleteLaborTarget, setDeleteLaborTarget] = useState<BomLaborView | null>(null);
  const [confirmAdd, setConfirmAdd] = useState<{ kind: "component" | "labor"; fd: FormData } | null>(null);
  const [isPending, startTransition] = useTransition();
  const componentFormRef = useRef<HTMLFormElement>(null);
  const laborFormRef = useRef<HTMLFormElement>(null);

  function run(action: () => Promise<FormState>, onSuccess?: () => void) {
    setError(null);
    setFormErrors({});
    startTransition(async () => {
      const result = await action();
      if (result.errors) {
        setFormErrors(result.errors);
      } else if (result.error) {
        setError(result.error);
      } else {
        onSuccess?.();
      }
    });
  }

  function submitAddComponent(fd: FormData) {
    // §16 — the FIRST own line flips the variant to a full component override.
    if (firstAddComponentWarning && components.length === 0) {
      setConfirmAdd({ kind: "component", fd });
      return;
    }
    run(
      () => addBomComponent(parent, fd),
      () => {
        setShowComponentForm(false);
        componentFormRef.current?.reset();
      },
    );
  }

  function submitAddLabor(fd: FormData) {
    if (firstAddLaborWarning && labor.length === 0) {
      setConfirmAdd({ kind: "labor", fd });
      return;
    }
    run(
      () => addBomLaborLine(parent, fd),
      () => {
        setShowLaborForm(false);
        laborFormRef.current?.reset();
      },
    );
  }

  function confirmAddNow() {
    if (!confirmAdd) return;
    const { kind, fd } = confirmAdd;
    run(
      () => (kind === "component" ? addBomComponent(parent, fd) : addBomLaborLine(parent, fd)),
      () => {
        if (kind === "component") {
          setShowComponentForm(false);
          componentFormRef.current?.reset();
        } else {
          setShowLaborForm(false);
          laborFormRef.current?.reset();
        }
      },
    );
    setConfirmAdd(null);
  }

  const componentColumns: TableColumn<BomLineView>[] = [
    {
      key: "name",
      label: "Material",
      render: (row) => (
        <span>
          {row.name}
          {row.sku && <span className="bom-line-sku"> {row.sku}</span>}
          {row.kind === "subassembly" && <span className="bom-badge">sub-assembly</span>}
          {row.archived && <span className="bom-badge bom-badge-warn">archived</span>}
          {row.uncosted && <span className="bom-badge bom-badge-warn">no cost</span>}
        </span>
      ),
    },
    { key: "quantity", label: "Qty", render: (row) => `${row.quantity} ${row.unit}` },
    {
      key: "unitCost",
      label: "Unit Cost",
      render: (row) => (row.unitCost !== null ? `$${row.unitCost.toFixed(4)}` : "—"),
    },
    {
      key: "lineTotal",
      label: "Line Total",
      render: (row) =>
        row.unitCost !== null ? `$${(row.unitCost * row.quantity).toFixed(4)}` : "—",
    },
    { key: "notes", label: "Notes", render: (row) => row.notes ?? "—" },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="prod-actions">
          <Button variant="secondary" size="sm" onClick={() => { setFormErrors({}); setEditComponent(row); }}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => { setError(null); setDeleteComponentTarget(row); }}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const laborColumns: TableColumn<BomLaborView>[] = [
    {
      key: "name",
      label: "Labor",
      render: (row) => (
        <span>
          {row.name}
          {row.archived && <span className="bom-badge bom-badge-warn">archived</span>}
        </span>
      ),
    },
    { key: "hours", label: "Hours", render: (row) => `${row.hours} h` },
    { key: "ratePerHour", label: "Rate", render: (row) => `$${row.ratePerHour.toFixed(2)}/h` },
    {
      key: "lineTotal",
      label: "Line Total",
      render: (row) => `$${(row.hours * row.ratePerHour).toFixed(4)}`,
    },
    { key: "notes", label: "Notes", render: (row) => row.notes ?? "—" },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="prod-actions">
          <Button variant="secondary" size="sm" onClick={() => { setFormErrors({}); setEditLabor(row); }}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => { setError(null); setDeleteLaborTarget(row); }}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="bom-editor">
      {error && <div className="status-message status-error">{error}</div>}

      <h4 className="bom-subhead">Components</h4>
      <p className="bom-subnote">Materials consumed per one finished unit.</p>
      <Table columns={componentColumns} data={components} emptyMessage="No component lines." />

      {!showComponentForm && (
        <Button size="sm" onClick={() => { setShowComponentForm(true); setFormErrors({}); }} style={{ marginTop: "0.5rem" }}>
          Add Component
        </Button>
      )}
      {showComponentForm && (
        <form ref={componentFormRef} action={submitAddComponent} className="prod-inline-form">
          <div className="form-field">
            <label>Material *</label>
            <select name="materialId" required defaultValue="">
              <option value="" disabled>Select material…</option>
              {materialOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.kind === "subassembly" ? " (sub-assembly)" : ""}
                  {m.cost !== null ? ` — $${m.cost.toFixed(4)}/${m.unit}` : ""}
                </option>
              ))}
            </select>
            {formErrors.materialId && <p className="form-error-message">{formErrors.materialId}</p>}
          </div>
          <div className="form-field">
            <label>Quantity *</label>
            <input name="quantity" type="number" step="0.0001" min="0.0001" required placeholder="1" />
            {formErrors.quantity && <p className="form-error-message">{formErrors.quantity}</p>}
          </div>
          <div className="form-field">
            <label>Notes</label>
            <input name="notes" maxLength={500} placeholder="Optional" />
            {formErrors.notes && <p className="form-error-message">{formErrors.notes}</p>}
          </div>
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowComponentForm(false)}>Cancel</Button>
        </form>
      )}
      {showComponentForm && firstAddComponentWarning && components.length === 0 && (
        <p className="bom-inherit-note">{firstAddComponentWarning}</p>
      )}

      <h4 className="bom-subhead">Labor</h4>
      <p className="bom-subnote">Hours of each labor rate per one finished unit.</p>
      <Table columns={laborColumns} data={labor} emptyMessage="No labor lines." />

      {!showLaborForm && (
        <Button size="sm" onClick={() => { setShowLaborForm(true); setFormErrors({}); }} style={{ marginTop: "0.5rem" }}>
          Add Labor
        </Button>
      )}
      {showLaborForm && (
        <form ref={laborFormRef} action={submitAddLabor} className="prod-inline-form">
          <div className="form-field">
            <label>Labor Rate *</label>
            <select name="laborRateId" required defaultValue="">
              <option value="" disabled>Select labor rate…</option>
              {laborOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — ${r.ratePerHour.toFixed(2)}/h
                </option>
              ))}
            </select>
            {formErrors.laborRateId && <p className="form-error-message">{formErrors.laborRateId}</p>}
          </div>
          <div className="form-field">
            <label>Hours *</label>
            <input name="hours" type="number" step="0.01" min="0.01" required placeholder="0.5" />
            {formErrors.hours && <p className="form-error-message">{formErrors.hours}</p>}
          </div>
          <div className="form-field">
            <label>Notes</label>
            <input name="notes" maxLength={500} placeholder="Optional" />
            {formErrors.notes && <p className="form-error-message">{formErrors.notes}</p>}
          </div>
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowLaborForm(false)}>Cancel</Button>
        </form>
      )}
      {showLaborForm && firstAddLaborWarning && labor.length === 0 && (
        <p className="bom-inherit-note">{firstAddLaborWarning}</p>
      )}

      {/* §16 — confirm flipping the variant to its own override BOM */}
      <Modal open={!!confirmAdd} onClose={() => setConfirmAdd(null)} title="Override product BOM?">
        <p>
          {confirmAdd?.kind === "component" ? firstAddComponentWarning : firstAddLaborWarning}
        </p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setConfirmAdd(null)}>Cancel</Button>
          <Button loading={isPending} onClick={confirmAddNow}>Add Line</Button>
        </div>
      </Modal>

      {/* Edit component modal */}
      <Modal open={!!editComponent} onClose={() => setEditComponent(null)} title="Edit BOM Component">
        {editComponent && (
          <form
            action={(fd) =>
              run(
                () => updateBomComponent(editComponent.id, fd),
                () => setEditComponent(null),
              )
            }
          >
            <p style={{ marginBottom: "0.75rem" }}>
              <strong>{editComponent.name}</strong>
              {editComponent.sku && <span className="bom-line-sku"> {editComponent.sku}</span>}
            </p>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Quantity ({editComponent.unit})</label>
              <input
                name="quantity"
                type="number"
                step="0.0001"
                min="0.0001"
                className="form-input"
                required
                defaultValue={editComponent.quantity}
              />
              {formErrors.quantity && <p className="form-error-message">{formErrors.quantity}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Notes</label>
              <input name="notes" className="form-input" maxLength={500} defaultValue={editComponent.notes ?? ""} />
              {formErrors.notes && <p className="form-error-message">{formErrors.notes}</p>}
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setEditComponent(null)}>Cancel</Button>
              <Button type="submit" loading={isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Edit labor modal */}
      <Modal open={!!editLabor} onClose={() => setEditLabor(null)} title="Edit BOM Labor">
        {editLabor && (
          <form
            action={(fd) =>
              run(
                () => updateBomLaborLine(editLabor.id, fd),
                () => setEditLabor(null),
              )
            }
          >
            <p style={{ marginBottom: "0.75rem" }}>
              <strong>{editLabor.name}</strong> — ${editLabor.ratePerHour.toFixed(2)}/h
            </p>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Hours</label>
              <input
                name="hours"
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                required
                defaultValue={editLabor.hours}
              />
              {formErrors.hours && <p className="form-error-message">{formErrors.hours}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Notes</label>
              <input name="notes" className="form-input" maxLength={500} defaultValue={editLabor.notes ?? ""} />
              {formErrors.notes && <p className="form-error-message">{formErrors.notes}</p>}
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setEditLabor(null)}>Cancel</Button>
              <Button type="submit" loading={isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete component confirmation (§16 revert warning on the last own line) */}
      <Modal
        open={!!deleteComponentTarget}
        onClose={() => setDeleteComponentTarget(null)}
        title="Delete BOM Component"
      >
        <p>
          Remove <strong>{deleteComponentTarget?.name}</strong> from this BOM?
        </p>
        {lastDeleteComponentWarning && components.length === 1 && (
          <p className="bom-inherit-note">{lastDeleteComponentWarning}</p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteComponentTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={isPending}
            onClick={() =>
              deleteComponentTarget &&
              run(
                () => deleteBomComponent(deleteComponentTarget.id),
                () => setDeleteComponentTarget(null),
              )
            }
          >
            Delete
          </Button>
        </div>
      </Modal>

      {/* Delete labor confirmation (§16 revert warning on the last own line) */}
      <Modal
        open={!!deleteLaborTarget}
        onClose={() => setDeleteLaborTarget(null)}
        title="Delete BOM Labor"
      >
        <p>
          Remove <strong>{deleteLaborTarget?.name}</strong> from this BOM?
        </p>
        {lastDeleteLaborWarning && labor.length === 1 && (
          <p className="bom-inherit-note">{lastDeleteLaborWarning}</p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteLaborTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={isPending}
            onClick={() =>
              deleteLaborTarget &&
              run(
                () => deleteBomLaborLine(deleteLaborTarget.id),
                () => setDeleteLaborTarget(null),
              )
            }
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Product-level pricing controls ──────────────────────────────────────────

function ProductBomPricingForm({
  productId,
  product,
  defaults,
}: {
  productId: string;
  product: BomSectionData["product"];
  defaults: BomSectionData["defaults"];
}) {
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [materialMarkup, setMaterialMarkup] = useState(
    product.materialMarkup !== null ? String(product.materialMarkup) : "",
  );
  const [laborMarkup, setLaborMarkup] = useState(
    product.laborMarkup !== null ? String(product.laborMarkup) : "",
  );

  function handleSubmit(fd: FormData) {
    setError(null);
    setFormErrors({});
    setSaved(false);
    startTransition(async () => {
      const result = await updateProductBomPricing(productId, fd);
      if (result.errors) setFormErrors(result.errors);
      else if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form action={handleSubmit} className="prod-inline-form bom-pricing-form">
      {error && <div className="status-message status-error">{error}</div>}
      {saved && <div className="status-message status-success">Pricing settings saved.</div>}
      <div className="form-field">
        <label className="prod-toggle-label">
          <input type="checkbox" name="priceFromBom" defaultChecked={product.priceFromBom} />
          <span>Price from BOM (default for variants)</span>
        </label>
        <p className="bom-subnote">
          While on, variant retail prices are computed from the BOM and
          can&apos;t be edited by hand. Individual variants can opt out below.
        </p>
      </div>
      <div className="form-field">
        <label>Material markup %</label>
        <input
          name="materialMarginPercent"
          type="number"
          step="0.01"
          min="0"
          max="999.99"
          placeholder={String(defaults.materialMarkup)}
          value={materialMarkup}
          onChange={(e) => setMaterialMarkup(e.target.value)}
        />
        <MarkupHint value={materialMarkup} inherited={defaults.materialMarkup} />
        {formErrors.materialMarginPercent && (
          <p className="form-error-message">{formErrors.materialMarginPercent}</p>
        )}
      </div>
      <div className="form-field">
        <label>Labor markup %</label>
        <input
          name="laborMarginPercent"
          type="number"
          step="0.01"
          min="0"
          max="999.99"
          placeholder={String(defaults.laborMarkup)}
          value={laborMarkup}
          onChange={(e) => setLaborMarkup(e.target.value)}
        />
        <MarkupHint value={laborMarkup} inherited={defaults.laborMarkup} />
        {formErrors.laborMarginPercent && (
          <p className="form-error-message">{formErrors.laborMarginPercent}</p>
        )}
      </div>
      <Button type="submit" size="sm" loading={isPending}>Save Pricing</Button>
    </form>
  );
}

// ─── Variant panel ───────────────────────────────────────────────────────────

function VariantBomPanel({
  variant,
  productPriceFromBom,
  materialOptions,
  laborOptions,
}: {
  variant: VariantBomView;
  productPriceFromBom: boolean;
  materialOptions: BomSectionData["materialOptions"];
  laborOptions: BomSectionData["laborOptions"];
}) {
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [materialMarkup, setMaterialMarkup] = useState(
    variant.materialMarkup !== null ? String(variant.materialMarkup) : "",
  );
  const [laborMarkup, setLaborMarkup] = useState(
    variant.laborMarkup !== null ? String(variant.laborMarkup) : "",
  );

  function handlePricingSubmit(fd: FormData) {
    setError(null);
    setFormErrors({});
    setSaved(false);
    startTransition(async () => {
      const result = await updateVariantBomPricing(variant.id, fd);
      if (result.errors) setFormErrors(result.errors);
      else if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  const triState =
    variant.priceFromBom === null ? "inherit" : variant.priceFromBom ? "on" : "off";

  const emptyBom = variant.breakdown?.empty ?? false;

  return (
    <div className="bom-variant-panel">
      <h3 className="bom-variant-title">
        {variant.name} <span className="bom-line-sku">{variant.sku}</span>
        {variant.effectivePriceFromBom && <span className="bom-badge">priced from BOM</span>}
        {variant.effectivePriceFromBom && emptyBom && (
          <span className="bom-badge bom-badge-warn">no BOM — price not auto-computed</span>
        )}
      </h3>

      {error && <div className="status-message status-error">{error}</div>}
      {saved && <div className="status-message status-success">Variant pricing saved.</div>}

      <form action={handlePricingSubmit} className="prod-inline-form bom-pricing-form">
        <div className="form-field">
          <label>Price from BOM</label>
          <select name="priceFromBom" defaultValue={triState}>
            <option value="inherit">
              Inherit from product ({productPriceFromBom ? "on" : "off"})
            </option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </div>
        <div className="form-field">
          <label>Material markup %</label>
          <input
            name="materialMarginPercent"
            type="number"
            step="0.01"
            min="0"
            max="999.99"
            placeholder={String(variant.inheritedMaterialMarkup)}
            value={materialMarkup}
            onChange={(e) => setMaterialMarkup(e.target.value)}
          />
          <MarkupHint value={materialMarkup} inherited={variant.inheritedMaterialMarkup} />
          {formErrors.materialMarginPercent && (
            <p className="form-error-message">{formErrors.materialMarginPercent}</p>
          )}
        </div>
        <div className="form-field">
          <label>Labor markup %</label>
          <input
            name="laborMarginPercent"
            type="number"
            step="0.01"
            min="0"
            max="999.99"
            placeholder={String(variant.inheritedLaborMarkup)}
            value={laborMarkup}
            onChange={(e) => setLaborMarkup(e.target.value)}
          />
          <MarkupHint value={laborMarkup} inherited={variant.inheritedLaborMarkup} />
          {formErrors.laborMarginPercent && (
            <p className="form-error-message">{formErrors.laborMarginPercent}</p>
          )}
        </div>
        <Button type="submit" size="sm" loading={isPending}>Save</Button>
      </form>

      <p className="bom-inherit-note">
        Components: {variant.inheritsComponents ? "inherited from product" : "variant override"} ·{" "}
        Labor: {variant.inheritsLabor ? "inherited from product" : "variant override"} (a variant
        either has its own lines or inherits the product&apos;s — no partial merge)
      </p>

      <BomEditor
        parent={{ productVariantId: variant.id }}
        components={variant.ownComponents}
        labor={variant.ownLabor}
        materialOptions={materialOptions}
        laborOptions={laborOptions}
        firstAddComponentWarning="Adding this variant's first own component line means it will stop inheriting the product's components entirely."
        lastDeleteComponentWarning="This is the variant's last own component line — deleting it will revert the variant to the product BOM."
        firstAddLaborWarning="Adding this variant's first own labor line means it will stop inheriting the product's labor entirely."
        lastDeleteLaborWarning="This is the variant's last own labor line — deleting it will revert the variant to the product's labor."
      />

      <BreakdownCard
        breakdown={variant.breakdown}
        emptyMessage="no BOM — price not auto-computed"
      />
    </div>
  );
}

// ─── Section root ────────────────────────────────────────────────────────────

export function BomSection({
  productId,
  data,
}: {
  productId: string;
  data: BomSectionData;
}) {
  return (
    <div className="prod-edit-section">
      <h2>BOM (Bill of Materials) Costing</h2>
      <p className="bom-intro">
        Price this product from what it costs to build. List the materials and
        labor that go into <strong>one unit</strong>, add a markup, and the
        retail price is computed automatically — and kept up to date whenever a
        material cost, labor rate, or BOM line changes.
      </p>

      <details className="bom-help">
        <summary>How the computed price works</summary>
        <ol>
          <li>
            <strong>Components</strong> — the materials used to build one unit.
            A sub-assembly is a material with its own BOM (managed on the
            Materials page); it rolls in at its build cost.
          </li>
          <li>
            <strong>Labor</strong> — the hours of each shop rate needed to build
            one unit.
          </li>
          <li>
            <strong>Markup</strong> — applied once, here:&nbsp;
            <em>material cost × (1 + material markup %) + labor cost × (1 +
            labor markup %) = computed price</em>. Markup is on cost; the
            equivalent gross margin is shown beside each field.
          </li>
        </ol>
        <p>
          Repricing happens automatically when anything cost-related changes,
          across every product that uses the affected material or rate. Past
          orders are never repriced. A variant whose BOM is empty keeps its
          manual price until lines are added.
        </p>
      </details>

      {data.computeError && (
        <div className="status-message status-error">
          BOM cost computation failed: {data.computeError}
        </div>
      )}

      <ProductBomPricingForm productId={productId} product={data.product} defaults={data.defaults} />

      <h3 className="bom-subhead-lg">Product BOM (default for all variants)</h3>
      <p className="bom-subnote">
        The build recipe for one unit. Every variant prices from this recipe
        unless it has its own lines in the overrides below.
      </p>
      <BomEditor
        parent={{ productId }}
        components={data.product.components}
        labor={data.product.labor}
        materialOptions={data.materialOptions}
        laborOptions={data.laborOptions}
      />
      <BreakdownCard
        breakdown={data.product.breakdown}
        emptyMessage="no BOM — price not auto-computed"
      />

      <h3 className="bom-subhead-lg">Variant BOM Overrides</h3>
      <p className="bom-subnote">
        Only needed when a variant is built differently from the product recipe.
        Adding a variant&apos;s first component line replaces the inherited
        components entirely (labor is overridden separately); deleting its last
        line goes back to inheriting.
      </p>
      {data.variants.length === 0 && <p className="bom-inherit-note">No variants yet.</p>}
      {data.variants.map((v) => (
        <VariantBomPanel
          key={v.id}
          variant={v}
          productPriceFromBom={data.product.priceFromBom}
          materialOptions={data.materialOptions}
          laborOptions={data.laborOptions}
        />
      ))}
    </div>
  );
}
