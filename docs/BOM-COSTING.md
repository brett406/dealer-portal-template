# BOM Costing & Pricing — Design

> Status: **DESIGN / proposed** — not yet implemented. This document is the agreed
> design for a bill-of-materials (BOM) driven costing & pricing module for the
> dealer portal. Build proceeds in the phases at the end.

## 1. Goal

Let a manufacturer-type portal define products as a **bill of materials** — raw
materials (with editable unit costs) and nested **sub-assemblies**, plus **labor**
— and **derive the sellable product price from the rolled-up cost**. When a raw
material's cost changes, every product that uses it (directly or through a
sub-assembly) reprices automatically.

This is a **costing/pricing** feature, not production tracking. It is modeled on
the BOM/costing half of the `mfglite` project (`Item(role) + BomLine + LaborRate
+ BomLabor`), adapted to this template's `Product`/`ProductVariant` catalog and
grounded in ERP/MRP industry practice (see §11 Research basis).

### Locked decisions
| Decision | Choice |
|---|---|
| Costing method | Editable **standard** unit cost per material |
| Cost structure | **Material + Labor** (margin absorbs overhead) |
| Margin application | **Once at the finished product**, per-cost-element (material % vs labor %); **sub-assemblies roll up at COST — no compounding markup** |
| BOM level | **Product BOM with per-variant overrides** |
| Nesting | **Sub-assemblies allowed** (recursive cost rollup), with cycle detection |
| Placement | **Template core**, globally toggleable + per-product/variant toggle, **dormant by default** |

