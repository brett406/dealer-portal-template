// Independent BOM pricing audit (docs/BOM-COSTING.md).
//
// Recomputes every effective-priceFromBom variant from raw DB rows using
// exact BigInt arithmetic (1e6-scaled inputs, 1e18 intermediates, half-up to
// cents at the end) and compares against the stored baseRetailPrice /
// computedCost. Shares NO code with lib/bom — it is a second, independent
// implementation of the §4 math, so an engine bug cannot hide from it.
//
// Usage:  node scripts/verify-bom-pricing.mjs       (DATABASE_URL from .env)
// Exits 1 on any mismatch. Read-only — safe against any environment.
//
// When the seeded "Custom Fabrication" golden catalog is present, it also
// asserts the hand-calculated literal prices documented in prisma/seed.ts.
import pg from "pg";
import "dotenv/config";

const S6 = 10n ** 6n;
const toS6 = (v) => {
  const [i, f = ""] = String(v).split(".");
  const neg = i.startsWith("-");
  const int = BigInt(i.replace("-", "") || 0) * S6 + BigInt((f + "000000").slice(0, 6));
  return neg ? -int : int;
};
// round half-up: scaled-1e18 → cents string "xx.yy"
const centsFrom18 = (v18) => {
  const unit = 10n ** 16n;
  let cents = v18 / unit;
  if ((v18 % unit) * 2n >= unit) cents += 1n;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
};
// scaled-1e12 → 4dp string (computedCost comparison)
const fourdpFrom12 = (v12) => {
  const unit = 10n ** 8n;
  let m = v12 / unit;
  if ((v12 % unit) * 2n >= unit) m += 1n;
  return `${m / 10000n}.${String(m % 10000n).padStart(4, "0")}`;
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const q = async (sql, p = []) => (await client.query(sql, p)).rows;

const settings = (await q('SELECT "bomCostingEnabled", "defaultMaterialMarginPercent" dm, "defaultLaborMarginPercent" dl FROM "SiteSetting" LIMIT 1'))[0];
if (!settings.bomCostingEnabled) throw new Error("module is off");

const materials = await q('SELECT id, name, sku, kind, "unitCost", "computedCost" FROM "Material"');
const comps = await q('SELECT "productId", "productVariantId", "parentMaterialId", "materialId", quantity FROM "BomComponent"');
const labor = await q('SELECT l."productId", l."productVariantId", l."parentMaterialId", l.hours, r."ratePerHour" FROM "BomLaborLine" l JOIN "LaborRate" r ON r.id = l."laborRateId"');
const products = await q('SELECT id, name, "priceFromBom", "materialMarginPercent" mm, "laborMarginPercent" lm FROM "Product"');
const variants = await q('SELECT id, "productId", sku, "baseRetailPrice", "computedCost", "priceFromBom", "materialMarginPercent" mm, "laborMarginPercent" lm FROM "ProductVariant"');

// Bottom-up material costs (scale 1e12), independent DFS
const matById = new Map(materials.map((m) => [m.id, m]));
const matCost12 = new Map();
function costOf(id, seen = new Set()) {
  if (matCost12.has(id)) return matCost12.get(id);
  if (seen.has(id)) throw new Error("cycle at " + id);
  seen.add(id);
  const m = matById.get(id);
  let total = 0n;
  if (m.kind === "raw") {
    total = toS6(m.unitCost ?? 0) * S6; // 1e12
  } else {
    for (const c of comps.filter((c) => c.parentMaterialId === id))
      total += (toS6(c.quantity) * costOf(c.materialId, seen)) / S6; // 1e6×1e12/1e6
    for (const l of labor.filter((l) => l.parentMaterialId === id))
      total += toS6(l.hours) * toS6(l.ratePerHour); // 1e12
  }
  matCost12.set(id, total);
  return total;
}
for (const m of materials) costOf(m.id);

let pass = 0, fail = 0;
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
};

console.log("— sub-assembly computedCost columns vs independent rollup + hand literals —");
const handSub = { "SA-HINGE-PLATE": "28.5800", "SA-FRAME-SECTION": "87.2000", "SA-GATE-FRAME": "304.1100" };
for (const m of materials.filter((m) => m.kind === "subassembly")) {
  const recomputed = fourdpFrom12(matCost12.get(m.id));
  check(`${m.sku} stored vs recomputed`, Number(m.computedCost).toFixed(4), recomputed);
  if (handSub[m.sku]) check(`${m.sku} vs hand calc`, recomputed, handSub[m.sku]);
}

console.log("— every effective-priceFromBom variant: DB price vs independent recompute —");
const prodById = new Map(products.map((p) => [p.id, p]));
for (const v of variants) {
  const p = prodById.get(v.productId);
  const effective = v.priceFromBom ?? p.priceFromBom;
  if (!effective) continue;
  const own = comps.filter((c) => c.productVariantId === v.id);
  const inherited = comps.filter((c) => c.productId === v.productId);
  const effComps = own.length > 0 ? own : inherited;
  const ownL = labor.filter((l) => l.productVariantId === v.id);
  const inhL = labor.filter((l) => l.productId === v.productId);
  const effLabor = ownL.length > 0 ? ownL : inhL;
  if (effComps.length === 0 && effLabor.length === 0) { console.log(`  – ${v.sku}: empty BOM (skipped by design)`); continue; }
  let mat12 = 0n, lab12 = 0n;
  for (const c of effComps) mat12 += (toS6(c.quantity) * matCost12.get(c.materialId)) / S6;
  for (const l of effLabor) lab12 += toS6(l.hours) * toS6(l.ratePerHour);
  const mm = toS6(v.mm ?? p.mm ?? settings.dm); // 1e6
  const lm = toS6(v.lm ?? p.lm ?? settings.dl);
  const mult = (margin6) => S6 + margin6 / 100n; // 1e6 multiplier
  const price18 = mat12 * mult(mm) + lab12 * mult(lm);
  check(`${v.sku} price`, Number(v.baseRetailPrice).toFixed(2), centsFrom18(price18));
  check(`${v.sku} computedCost`, Number(v.computedCost).toFixed(4), fourdpFrom12(mat12 + lab12));
}

const goldenPresent = variants.some((v) => v.sku === "FAB-GATE-10");
if (goldenPresent) console.log("— hand-calculated literals (computed on paper, not by any code) —");
const hand = !goldenPresent ? {} : {
  "FAB-GATE-10": ["802.56", "521.0100"],
  "FAB-GATE-08": ["738.18", "476.6100"],
  "FAB-GATE-12": ["869.73", "553.2600"],
  "FAB-BENCH-STD": ["282.29", "189.9500"],
  "FAB-BENCH-WIDE": ["371.30", "233.4500"],
};
for (const [sku, [price, cost]] of Object.entries(hand)) {
  const v = variants.find((v) => v.sku === sku);
  check(`${sku} price`, Number(v.baseRetailPrice).toFixed(2), price);
  check(`${sku} cost`, Number(v.computedCost).toFixed(4), cost);
}


console.log(`\n${fail === 0 ? "ALL CHECKS PASSED" : "FAILURES PRESENT"} — ${pass} passed, ${fail} failed`);
await client.end();
process.exit(fail === 0 ? 0 : 1);
