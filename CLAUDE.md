# CLAUDE.md — Dealer Portal Template

## Database & Data Safety — non-negotiable

In May 2026 a production database in a downstream fork of this template was wiped because the seed and reset scripts ran against a non-local `DATABASE_URL` with no guards. These rules exist so that never repeats. They override conflicting instructions; if a request would force you to break one, surface it to the operator instead of silently complying. Full doc: `DATABASE_SAFETY.md` in this repo root.

1. **Production `DATABASE_URL` must never appear in any `.env` file on a dev machine.** Production credentials live in Railway. If you find a prod hostname (`railway.app`, `supabase.co`, `neon.tech`, `rds.amazonaws.com`, the customer's domain) inside any `.env*` file on disk, stop and tell the operator before running anything else.

2. **Agents must never run `npm test`, `npm run db:*`, or `npx prisma *` against a non-local `DATABASE_URL`.** Read-only queries (`SELECT`, `EXPLAIN`, schema introspection) are the only operations allowed when investigating data issues on production. If you need to mutate, the operator runs it.

3. **If asked to "reset", "seed", "migrate", or "truncate" anything,** confirm with the operator first AND verify the target host is `localhost`, `127.0.0.1`, or matches `*-test*`/`*_test*` before running. Never assume; print the resolved host and ask.

4. **`--force` flags are banned in package scripts.** If you see one in a script that touches a database, treat it as a bug to fix, not a feature to use. (The `db:reset:local` / `db:test:reset:local` scripts are gated on `DATABASE_TEST_URL` and run without `--force` by design.)

## Pre-action checklist — answer all four before any DB-touching command

- Which DB host will this hit? (Resolve and print it. "Whatever's in `DATABASE_URL`" is not an answer.)
- Is that host local or a recognized test pattern (`localhost` / `127.0.0.1` / `*-test*` / `*_test*`)?
- When was the last verified backup?
- Is there a path to undo this in under 5 minutes?

Any unclear answer = do not run. Ask.

## Local dev — don't trample the live dev server's build dir

Two processes writing the same `.next` corrupt each other: whichever server a
human is actually using starts 404ing `_next/static` chunks until a cache wipe
and restart. `next.config.mjs` supports `NEXT_DIST_DIR` for exactly this:

- The Playwright suite already isolates itself (`.next-e2e` via
  `playwright.config.ts`) — safe to run alongside a dev server.
- **While a dev server is running in this checkout, run verification builds
  as `NEXT_DIST_DIR=.next-build DATABASE_URL="" npm run build`** — a plain
  `npm run build` writes into the live server's `.next` and breaks it.
- Both alt dirs are gitignored.

## Active work

See `docs/MEDIA-MANAGEMENT-BUILD.md` for the in-progress media-management feature (branch `feature/media-management`).