### Non-goals (explicitly out of scope for v1)
- Production tracking / Kanban / vendor portal / purchasing runs (the rest of mfglite).
- Inventory ledger, FIFO/LIFO, weighted-average from purchase receipts (we use an editable standard cost; weighted-average is a future option — §10).
- Manufacturing overhead as a separate per-hour burden (folded into margin for v1 — §10).
- Unit-of-measure **conversion** (a material's `unit` is a display label; BOM quantities are expressed in that unit — §6.4).
- Variance reporting (we store standard cost only; estimated-vs-actual variance is future — §10).

---

## 2. How it fits the existing system (safety)

The module **writes the computed price into `ProductVariant.baseRetailPrice`**.
Everything downstream is therefore unchanged:

- **Catalog / cart / orders** read `baseRetailPrice` exactly as today.
- **Dealer `PriceLevel` discounts** still layer on top of `baseRetailPrice` — BOM
  only *sets the base*, it does not touch discounting.
- **Past orders never change** — `OrderItem` already snapshots
  `baseRetailPriceSnapshot` + `unitPrice` at order time. A later material-cost
  change reprices the catalog, never history. (This is the research's
  "never silently reprice past orders" guardrail, already satisfied by the
  existing snapshot design.)
- **Cache** — a reprice calls `invalidateProductCaches()` (from
  `lib/cache-invalidation.ts`) so search/pricing reflect the new price.
- **Dormant by default** — with `bomCostingEnabled = false` and `priceFromBom`
  unset, every existing fork (bcp/nm/bhf/feversham) behaves byte-for-byte as it
  does today: manual pricing.

---

## 3. Data model

New models live alongside the catalog; no existing model is restructured. Only
**additive** columns are added to `Product`, `ProductVariant`, and `SiteSetting`.

```prisma
enum MaterialKind {
  raw          // leaf — unitCost is entered by the shop (editable standard cost)
  subassembly  // node — cost is COMPUTED from its own BOM + labor (rolls up at cost)
}

model Material {
  id          String       @id @default(cuid())
  name        String
  sku         String?      @unique
  unit        String       @default("each") // display label: each, ft, lb, sheet, hr...
  kind        MaterialKind @default(raw)

  // Leaf cost (raw): editable standard unit cost. Null/ignored for subassembly.
  unitCost    Decimal?     @db.Decimal(12, 4)

  // Denormalized rolled cost (subassembly): materials + labor of THIS material's
  // own BOM, at cost (no margin). Recomputed by the cost engine. For a raw
  // material this mirrors unitCost so the rollup can read one field uniformly.
  computedCost Decimal?    @db.Decimal(12, 4)

  categoryId  String?
  category    ProductCategory? @relation(fields: [categoryId], references: [id])

  archivedAt  DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  // BOM edges where this material is the CHILD (consumed somewhere).
  usedIn      BomComponent[] @relation("ComponentMaterial")
  // BOM edges where this material is the PARENT (subassembly's own components).
  components  BomComponent[] @relation("ParentMaterial")
  laborLines  BomLaborLine[] @relation("ParentMaterialLabor")

  @@index([kind, archivedAt])
  @@index([categoryId])
}

// One BOM line: a parent consumes `quantity` of a child Material.
// Parent is exactly ONE of product / variant / material (sub-assembly).
// Enforced by a CHECK constraint (see migration note §3.1).
model BomComponent {
  id         String  @id @default(cuid())

  productId        String?
  product          Product?        @relation(fields: [productId], references: [id], onDelete: Cascade)
  productVariantId String?
  productVariant   ProductVariant? @relation(fields: [productVariantId], references: [id], onDelete: Cascade)
  parentMaterialId String?
  parentMaterial   Material?       @relation("ParentMaterial", fields: [parentMaterialId], references: [id], onDelete: Cascade)

  materialId String
  material   Material @relation("ComponentMaterial", fields: [materialId], references: [id], onDelete: Restrict)

  quantity   Decimal  @db.Decimal(12, 4) // per ONE unit of the parent
  notes      String?

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([productId])
  @@index([productVariantId])
  @@index([parentMaterialId])
  @@index([materialId])
}

model LaborRate {
  id          String    @id @default(cuid())
  name        String    @unique // "Welder", "Assembly", "Painter"
  ratePerHour Decimal   @db.Decimal(10, 2)
  archivedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  laborLines  BomLaborLine[]
}

// Labor consumed by a parent (same polymorphic parent as BomComponent).
model BomLaborLine {
  id         String  @id @default(cuid())

  productId        String?
  product          Product?        @relation(fields: [productId], references: [id], onDelete: Cascade)
  productVariantId String?
  productVariant   ProductVariant? @relation(fields: [productVariantId], references: [id], onDelete: Cascade)
  parentMaterialId String?
  parentMaterial   Material?       @relation("ParentMaterialLabor", fields: [parentMaterialId], references: [id], onDelete: Cascade)

  laborRateId String
  laborRate   LaborRate @relation(fields: [laborRateId], references: [id], onDelete: Restrict)
  hours       Decimal   @db.Decimal(10, 2) // per ONE unit of the parent
  notes       String?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([productId])
  @@index([productVariantId])
  @@index([parentMaterialId])
  @@index([laborRateId])
}
```

### Additive columns on existing models
```prisma
// Product — default BOM target + default margins for its variants.
model Product {
  // ...existing...
  priceFromBom         Boolean  @default(false)
  materialMarginPercent Decimal? @db.Decimal(5, 2)
  laborMarginPercent    Decimal? @db.Decimal(5, 2)
  bomComponents        BomComponent[]
  bomLaborLines        BomLaborLine[]
}

// ProductVariant — per-variant override of BOM, toggle, and margins.
model ProductVariant {
  // ...existing... (baseRetailPrice is the WRITE TARGET)
  priceFromBom         Boolean? // null => inherit Product.priceFromBom
  materialMarginPercent Decimal? @db.Decimal(5, 2)
  laborMarginPercent    Decimal? @db.Decimal(5, 2)
  computedCost         Decimal? @db.Decimal(12, 4) // last rolled cost (display/audit)
  bomComponents        BomComponent[]
  bomLaborLines        BomLaborLine[]
}

// SiteSetting — global toggle + default margins.
model SiteSetting {
  // ...existing...
  bomCostingEnabled            Boolean @default(false)
  defaultMaterialMarginPercent Decimal @default(0) @db.Decimal(5, 2)
  defaultLaborMarginPercent    Decimal @default(0) @db.Decimal(5, 2)
}
```

### 3.1 Polymorphic-parent integrity
`BomComponent` and `BomLaborLine` use three nullable parent FKs. The migration
adds a Postgres `CHECK` constraint requiring **exactly one** to be non-null:
```sql
ALTER TABLE "BomComponent" ADD CONSTRAINT bom_component_one_parent
  CHECK (num_nonnulls("productId","productVariantId","parentMaterialId") = 1);
```
(Same for `BomLaborLine`.) Prisma can't express this, so it ships in the
migration SQL and is covered by a test.

---

## 4. Cost engine (`lib/bom/`)

Pure, deterministic, heavily unit-tested. No Prisma calls inside the math — it
takes plain inputs and returns numbers, so it can be tested without a DB.

### 4.1 Effective BOM resolution (product + variant override)
For a variant:
- **Components** = the variant's own `BomComponent` rows **if any exist**, else
  the parent `Product`'s rows. (Override is all-or-nothing per variant — a
  variant either has its own BOM or inherits the product's. This avoids
  ambiguous partial merges; documented in the UI.)
- **Labor** = same rule, independently.
- **Margins** resolve field-by-field: `variant.x ?? product.x ?? siteSetting.defaultX`.
- **priceFromBom** = `variant.priceFromBom ?? product.priceFromBom` (then global
  `bomCostingEnabled` must also be true for any repricing to happen).

