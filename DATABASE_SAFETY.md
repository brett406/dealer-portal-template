# Database & Data Safety — Non-Negotiable Rules

This document lives at the root of every project that touches a database. It is binding for any agent (AI or human) working in this repo. **A production wipe already happened once on a sibling repo because these rules were missing. They are not optional.**

---

## 0. The incident this exists to prevent

In one of Brett's dealer-portal repos, an agent was asked to "run the tests." The repo's `vitest.config.ts` loaded `dotenv/config` at module scope, the `.env` happened to contain the production Railway `DATABASE_URL`, the `lib/prisma.ts` test-mode safety silently fell back to that URL when `DATABASE_TEST_URL` was unset, and `tests/setup.ts` ran a `TRUNCATE … CASCADE` over every domain table in `beforeEach`. One `npm test` invocation deleted every customer, order, and product. There was no git history and no verified backup. **None of this required a "destructive" command. It was a normal test run against a misconfigured env.** Assume the same trap exists in any new repo until you have personally proven it doesn't.

---

## 1. Hard rules — apply to every project, no exceptions

1. **Production credentials never live in a working-directory `.env`.** Prod creds live in the deployment platform (Railway, Vercel, etc.) and nowhere else on disk. If you find a `.env` containing a prod hostname, stop and alert Brett before doing anything else.
2. **No agent (AI or human) runs destructive commands against a non-local URL.** Forbidden against any URL whose host is not `localhost`, `127.0.0.1`, or contains `-test`/`_test`:
   - `npm test` / `vitest` / `pytest` / any test runner
   - `prisma migrate reset`, `prisma migrate deploy`, `prisma db push`, `prisma db seed`
   - `npm run db:*`, `npm run seed`, any `db:reset` / `db:wipe` / `db:fresh` script
   - `psql` with anything other than `SELECT` / `EXPLAIN` / `\d` introspection
   - `pg_dump --clean`, `DROP`, `TRUNCATE`, `DELETE` without a `WHERE`, `UPDATE` without a `WHERE`
   - Any framework's "reset", "rebuild", "fresh", "wipe", "nuke" command
3. **`--force` is banned in package scripts.** Any `migrate reset --force`, `db push --force-reset`, equivalent in other ORMs — remove the flag. The confirmation prompt is the safety. If a script needs to run unattended in CI, gate it on `CI=true` AND a host check.
4. **Test-mode env handling must fail loud, not fall back.** If the code switches behavior based on `NODE_ENV === "test"` or `VITEST` or equivalent, it must **require** a separate test database URL (`DATABASE_TEST_URL`, `TEST_DATABASE_URL`, etc.) and **assert** the host is local/test-pattern. **No `?? DATABASE_URL` fallback. Ever.** If the test URL is unset or non-local, throw with a loud message; do not run.
5. **Backups are a deploy gate, not a checkbox.** A project is not "in production" until: (a) automated backups run on a schedule with verified retention, (b) the most recent backup is < 25 hours old, and (c) a restore has been tested at least once against a non-prod target. No customer demo, no live cutover, no real users until all three are true.
6. **Every repo with a database is in git.** No exceptions. `git init` + remote + push on day one, before any seed runs. If you find a repo without `.git`, stop and ask Brett before doing anything destructive — there is no recovery path.

---

## 2. Pre-action checklist — run mentally before any DB-touching command

Before running anything that could write to a database, the agent answers all four out loud:

- [ ] **Which database will this hit?** (Print/paste the resolved host. "Whatever's in `DATABASE_URL`" is not an answer.)
- [ ] **Is that host local or a recognized test host?** (`localhost`, `127.0.0.1`, `*-test*`, `*_test*`. If the host contains `railway.app`, `supabase.co`, `neon.tech`, `rds.amazonaws.com`, or any prod-shaped domain — **stop**.)
- [ ] **When was the last verified backup?** (If unknown, treat as "no backup" and refuse to proceed on prod.)
- [ ] **Is there a path to undo this in under 5 minutes?** (If no, escalate to Brett before running.)

If any answer is unclear, do not run the command. Ask.

---

## 3. Required code-level guards (every database-backed project)

Every project ships with these guards in code, not in documentation. Documentation alone is not sufficient — the next agent will not read it carefully enough.

### 3a. DB client must reject non-local URLs in test mode

```ts
// lib/prisma.ts (or equivalent)
function resolveDatabaseUrl() {
  const isTest = process.env.NODE_ENV === "test" || !!process.env.VITEST;
  if (isTest) {
    const testUrl = process.env.DATABASE_TEST_URL;
    if (!testUrl) {
      throw new Error(
        "DATABASE_TEST_URL is required in test mode. Refusing to fall back to DATABASE_URL."
      );
    }
    const host = new URL(testUrl).hostname;
    const ok = /^(localhost|127\.0\.0\.1)$/.test(host) || /-test|_test/i.test(host);
    if (!ok) {
      throw new Error(
        `DATABASE_TEST_URL host "${host}" is not local/test. Refusing to run.`
      );
    }
    return testUrl;
  }
  return process.env.DATABASE_URL!;
}
```

