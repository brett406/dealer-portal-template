# BOM Costing & Pricing — Design

> Status: **IMPLEMENTED (Phases 1–4, 2026-06-09)** — schema + frozen cost engine
> (PR #16), repricing (PR #17), admin UI (PR #18), settings/seed/docs (PR #19).
> Phase 5 (admin API endpoints) remains optional and unbuilt. The module ships
> **dormant**: `bomCostingEnabled` defaults false everywhere.
>
> §1–§12 are the design. §13–§20 are the implementation contract: resolved
> decisions, codebase conventions, validation rules, edge-case behavior, a golden
> worked example, the test plan, and per-phase acceptance criteria.
>
> **Deviations from spec (recorded during the build):**
> - `npm run lint` is not a usable gate — ESLint was never configured in this
>   repo (`next lint` prompts interactively) and CI doesn't run lint. All other
>   §19 gates (tsc, CI-parity build, vitest, Playwright, drift) were enforced.
> - The engine's compute depth guard is on **chain depth** derived from child
>   depths, not recursion depth — memoization means bottom-up traversal never
>   recurses deeply; a recursion backstop also remains for top-down walks.
> - Margin/`priceFromBom` changes audit as `BOM_UPDATE` with
>   `details.op = "pricing"` (not a separate action); `addVariant`'s §13.6
>   reprice uses trigger `BOM_UPDATE` (no variant-create trigger exists in
>   §13.9's union).
> - A reprice failure after a committed BOM-line/margin save returns
>   "Saved, but repricing failed" rather than rolling back the line edit — the
>   reprice is idempotent (§5), so any later trigger heals prices.
> - Material **delete** logs no audit row (§13.9 defines no MATERIAL_DELETE);
>   deletes are Restrict-blocked while referenced, archive is the audited path.
> - Materials/labor-rates pages use locally-styled status badges / danger
>   sections — the shared `StatusBadge`/`DangerZone` components live on the
>   unmerged `feature/admin-ux-pass` branch.

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
- `lib/bom/reprice.ts` (DB orchestration) → **extension point** (add to
  `core-files.json` `extensionPoints`). Decided — see §13.1. Forks with diverged
  schemas (e.g. BCP's price-type matrix) may need to adapt the write target.
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
Per-phase acceptance criteria and verification commands are in §19.

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

---

## 13. Decisions resolved for implementation

Everything in this section is **decided** — an implementing agent must not
re-open these. If one proves wrong mid-build, stop and record it in the PR
description rather than silently changing it (§20.5).

### 13.1 Core-files placement
- `lib/bom/cost.ts` → `core-files.json` **`frozen`**.
- `lib/bom/reprice.ts` → `core-files.json` **`extensionPoints`**.
- Everything else BOM-related (UI, actions, loaders) is fork-free (listed in
  neither array).

### 13.2 Archive vs delete semantics (Material, LaborRate)
- **Delete** is blocked by `onDelete: Restrict` while any `BomComponent` /
  `BomLaborLine` references the row. The UI surfaces the Prisma error as
  "in use by N BOMs — archive instead" with a where-used link.
- **Archive** (`archivedAt` set) is always allowed, even while referenced.
  An archived material/rate **still costs normally** in existing BOMs (zeroing
  it would silently reprice products). It is excluded from add-component /
  add-labor pickers, and any BOM that still references it shows a warning badge
  ("uses archived material X").

### 13.3 `MaterialKind` changes
- `raw → subassembly`: allowed. `unitCost` is retained but ignored;
  `computedCost` is recomputed from its (initially empty) BOM — which triggers
  the empty-BOM warning until components are added.
- `subassembly → raw`: allowed **only if** it has no own `BomComponent` /
  `BomLaborLine` rows; otherwise reject with "remove its components first".

### 13.4 Depth limits
- **At save:** reject a BOM edit that would make any chain deeper than
  **10 levels** (validation error; far beyond any real portal BOM).
- **At compute:** independent visited-set + hard guard at **25 levels** — throws
  `BomCycleError` / `BomDepthError` (per §4.5) so corrupt data can never hang
  the engine.

### 13.5 Reprice concurrency
The reprice transaction takes `pg_advisory_xact_lock(hashtext('bom_reprice'))`
as its first statement, so concurrent cost-affecting edits serialize their
recomputes instead of interleaving writes. At portal scale the lock is held for
milliseconds.

### 13.6 Variant/product status interactions
- **Inactive variants are still repriced** (cheap; keeps data consistent if
  reactivated).
- Creating a new variant under a product with effective `priceFromBom` true
  triggers a reprice of that variant (it inherits the product BOM immediately;
  the form's price field is read-only from the start).
- Turning `priceFromBom` **off** (variant or product level) leaves
  `baseRetailPrice` at its last computed value and makes it manually editable
  again. Nothing is reverted.
- Turning `bomCostingEnabled` **on** runs a full reprice; turning it **off**
  stops all repricing and hides the BOM admin UI, leaving prices as-is.

### 13.7 Raw material with null `unitCost`
Allowed (a shop may catalog materials before costing them). Costs **0** in the
rollup and produces a warning on every product whose effective BOM reaches it
("material X has no cost"). The materials list flags uncosted raw materials.

### 13.8 Material categories
`Material.categoryId` reuses the existing **`ProductCategory`** model (as
specced in §3) — nullable, purely for admin-list filtering. No separate
material-category model in v1; revisit only if a shop's material taxonomy
collides with its catalog taxonomy.

### 13.9 New audit actions
Add to the `AuditAction` union in `lib/audit.ts` (an **extension point**, so
additive edits in the template are allowed):
```
MATERIAL_CREATE | MATERIAL_UPDATE | MATERIAL_ARCHIVE
LABOR_RATE_CREATE | LABOR_RATE_UPDATE | LABOR_RATE_ARCHIVE
BOM_UPDATE          // component/labor line add/remove/edit (one row per save)
BOM_REPRICE         // any reprice run
```
`BOM_REPRICE` details payload:
```jsonc
{
  "trigger": "MATERIAL_COST_UPDATE" | "BOM_UPDATE" | "LABOR_RATE_UPDATE"
           | "MARGIN_UPDATE" | "TOGGLE" | "MANUAL",
  "materialId": "...",            // when triggered by a material edit
  "affectedVariantCount": 12,
  "changes": [{ "variantId": "...", "sku": "...", "before": "100.00", "after": "104.50" }],
  // cap `changes` at 50 entries; always include the full count
  "durationMs": 38
}
```
`AuditLog.userId` is **required** — every reprice trigger is an admin action
(server action: the `requireAdmin()` user; admin API: the first `SUPER_ADMIN`,
`details.via = "admin-api"`, matching the existing admin-API convention).

### 13.10 Engine precision (clarifies §4.4)
- Engine math uses `Decimal` (decimal.js / Prisma's Decimal) end-to-end — **no
  float arithmetic anywhere in `lib/bom/`**. The existing `round2()` helper in
  `lib/pricing.ts` is float-based and must NOT be used inside the engine.
- Within one reprice run, sub-assembly costs are carried **in memory at full
  precision**; the `Decimal(12,4)` stored `computedCost` is display/audit only
  and is never read back mid-run (avoids 4dp re-quantization drift).
- Final price: `ROUND_HALF_UP` to 2dp when writing `baseRetailPrice`.

---

## 14. Implementation conventions (codebase facts)

Verified against the repo 2026-06-09 — follow these patterns; don't invent new ones.

### 14.1 File map
| Phase | Path | Notes |
|---|---|---|
| 1 | `prisma/schema.prisma` | 4 new models + additive columns (§3) |
| 1 | `prisma/migrations/<ts>_add_bom_costing/migration.sql` | `prisma migrate dev` locally, then append the two `CHECK` constraints (§3.1) to the generated SQL |
| 1 | `lib/bom/cost.ts` | pure engine — **frozen** |
| 1 | `lib/bom/types.ts` | engine input/output types (frozen with cost.ts or inlined into it) |
| 1 | `tests/unit/bom/cost.test.ts` | §18.1 |
| 1 | `core-files.json` | + frozen `lib/bom/cost.ts` (+ `lib/bom/types.ts` if separate), + extensionPoint `lib/bom/reprice.ts` |
| 2 | `lib/bom/load.ts` | Prisma → engine-input loader (effective-BOM resolution §4.1) |
| 2 | `lib/bom/reprice.ts` | orchestration: load → compute → write → invalidate → audit |
| 2 | `lib/audit.ts` | + actions (§13.9) |
| 2 | `tests/helpers/factories.ts` | + `createTestMaterial`, `createTestLaborRate`, `createTestBomComponent`, `createTestBomLaborLine` |
| 2 | `tests/integration/bom-reprice.test.ts` | §18.2 |
| 3 | `app/admin/materials/page.tsx`, `[id]/page.tsx`, `actions.ts`, components | mirror `app/admin/products/` structure |
| 3 | `app/admin/labor-rates/page.tsx`, `actions.ts`, components | simpler single-page CRUD (mirror `app/admin/tax-rates/`) |
| 3 | `app/admin/products/[id]/` BOM editor section components + `actions.ts` additions | new `BomSection` alongside existing `VariantSection`/`UOMSection` |
| 4 | `app/admin/settings/` | new BOM section (toggle + default markups) |
| 4 | `prisma/seed.ts` | sample materials/labor/BOM on 2 seeded products (guards already in place) |
| 4 | `docs/BOM-COSTING.md` | flip status header to IMPLEMENTED, note any deviations |
| 5 | `app/api/admin/materials/route.ts`, `app/api/admin/materials/[id]/route.ts` | follow `app/api/admin/products/route.ts` pattern |
| 5 | `docs/ADMIN-API.md` | document new endpoints |

### 14.2 Patterns to follow
- **Admin pages** are async server components; mutations are **server actions**
  in a colocated `actions.ts`. Every action starts with
  `await requireAdmin()` (`lib/auth-guards.ts`; roles `SUPER_ADMIN` | `STAFF`).
  Reference implementation: `app/admin/products/[id]/page.tsx` +
  `app/admin/products/actions.ts`.
- **Validation:** Zod schemas defined inline in the `actions.ts` file (no shared
  schemas dir). Numeric form fields use `z.coerce.number()`. Actions return the
  established `FormState` shape:
  `{ errors?: Record<string, string>; error?: string; success?: boolean }`.
- **Decimal serialization:** convert with `Number(decimalField)` when passing
  from server components to client components (existing convention — see the
  variant mapping in `app/admin/products/[id]/page.tsx`). FormData → Zod
  re-coerces on the way back. Engine internals stay `Decimal` (§13.10).
- **Audit:** `logAudit({ action, userId, targetId?, targetType?, details? })`
  from `lib/audit.ts`; it never throws (silent catch by design).
- **Cache:** call `invalidateProductCaches()` (no arg = all products) from
  `lib/cache-invalidation.ts` after any reprice that wrote prices. The cache is
  per-process in-memory with 60s TTL — no cross-instance invalidation needed
  beyond what existing pricing already accepts.
- **SiteSetting:** read via `getSiteSettings()` in `lib/cms.ts`
  (`findFirst`, returns `null` on error). **Treat `null` as
  `bomCostingEnabled = false`** — the module must fail dormant.
- **Price display:** `formatPrice(n)` from `lib/pricing.ts` for UI strings.
- **Admin UI components:** reuse the existing admin conventions — `StatusBadge`,
  bulk-select `Table`, pagination, and `DangerZone` on the edit page (not list
  rows) — as used across `app/admin/*` (see `feature/admin-ux-pass` patterns).

### 14.3 Commands
| Purpose | Command |
|---|---|
| Typecheck | `npx tsc --noEmit` (no `typecheck` script exists) |
| Lint | `npm run lint` |
| Build (CI parity) | `DATABASE_URL="" npm run build` |
| Unit tests | `npm run test:unit` |
| Integration tests | `npm run test:integration` (needs `DATABASE_TEST_URL` → local PG) |
| Reset local test DB | `npm run db:test:reset:local` |
| Core drift | `npm run check:core-drift` |
| New migration | `npx prisma migrate dev --name add_bom_costing` — **local DB only** (§20.2) |

---

## 15. Validation rules

Enforced in Zod (server actions) and re-checked where noted. All numeric form
inputs: `z.coerce.number()`, then rounded to the column's scale before save.

| Field | Rule |
|---|---|
| `Material.name` | required, 1–200 chars |
| `Material.sku` | optional, ≤ 50 chars, unique (separate namespace from variant SKUs) |
| `Material.unit` | 1–20 chars, default `"each"` |
| `Material.unitCost` | optional (§13.7); if set: ≥ 0, ≤ 99,999,999.9999, 4dp |
| `LaborRate.name` | required, 1–100 chars, unique |
| `LaborRate.ratePerHour` | ≥ 0, ≤ 99,999,999.99, 2dp |
| `BomComponent.quantity` | **> 0** (strictly), ≤ 99,999,999.9999, 4dp |
| `BomLaborLine.hours` | **> 0** (strictly), ≤ 99,999,999.99, 2dp |
| `*MarginPercent` (all levels) | ≥ 0, ≤ 999.99, 2dp |
| `BomComponent` self-reference | a sub-assembly can never contain itself (degenerate cycle — reject at save before the DFS) |
| Cycle / depth | DFS at save (§4.5), depth ≤ 10 at save, hard guard 25 at compute (§13.4) |
| Duplicate lines | same (parent, material) pair on a BOM → reject with "already on this BOM — edit its quantity" (same for (parent, laborRate)) |
| `notes` | optional, ≤ 500 chars |

---

## 16. Edge-case behavior matrix

| Case | Behavior |
|---|---|
| Effective BOM empty, `priceFromBom` on | Skip reprice, keep current price, warning badge on product/variant (§5 guardrail) |
| Raw material `unitCost` null | Costs 0, warning on affected products + materials list (§13.7) |
| Archived material/rate still referenced | Costs normally, excluded from pickers, warning badge (§13.2) |
| Delete referenced material/rate | Blocked (`Restrict`); UI says archive instead (§13.2) |
| Cycle attempted at save | Rejected; error names the path (`A → B → A`) |
| Variant adds its first own component | Variant now fully overrides product **components** (labor unaffected — independent rule, §4.1); UI must warn before the first override line is added |
| Variant deletes its last own component | Variant **reverts to inheriting** the product BOM; UI must warn on that delete |
| `bomCostingEnabled` off | No reprice ever runs; BOM admin UI hidden; BOM data preserved |
| `priceFromBom` turned off | Price keeps last computed value, becomes editable (§13.6) |
| New variant under BOM-priced product | Repriced immediately on create (§13.6) |
| Concurrent cost edits | Serialized via advisory lock (§13.5) |
| Same material consumed directly AND via a sub-assembly | Both paths count (diamond graph) — no dedup; quantities are independent consumptions |
| Reprice mid-failure | Whole transaction rolls back; no partial price writes (§5) |
| `SiteSetting` row missing | Treated as disabled (§14.2) |
| Product deleted | Its `BomComponent`/`BomLaborLine` rows cascade (already specced `onDelete: Cascade`) |

---

## 17. Worked example (golden numbers — use in unit tests)

**Materials**
| Material | Kind | Unit | unitCost |
|---|---|---|---|
| Steel tube | raw | ft | 2.50 |
| Paint | raw | L | 30.00 |
| Bracket | subassembly | each | — (computed) |

**Bracket's own BOM:** 4 ft Steel tube; labor 0.25 h Welder @ 60.00/h.
```
Bracket computedCost = 4 × 2.50 + 0.25 × 60.00 = 10.00 + 15.00 = 25.00   // at cost, NO margin
```

**Variant "Gate 4ft"** (margins: material 40%, labor 80%):
components 10 ft Steel tube, 2 × Bracket, 0.5 L Paint; labor 1.5 h Assembly @ 40.00/h.
```
materialCost = 10 × 2.50  +  2 × 25.00  +  0.5 × 30.00 = 25 + 50 + 15 = 90.00
             //                ^ sub-assembly rolls in at COST, as MATERIAL
laborCost    = 1.5 × 40.00 = 60.00      // only the gate's own labor — Bracket's
                                        // welding is already inside its cost
price        = 90.00 × 1.40 + 60.00 × 1.80 = 126.00 + 108.00 = 234.00
impliedGrossMargin = (234 − 150) / 234 = 35.9%
```
`baseRetailPrice` ← **234.00**; `ProductVariant.computedCost` ← **150.0000**;
`Material.computedCost` (Bracket) ← **25.0000**.

**Precision case:** raw cost 0.3333, qty 3, both margins 0% →
intermediate 0.9999 (never rounded mid-tree), final price **1.00** (half-up at
the end only).

---

## 18. Test plan

### 18.1 Unit — `tests/unit/bom/cost.test.ts` (pure engine, no DB)
1. Raw material cost passthrough (`unitCost`, and null → 0 + warning flag).
2. Sub-assembly rollup at cost — golden Bracket = 25.00 (§17).
3. Finished-good pricing with per-element markup — golden Gate = 234.00 (§17).
4. Sub-assembly counts as **material** at the parent (its internal labor is not
   re-margined).
5. 3-level nesting; diamond graph (shared child consumed via two paths — both
   count).
6. Cycle → `BomCycleError` naming the path; depth > 25 → `BomDepthError`.
7. Margin resolution order: variant → product → site default, field-by-field.
8. Variant all-or-nothing component override; labor override independent (§4.1).
9. Rounding: half-up at final price only; 0.3333×3 case (§17); no float drift
   (e.g. 0.1 + 0.2 style inputs through Decimal).
10. Empty effective BOM → engine returns a "skip" result, not a 0 price.

### 18.2 Integration — `tests/integration/bom-reprice.test.ts` (local test DB)
1. Migration `CHECK`: inserting a `BomComponent`/`BomLaborLine` with zero or two
   parents fails at the DB level.
2. `onDelete: Restrict`: deleting a referenced Material / LaborRate throws.
3. Editing a raw `unitCost` → affected variant's `baseRetailPrice` +
   `computedCost` updated, untouched variants unchanged, one `BOM_REPRICE`
   audit row with correct `affectedVariantCount` + before/after.
4. Topological propagation: editing a leaf raw updates the sub-assembly's
   `computedCost` AND the grandparent product's price in one run.
5. Empty-BOM variant skipped (price unchanged) and flagged.
6. `bomCostingEnabled = false` → reprice is a no-op (no writes, no audit).
7. `priceFromBom = false` variants never written.
8. Mid-run failure rolls back all price writes (inject a failure).
9. Variant-level BOM override beats product BOM; reverts when last line removed.
10. (Phase 5) Admin API: 401 without token, 503 when unset, `PATCH` material
    cost triggers reprice + audit with `details.via = "admin-api"`.

### 18.3 E2E — Playwright (Phase 3, smoke only)
Admin creates a material + labor rate → opens a seeded product → adds BOM lines
→ toggles `priceFromBom` → sees read-only computed price + live breakdown; the
public catalog shows the new price.

CI runs all of this via the existing `.github/workflows/ci.yml` (local PG
service; build runs with `DATABASE_URL=""` — nothing in the module may query
the DB at build time, consistent with the force-dynamic/no-build-DB rule).

---

## 19. Phase acceptance criteria

A phase is DONE only when every box checks. Gates for **every** phase:
`npx tsc --noEmit` ✓ `npm run lint` ✓ `DATABASE_URL="" npm run build` ✓
`npm test` (no NEW failures vs the baseline recorded at session start, §20.4) ✓
`npm run check:core-drift` ✓.

**Phase 1 — Schema + engine**
- [ ] Migration applies cleanly to a fresh local DB AND to a DB seeded with
      existing data (additive-only proof); both `CHECK` constraints present.
- [ ] `lib/bom/cost.ts` has zero imports from Prisma/Next (pure).
- [ ] All §18.1 unit tests pass; engine coverage ≥ the repo's 90% threshold.
- [ ] `core-files.json` updated (§13.1); drift check green.
- [ ] Seeded forks unaffected: no behavior change with flags off (build + tests prove it).

**Phase 2 — Repricing**
- [ ] Every trigger in §5 wired to `reprice()`; all §18.2 tests 1–9 pass.
- [ ] Advisory lock taken (§13.5); transaction semantics verified by test 8.
- [ ] Audit rows match §13.9 payload shape.

**Phase 3 — Admin UI**
- [ ] `/admin/materials`, `/admin/labor-rates`, embedded BOM editor with live
      breakdown (material, labor, markup, price, implied gross margin — §4.3).
- [ ] Price field read-only when effective `priceFromBom` (§5 guardrail).
- [ ] All §16 UI warnings implemented (override/revert warnings, archived/uncosted badges, empty-BOM flag).
- [ ] Every mutation: `requireAdmin()` + Zod (§15) + audit + reprice where cost-affecting.
- [ ] E2E smoke (§18.3) passes.

**Phase 4 — Toggle + seed + docs**
- [ ] Settings section; module fully hidden when disabled; null-settings safe.
- [ ] Seed adds materials/labor/BOMs to 2 products (one with a sub-assembly,
      one with a variant override) — flags **off** by default in seed.
- [ ] This doc's status header flipped to IMPLEMENTED with a deviations list.

**Phase 5 — Admin API (optional)**
- [ ] Endpoints match `docs/ADMIN-API.md` conventions (bearer auth, constant-time
      compare, rate limit, 503-when-unset); §18.2 test 10 passes; doc updated.

---

## 20. Autonomous build-session guide

1. **Branching/PRs.** Branch per phase off `main` (after the design PR #15 is
   merged): `feature/bom-p1-schema-engine`, `feature/bom-p2-reprice`, … Open a
   PR per phase (CI must be green); phases land sequentially. Full autonomy on
   this template repo — build, test, commit, push, open PRs. Do **not**
   propagate to forks (bcp/nm/bhf/feversham) in the same session; propagation is
   a separate, operator-initiated step.
2. **Database safety (non-negotiable, see `DATABASE_SAFETY.md` + CLAUDE.md).**
   All DB work — `prisma migrate dev`, seeds, integration tests — runs against
   the **local** Docker Postgres only (`dealer-portal-pg` container; app dev
   server runs on **:3002**). Resolve and print the DB host before any
   migrate/seed/reset. Never point any command at a non-local URL.
3. **Order of work.** Phases 1→4 strictly in order (5 optional). Within a phase,
   write tests alongside the code they cover, not as a trailing step.
4. **Baseline first.** Before writing any code, run `npm test` once and record
   pre-existing failures (the repo has had some); only **new** failures block a
   phase (§19).
5. **When blocked or a locked decision looks wrong** (§1 locked table, §13):
   don't guess and don't re-decide. Implement the closest compliant behavior if
   one exists; otherwise stop that thread, note the issue + recommendation in
   the PR description under "Deviations / open items", and continue with the
   rest of the phase.
6. **Don't touch** frozen core files (`core-files.json`) other than *adding* the
   new entries in §13.1; don't modify existing migrations; don't edit
   `lib/pricing.ts` rounding helpers (§13.10).
7. **Definition of 90% done:** Phases 1–4 merged-or-PR'd with green CI and §19
   boxes checked. The expected human 10%: design-eye pass on the BOM editor UI,
   margin defaults for a real customer, fork propagation, and the Phase 5 go/no-go.