### 4.2 Cost of a material (recursive, bottom-up)
```
cost(material):
  if material.kind == raw:          return material.unitCost ?? 0
  if material.kind == subassembly:  return Σ(line.quantity × cost(line.material))   // its own components
                                         + Σ(labor.hours × labor.rate.ratePerHour)  // its own labor
                                    // NO margin — sub-assemblies roll up at cost
```
Computed bottom-up via **low-level codes / topological order** so every child is
costed before any parent that consumes it (the industry-standard rollup order —
Oracle PeopleSoft, DBA). The denormalized `Material.computedCost` is the stored
result for sub-assemblies (and mirrors `unitCost` for raw, so callers read one
field).

### 4.3 Cost & price of a variant
```
materialCost = Σ(line.quantity × cost(line.material))   // includes rolled sub-assembly cost
laborCost    = Σ(labor.hours × labor.rate.ratePerHour)

price = materialCost × (1 + materialMarginPercent/100)
      + laborCost    × (1 + laborMarginPercent/100)
```
- **Per-cost-element margin applied once at the top** (D365 pattern: distinct
  profit % per cost group). Material and labor can carry different markups.
- **A consumed sub-assembly's rolled cost counts as MATERIAL cost** at the parent
  (it's a part the parent consumes — mirrors how Odoo/MRPeasy treat a
  sub-assembly as a stocked component). So material margin applies to it; the
  labor *inside* the sub-assembly is not separately re-margined at the parent.
- **Margin vs markup:** these percentages are **markups on cost** (cost-plus), not
  gross-margin-of-price. `price = cost × (1 + markup)`. The UI labels them
  "markup %" to avoid the classic margin/markup confusion, and shows the implied
  gross margin alongside.

### 4.4 Precision & rounding
- All intermediate math in high precision (Prisma `Decimal` / decimal.js); costs
  stored at `Decimal(12,4)`.
- **Round only at the end**, when writing `baseRetailPrice` (`Decimal(10,2)`),
  half-up. Never round at intermediate levels (research: round at presentation,
  not per level).

### 4.5 Cycle detection
- **At BOM save:** before persisting a `BomComponent` whose child is a
  sub-assembly, DFS the would-be graph; reject if it introduces a cycle
  (`A → B → A`). Error surfaced to the admin.
- **At compute:** a visited-set + max-depth guard so a bad row (e.g. created by a
  raw SQL import) can never infinite-loop the engine — it throws a clear error
  instead.

---

## 5. Repricing & propagation

A reprice is an **explicit, idempotent recompute** (research: roll-up → revalue,
never a silent edit), triggered by any cost-affecting change:
- a raw `Material.unitCost` edit,
- a `BomComponent` / `BomLaborLine` add/remove/qty change,
- a `LaborRate.ratePerHour` edit,
- a margin or `priceFromBom` change,
- toggling `bomCostingEnabled`.

### Algorithm (v1 — full recompute)
1. Recompute every sub-assembly `Material.computedCost` in topological order.
2. For every `ProductVariant` with effective `priceFromBom` true **and**
   `bomCostingEnabled` true: recompute cost → price, write `baseRetailPrice` +
   `computedCost`.
3. `invalidateProductCaches()`; write an `AuditLog` row (action
   `BOM_REPRICE` or `MATERIAL_COST_UPDATE`, with before/after + affected count).

At portal scale (hundreds of items) a full recompute is milliseconds and far
less fragile than incremental where-used graph-walking. A targeted "only
recompute parents that transitively use material X" optimization is a documented
future step (§10), not needed for correctness.

### Guardrails
- **Empty-BOM guard:** a `priceFromBom` variant whose effective BOM is empty is
  **skipped** (never repriced to $0) and flagged with a warning in the admin UI.
- **Transaction:** the recompute + writes run in one transaction.
- **Manual price is read-only when `priceFromBom` is on** — the admin UI shows
  the computed price (and breakdown) instead of an editable field, so the two
  sources of truth can't silently disagree.

---

## 6. Toggle behavior

| Level | Field | Effect |
|---|---|---|
| Global | `SiteSetting.bomCostingEnabled` | Master switch. Off ⇒ BOM admin UI hidden, no repricing ever runs. Default **off**. |
| Product | `Product.priceFromBom` | Default for the product's variants. |
| Variant | `ProductVariant.priceFromBom` (nullable) | Override; null inherits the product. **This is the "toggle a single product/variant" capability.** |

Margins resolve the same way (variant → product → global default). A shop can run
a mostly-manual catalog and flip BOM costing on for just one product.

---

## 7. Admin UI surfaces

- **`/admin/materials`** — raw materials + sub-assemblies. CRUD, edit `unitCost`
  (raw), "where used" list, archive (blocked/`Restrict` if still referenced).
  A sub-assembly row opens its **own BOM editor** (its components + labor).
