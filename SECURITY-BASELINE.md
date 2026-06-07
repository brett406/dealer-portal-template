# Security Baseline

Every dealer-portal build (template + each stamped fork) must satisfy this
checklist before launch. It captures the hardening from the June 2026 security
pass so the same holes don't reappear in new stamps. Pair with `DATABASE_SAFETY.md`.

## Authentication & tenancy

- [ ] **Impersonation is SUPER_ADMIN-only and one-way-gated.** The NextAuth `jwt`
      callback must NOT honor `actingAsCustomerId` from a client `session.update()`
      (`trigger === "update"`). Impersonation happens only via `/api/auth/act-as`,
      which checks the caller's role server-side and writes the cookie with `encode()`.
      `getEffectiveCustomerId` / `isActingAsCustomer` (`lib/auth-guards.ts`) must
      ignore `actingAsCustomerId` unless the session role is permitted to impersonate
      (SUPER_ADMIN; NM also allows STAFF/SALES with territory checks).
- [ ] **Every portal server action that takes an id from the client scopes by
      `customerId`/`companyId`.** Especially `reorderToCart` (`lib/orders.ts`) — it
      must look up the customer's company and `findFirst({ where: { id, companyId } })`,
      never `findUnique({ where: { id } })`. Audit cart/account/orders/catalog actions.
- [ ] Login throttling is DB-backed (`lib/auth-security.ts`, `LoginAttempt`).

## CSRF & API routes

- [ ] Every hand-rolled mutating `/api/*` route calls `validateOrigin` (`lib/csrf.ts`):
      at minimum `/api/upload` and `/api/auth/exit-acting-as`. (Server Actions get
      NextAuth/Next CSRF for free — this is only for the raw route handlers.)
- [ ] `/api/upload` is restricted to SUPER_ADMIN/STAFF (no CUSTOMER); there is no
      dealer-facing write to the shared media volume.

## Content / XSS

- [ ] All CMS `richtext` is sanitized **on save** (`lib/sanitize.ts` in the page,
      group, and collection actions) AND **on render** via `components/cms/SafeHtml.tsx`.
      No raw `dangerouslySetInnerHTML` of CMS content. (JSON-LD / theme CSS / GA are
      server-controlled and exempt.)

## Uploads

- [ ] `lib/uploads.ts` blocks executable/script extensions, enforces the size cap,
      AND magic-number-checks binary formats (pdf/images/video/zip) against their bytes.
- [ ] The serving route (`app/api/uploads/[filename]/route.ts`) is auth-gated, guards
      path traversal, and serves SVG/non-raster as `attachment` (never inline).

## Rate limiting

- [ ] Public-form limiting (`lib/rate-limit.ts`) is DB-backed (`RateLimit` table),
      not an in-memory Map — so it holds across Railway instances and redeploys.

## Audit

- [ ] Destructive/sensitive admin actions call `logAudit` (`lib/audit.ts`): company
      approve/reject, admin-user CRUD, act-as, product/category delete. Extend the
      `AuditAction` union when adding new sensitive operations.

## Repo guards

- [ ] Husky pre-commit hook installed (`.husky/pre-commit`, `"prepare": "husky"`):
      blocks committing `.env*` (except `.env.example`), blocks prod-shaped DB
      hostnames, runs `tsc --noEmit`.
- [ ] CI (`.github/workflows/ci.yml`) runs typecheck + tests on every PR.
- [ ] Production `DATABASE_URL` lives only in Railway, never in a working-tree `.env`.

---

Stamping a new customer? The `dealer-portal-stamp` skill references this file —
do not mark a build launch-ready until every box above is checked.
