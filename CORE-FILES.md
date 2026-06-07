# Core-owned files & fork strategy

This template is the **source of truth** for a shared dealer-portal engine used by
several forks (nm-attachments, bcp-website, feversham, bhf-mfg). The forks have
**unrelated git histories**, so we can't rely on `git merge` to keep the engine in
sync. Instead:

- **Core-owned files** are kept **byte-identical** across the template and every
  fork. You change them **in the template**, then sync them down to each fork.
- A CI **drift check** (`scripts/check-core-drift.mjs`, list in `core-files.json`)
  fails if a fork has edited a core-owned file.
- **App-owned files** are where each fork customizes.

## Core-owned (frozen — never edit in a fork)

The authoritative list is `core-files.json` (`frozen`). It currently covers the
CMS/security engine: `lib/sanitize.ts`, `lib/cms-edit.ts`, `lib/cms.ts`,
`lib/slug.ts`, `lib/csrf.ts`, `lib/rate-limit.ts`, and all of `components/cms/*`.

To extend or fix one of these: edit it in the template, run the test suite, then
sync the file into each fork (copy or cherry-pick) and run the fork's drift check.

## App-owned (customize freely per fork)

- `content.overrides.ts` — per-app CMS field/page deltas (deep-merged over the core
  `content.config.yaml`). **This is how a fork customizes the CMS** — add pages or
  fields, tweak labels/defaults — without forking the resolver or the YAML.
- `theme.config.yaml`, brand assets.
- `prisma/schema.prisma` — each fork's domain models differ; the shared models
  (PageContent, Asset, RateLimit, etc.) should match, but business models diverge.
- Business logic that genuinely varies: `lib/pricing*`, equipment/quote/locator
  modules, etc.

## Sanctioned extension points (core logic + per-app variance)

A few files are "core logic" but carry small, legitimate per-fork differences, so
they are NOT in the frozen list (`extensionPoints` in core-files.json) — keep their
structure aligned with the template by review, not by byte-equality:

- `lib/content-config.ts` — the resolver logic is shared, but a fork may add field
  types or admin grouping (e.g. bhf's `iconSelect`/`emoji`/`date`, `PAGE_ADMIN_GROUPS`).
  The resolver core (deepMerge + `content.overrides.ts` layering) must stay in step.
- `lib/audit.ts` — shared `logAudit`, but the `AuditAction` union has per-app members.
- `lib/auth.ts` / `lib/auth-guards.ts` — nm adds a `SALES` role + territory scoping.
- `lib/uploads.ts` — storage backends and `MAX_FILE_SIZE` differ per fork.
- `app/admin/pages/actions.ts` — the save engine; keep merge/sanitize behavior in step.

## Running the check

```sh
# In a fork, against a local template checkout:
TEMPLATE_DIR=../dealer-portal-template node scripts/check-core-drift.mjs
# or
TEMPLATE_DIR=../dealer-portal-template npm run check:core-drift
```

In CI, check out the template at the pinned ref into a temp dir, set `TEMPLATE_DIR`,
and run the script as a required step.

> **Note:** enforcement is meaningful once the Phase 2 engine has been synced into
> every fork. Until then, drift is expected for files the forks haven't received yet
> (e.g. the new `components/cms/*` and the `content-config.ts` resolver). One known
> reconciliation: adopt bhf's DB-less `getSiteSettings` try/catch in `lib/cms.ts` as
> the core version so all repos match.