- **`/admin/labor-rates`** — CRUD labor rates.
- **Product / variant edit pages** — embedded **BOM editor**: add components
  (material + qty), labor lines (rate + hours), set markups, `priceFromBom`
  toggle, and a **live cost breakdown** (material cost, labor cost, markup,
  computed price + implied gross margin).
- **`/admin/settings`** — global `bomCostingEnabled` + default markups (a new
  section, only meaningful when enabled).

All admin UI files are fork-free (not core-frozen). The **cost engine
(`lib/bom/cost.ts`) is proposed as a frozen core file** (`core-files.json`) — it
is the shared, correctness-critical math that must stay byte-identical across
forks (§9).

---

## 8. Admin API (optional, Phase 5)

Extends the existing token-authed admin API (`docs/ADMIN-API.md`) so automation
(Hermes) can:
- `PATCH /api/admin/materials/{id}` — update a raw material's `unitCost` (triggers
  reprice + audit), matching the "update raw material prices" goal.
- `GET /api/admin/materials` / `GET .../bom` — read materials and a product's BOM.

Additive + audited, same auth model. Deferred until the core + UI land.

---

## 9. Core-files / fork propagation

- `lib/bom/cost.ts` (the pure engine) → **add to `core-files.json` `frozen`** so
  the costing math is identical everywhere and `check:core-drift` enforces it.
- `lib/bom/reprice.ts` (DB orchestration) → likely an **extension point** (forks
  with diverged schemas — e.g. BCP's price-type matrix — may need to adapt the
  write target). Decide at implementation.
- New Prisma models + migration ship in the template and propagate via the
  normal fork-once flow. Because everything is **additive and dormant by
  default**, existing forks adopt the migration with zero behavior change.

---

## 10. Open questions / future work

1. **Recompute granularity** — v1 full-recompute is fine at portal scale; add a
   where-used/low-level-code targeted recompute if a catalog ever gets large.
2. **Manufacturing overhead** — v1 folds overhead into margin. A future option:
   a per-hour burden rate on labor hours (the textbook standard-cost structure),
   added as `LaborRate.overheadPerHour` or a shop-rate setting.
3. **Weighted-average material cost** — v1 uses an editable standard cost. If we
   later track purchase receipts, offer weighted-average valuation (MRPeasy
   pattern) as an alternative source for `unitCost`.
4. **Variance reporting** — standard (estimated) vs actual cost. Out of scope
   until there's an actuals source; the design keeps standard cost separate so
   this can be added cleanly.
5. **UoM conversion** — `unit` is a display label in v1 (qty expressed in the
   material's own unit). Add real conversions only if a shop needs to buy in one
   unit and consume in another.

---

## 11. Research basis (cited)

Design grounded in a verified survey of ERP/MRP practice (primary vendor docs
unless noted):

- **Bottom-up rollup via low-level codes; this-level vs lower-level cost** —
  Oracle PeopleSoft FSCM; DBA Manufacturing.
- **Cost structure = materials + labor + overhead; labor = hours × rate;
  overhead = per-hour burden (not %-of-material)** — DBA; Odoo 19; AccountingCoach.
- **Standard costing is the practical small-shop method; weighted-average for
  fluctuating raw costs** — CLA Connect; AccountingCoach; MRPeasy.
- **Margin once at the finished good; do NOT compound markup up the tree** —
  Sage 200 ("the sub-assembly's markup … the parent BOM's markup is *not* used");
  Dynamics 365 (per-cost-group profit %, e.g. 50% material / 80% labor). This is
  why v1 rolls sub-assemblies at cost and applies per-element markup once at the
  top.
- **Pitfall guardrails** — circular-ref detection, explicit roll-up→revalue (not
  silent), high-precision compute / round at presentation, snapshot cost+price
  on orders (never reprice history) — Microsoft D365 & Dynamics GP; Odoo.

Full report + verification: deep-research run `wf_d945ff0b-e5a` (109 agents, 26
sources, 24/25 claims confirmed). A claim that "Odoo uses moving-average actual
costing" was **refuted** — do not cite it.

---

## 12. Phased build plan

Each phase is a reviewable PR; all gated on typecheck + `next build` + tests.

1. **Schema + cost engine** — Prisma models + migration (incl. CHECK
   constraints), `lib/bom/cost.ts` pure engine (rollup, per-element markup, cycle
   detection, precision), exhaustive unit tests. No UI, no repricing wiring.
2. **Repricing + propagation** — `lib/bom/reprice.ts`: explicit recompute on
   cost-affecting changes, cache invalidation, audit, empty-BOM guard,
   transaction. Tests against a real local DB.
3. **Admin UI** — materials, labor rates, embedded BOM editor + live breakdown,
   read-only price when `priceFromBom`.
4. **Settings toggle + dormant-by-default + docs** — `bomCostingEnabled` +
   default markups; core-files/drift handling; user-facing docs.
5. **(optional) Admin API** — material-cost update + BOM read endpoints.
