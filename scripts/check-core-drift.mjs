#!/usr/bin/env node
/**
 * Core-file drift check (Phase 2 fork strategy).
 *
 * The forks have unrelated git histories, so we don't rely on `git merge` to
 * keep the shared engine in sync — we keep "core-owned" files byte-identical and
 * fail CI if a fork edits one. Run this in each FORK with TEMPLATE_DIR pointing
 * at a checkout of the template (the source of truth):
 *
 *   TEMPLATE_DIR=/path/to/dealer-portal-template node scripts/check-core-drift.mjs
 *
 * In CI, clone the template at the pinned ref first, then run this. In the
 * template repo itself the check is a no-op (it IS the source) unless TEMPLATE_DIR
 * is set to another checkout.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "core-files.json"), "utf8"));

const templateDir = process.env.TEMPLATE_DIR;
if (!templateDir) {
  console.error(
    "check-core-drift: set TEMPLATE_DIR to a checkout of dealer-portal-template (the core source of truth).",
  );
  process.exit(2);
}

let drift = 0;
let missing = 0;
for (const rel of manifest.frozen) {
  const localPath = join(root, rel);
  const upstreamPath = join(templateDir, rel);
  if (!existsSync(upstreamPath)) {
    console.error(`  ? upstream missing: ${rel} (is TEMPLATE_DIR correct / up to date?)`);
    missing++;
    continue;
  }
  if (!existsSync(localPath)) {
    console.error(`  ✗ MISSING here: ${rel} — core file not present in this repo`);
    drift++;
    continue;
  }
  if (readFileSync(localPath, "utf8") !== readFileSync(upstreamPath, "utf8")) {
    console.error(`  ✗ DRIFT: ${rel} differs from core — change it in the template and sync, don't edit here`);
    drift++;
  }
}

if (drift === 0 && missing === 0) {
  console.log(`✓ ${manifest.frozen.length} core files match the template.`);
}
process.exit(drift > 0 ? 1 : 0);