### 3b. Truncate / reset helpers re-assert the host before any destructive op

```ts
// tests/helpers/db.ts (or equivalent)
export async function resetDatabase() {
  const url = process.env.DATABASE_TEST_URL;
  if (!url) throw new Error("resetDatabase: DATABASE_TEST_URL is required");
  const host = new URL(url).hostname;
  const ok = /^(localhost|127\.0\.0\.1)$/.test(host) || /-test|_test/i.test(host);
  if (!ok) throw new Error(`resetDatabase: refusing to truncate non-local host "${host}"`);
  // ... TRUNCATE here ...
}
```

### 3c. Seed scripts refuse to seed prod without an explicit override

```ts
// prisma/seed.ts (or equivalent)
async function main() {
  const url = process.env.DATABASE_URL!;
  const host = new URL(url).hostname;
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(host) || /-test|_test/i.test(host);
  if (!isLocal && process.env.ALLOW_PROD_SEED !== "1") {
    console.error(`FATAL: refusing to seed non-local host "${host}". Set ALLOW_PROD_SEED=1 if you really mean it.`);
    process.exit(1);
  }
  // ... rest of seed ...
}
```

### 3d. Destructive npm scripts are namespaced and gated

In `package.json`:

```jsonc
{
  "scripts": {
    // GOOD — local-only, no --force, fails loud if test URL unset
    "db:reset:local": "DATABASE_URL=\"$DATABASE_TEST_URL\" npx prisma migrate reset",
    // BAD — never ship anything that looks like this:
    // "db:reset": "npx prisma migrate reset --force"
  }
}
```

If a destructive command must exist, prefix it with `dangerous:` so an agent reading the script list has to actively choose it (`dangerous:db:wipe:local`).

### 3e. Pre-commit hook blocks prod creds in `.env`

A pre-commit hook that fails if any `.env*` file (other than `.env.example`) contains a known prod-shaped hostname (`railway.app`, `supabase.co`, `neon.tech`, `rds.amazonaws.com`, or the project's own production domain). Cheap to write, catches the recurring failure mode.

---

## 4. Required infrastructure

Every database-backed project must have, before its first real user:

1. **Automated backups** — daily minimum, weekly + monthly retention, off-platform storage (S3/R2, not the same provider as the DB).
2. **Backup freshness check** — deploy or CI step that fails if the most recent backup is older than 25 hours.
3. **Restore drill** — at least one successful restore to a non-prod target, documented with date and operator name.
4. **Git remote** — pushed to GitHub (or equivalent) on day one. No "I'll commit it later."
5. **Branch protection on the prod branch** — no direct pushes, PR required, status checks pass.

Backup config in Railway env vars and the `backup/` cron service is **not** "set up backups." It's the first half. The second half is verifying restores work.

---

## 5. Operating discipline for the human

Brett, this section is for you:

- **Never give an agent shell access in a repo whose `.env` could resolve to prod.** Either the working dir has no prod creds reachable, or the agent runs read-only. There is no third option.
- **When asking an agent to "investigate" a data issue,** explicitly scope it to read-only. Example: *"Read-only investigation. You may run SELECT queries against [URL]. You may not run any command that writes, deletes, truncates, migrates, seeds, or resets. If you think you need to write, stop and ask."*
- **Treat sibling repos as a class.** If you fix a safety bug in a template (`dealer-portal-template-main`), port the fix to every spawn (`bauman-custom-products-main`, `nm-attachments-main`, `bhf-agri-*`) the same day. Otherwise the bomb is just somewhere else.
- **Rotate credentials immediately after any incident.** If an agent had access to a creds file during a wipe, assume the creds leaked.

---

## 6. New-project checklist

When starting a new project that will touch a database, on day one:

- [ ] `git init`, first commit, push to private GitHub remote
- [ ] Copy this `DATABASE_SAFETY.md` to the repo root
- [ ] Add `CLAUDE.md` at repo root referencing this file
- [ ] Implement guards 3a-3e from this doc before writing any feature code
- [ ] `.env.example` only — never commit `.env`; add a comment block warning about the test-mode trap
- [ ] Pre-commit hook installed (section 3e)
- [ ] Backup service planned and scheduled before first user data lands
- [ ] First restore drill scheduled before first customer demo

---

## 7. If you are an AI agent reading this for the first time

Read sections 1, 2, and 3 in full before running any command in this repo. If any rule conflicts with the user's immediate request, stop and surface the conflict — do not silently violate the rule. The cost of pausing to confirm is low. The cost of a wipe is the entire project.
