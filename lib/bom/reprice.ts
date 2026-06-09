/**
 * BOM repricing — the explicit, idempotent recompute (docs/BOM-COSTING.md §5).
 *
 * EXTENSION POINT (core-files.json): forks with diverged pricing schemas may
 * adapt the write target. The math itself lives in the frozen engine
 * (lib/bom/cost.ts) and must not be reimplemented here.
 *
 * v1 is a full recompute: every sub-assembly cost, then every variant whose
 * effective priceFromBom is true. At portal scale (hundreds of items) that is
 * milliseconds, and it is far less fragile than incremental where-used
 * graph-walking. Targeted recompute is documented future work (§10.1).
 *
 * Safety properties:
 * - No-op unless SiteSetting.bomCostingEnabled (missing row = disabled).
 * - One transaction; an advisory lock serializes concurrent reprices (§13.5).
 * - Empty-BOM variants are skipped, never written to $0 (§5).
 * - Writes only rows whose values actually changed — re-running with no cost
 *   changes writes nothing (idempotent).
 * - Past orders are untouched by construction: OrderItem snapshots prices.
 */

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { invalidateProductCaches } from "@/lib/cache-invalidation";
import {
  computeMaterialCosts,
  computeVariantPrice,
  type CostWarning,
} from "@/lib/bom/cost";
import { loadBom } from "@/lib/bom/load";

export type RepriceTrigger =
  | "MATERIAL_COST_UPDATE"
  | "BOM_UPDATE"
  | "LABOR_RATE_UPDATE"
  | "MARGIN_UPDATE"
  | "TOGGLE"
  | "MANUAL";

export interface RepriceChange {
  variantId: string;
  sku: string;
  before: string; // baseRetailPrice, 2dp
  after: string;
}

export interface RepriceResult {
  /** False when bomCostingEnabled is off (or no SiteSetting row) — nothing ran. */
  ran: boolean;
  /** Variants whose baseRetailPrice changed. */
  changes: RepriceChange[];
  /** priceFromBom variants skipped because their effective BOM is empty (§5). */
  skippedEmptyBom: Array<{ variantId: string; sku: string }>;
  /** Engine warnings reached by repriced variants (e.g. uncosted materials). */
  warnings: CostWarning[];
  durationMs: number;
}

/** Max change rows embedded in the audit payload (§13.9); the count is always full. */
const AUDIT_CHANGES_CAP = 50;

export async function repriceAll(opts: {
  trigger: RepriceTrigger;
  /** Admin user attributed in the audit log. */
  userId: string;
  /** The material whose edit triggered this, when applicable. */
  materialId?: string;
}): Promise<RepriceResult> {
  const startedAt = Date.now();

  const result = await prisma.$transaction(
    async (tx) => {
      // Serialize concurrent reprices (§13.5) — released at commit/rollback.
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('bom_reprice'))");

      const settings = await tx.siteSetting.findFirst({
        select: {
          bomCostingEnabled: true,
          defaultMaterialMarginPercent: true,
          defaultLaborMarginPercent: true,
        },
      });
      if (!settings?.bomCostingEnabled) return null;

      const bom = await loadBom(tx, {
        materialMarginPercent: settings.defaultMaterialMarginPercent.toString(),
        laborMarginPercent: settings.defaultLaborMarginPercent.toString(),
      });

      // 1. Roll up every material bottom-up (throws BomCycleError/BomDepthError
      //    on corrupt graphs — aborting the transaction untouched is the point).
      const materialCosts = computeMaterialCosts(bom.materials);

      // 2. Persist Material.computedCost (subassembly: rolled cost; raw: mirror
      //    of unitCost so callers read one field — §3). Display/audit only.
      for (const meta of bom.materialMeta) {
        const computed = materialCosts.get(meta.id);
        if (!computed) continue;
        const next = computed.cost.toFixed(4);
        if (meta.computedCost !== null && meta.computedCost === next) continue;
        await tx.material.update({
          where: { id: meta.id },
          data: { computedCost: next },
        });
      }

      // 3. Reprice every effective-priceFromBom variant.
      const changes: RepriceChange[] = [];
      const skippedEmptyBom: RepriceResult["skippedEmptyBom"] = [];
      const warnings = new Map<string, CostWarning>();

      for (const variant of bom.variants) {
        if (!variant.priceFromBom) continue;

        const priced = computeVariantPrice(variant.engineInput, materialCosts);
        for (const w of priced.warnings) warnings.set(w.materialId, w);

        if (priced.skip) {
          skippedEmptyBom.push({ variantId: variant.variantId, sku: variant.sku });
          continue;
        }

        const nextPrice = priced.price!.toFixed(2);
        const nextCost = priced.totalCost.toFixed(4);
        const priceChanged = variant.currentBaseRetailPrice !== nextPrice;
        const costChanged = variant.currentComputedCost !== nextCost;
        if (!priceChanged && !costChanged) continue;

        await tx.productVariant.update({
          where: { id: variant.variantId },
          data: { baseRetailPrice: nextPrice, computedCost: nextCost },
        });
        if (priceChanged) {
          changes.push({
            variantId: variant.variantId,
            sku: variant.sku,
            before: variant.currentBaseRetailPrice,
            after: nextPrice,
          });
        }
      }

      return { changes, skippedEmptyBom, warnings: [...warnings.values()] };
    },
    { timeout: 30_000 },
  );

  const durationMs = Date.now() - startedAt;

  if (result === null) {
    return { ran: false, changes: [], skippedEmptyBom: [], warnings: [], durationMs };
  }

  // Post-commit side effects. Cache invalidation is best-effort: the store is
  // per-process with a 60s TTL backstop, and revalidatePath needs a Next
  // request context that direct callers (tests, scripts) don't have.
  if (result.changes.length > 0) {
    try {
      invalidateProductCaches();
    } catch (err) {
      console.error("[BOM] cache invalidation failed after reprice:", err);
    }
  }

  await logAudit({
    action: "BOM_REPRICE",
    userId: opts.userId,
    targetType: "ProductVariant",
    details: {
      trigger: opts.trigger,
      ...(opts.materialId ? { materialId: opts.materialId } : {}),
      affectedVariantCount: result.changes.length,
      changes: result.changes.slice(0, AUDIT_CHANGES_CAP),
      skippedEmptyBomCount: result.skippedEmptyBom.length,
      durationMs,
    },
  });

  return { ran: true, ...result, durationMs };
}
