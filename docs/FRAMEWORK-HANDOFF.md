# Framework Handoff — Media Management Build

This branch (`feature/media-management`) is set up so a **fresh Claude Code session on the Framework Desktop** can build the media-management feature end-to-end with no prior context.

## Kickoff prompt (paste into the fresh Framework agent)

> You're building the **media-management** feature for the dealer-portal template.
> The repo is `brett406/dealer-portal-template`, branch `feature/media-management`.
>
> 1. Clone it (or `cd` to it if already present) and check out `feature/media-management`.
> 2. Read `docs/MEDIA-MANAGEMENT-BUILD.md` **in full** — it is the complete, self-contained spec (current state, locked decisions, safety rules, env setup, and 6 build phases).
> 3. Read `DATABASE_SAFETY.md` and `CLAUDE.md` before running any DB command. This template caused a prod wipe once — local DB only, print the host first, never run migrations/tests against a non-local `DATABASE_URL`.
> 4. Do the environment setup in §5 (local Postgres `dealer_portal_dev` + `dealer_portal_test`, a localhost-only `.env`, `prisma migrate deploy`, `npm run dev`).
> 5. Build Phases 1→6 in order. **Commit after each phase.** Pause and report at each phase boundary so Brett can review (he asked for an approval gate per checkpoint).
> 6. The bar to pass is the acceptance checklist in §7. Don't build anything in §8 (out of scope — no tags, no nesting).
> Match existing conventions (§9): server actions + `requireAdmin`/`requireCustomer`, plain co-located CSS, `components/ui/*` primitives — this template is NOT shadcn.

## What's already done (Phase 0)
- `docs/MEDIA-MANAGEMENT-BUILD.md` — the spec
- `DATABASE_SAFETY.md` + root `CLAUDE.md` — guardrails added (upstream had neither)
- `package.json` — removed `--force` from `db:reset*`; now gated on `DATABASE_TEST_URL`

## Notes
- Target UI = folder sidebar (colored folder icons) + file table. Dealer view = read-only version at `/portal/files`.
- The dealer-private fix in Phase 2 (auth-gate `app/api/uploads/[filename]/route.ts`) is required, not optional — today that route serves files to anyone with the URL.
- This is the canonical template. Porting to BHF / Feversham / NM / BCP is a separate manual step later — don't touch those here.
