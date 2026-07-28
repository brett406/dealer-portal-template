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

## Account standing

- [ ] Order creation and reorder (`lib/orders.ts`) check customer/company `active`
      and `approvalStatus` themselves. Layout checks do NOT protect server actions:
      they are independent POST endpoints that never render a layout, so a
      terminated dealer could otherwise keep ordering at their old price level.
- [ ] Portal server actions that expose catalog or pricing data (e.g.
      `loadMoreProducts`, `getSearchSuggestions`) call `auth()` themselves. Server
      actions are invocable by anyone who can read the client bundle.

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
- [ ] The serving route (`app/api/uploads/[filename]/route.ts`) guards path traversal,
      serves SVG/non-raster as `attachment` (never inline), and gates downloads to
      admins or CUSTOMERs whose company is active AND approved — the same predicate
      as `/portal/files`. "Any logged-in session" is NOT sufficient: a self-registered
      PENDING account could otherwise fetch dealer price sheets by filename.

## HTTP response headers

- [ ] `next.config.mjs` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
      `Referrer-Policy`, `Permissions-Policy`, and HSTS on every route, with
      `poweredByHeader: false`. Without X-Frame-Options the admin UI can be framed
      and click-jacked.
- [ ] `images.remotePatterns` contains only THIS fork's own image hosts.

## Session lifetime

- [ ] The `jwt` callback in `lib/auth.ts` re-reads `active` and `role` from the
      database (throttled) and returns `null` for a deactivated user. Role and
      active are stamped at sign-in and the cookie lives 12h, so without this a
      fired admin keeps full access until it expires.

## Untrusted text in generated documents

- [ ] `lib/email-templates.ts` escapes every interpolated data field via `esc()`.
      These emails carry the customer's branding and go to their own admins, so
      injected markup reads as legitimate.
- [ ] `escapeCSV` in `lib/export.ts` prefixes values starting with `= + - @ TAB CR`
      so a dealer-supplied PO number cannot execute as a formula in Excel.

## Rate limiting

- [ ] Public-form limiting (`lib/rate-limit.ts`) is DB-backed (`RateLimit` table),
      not an in-memory Map — so it holds across Railway instances and redeploys.
- [ ] `extractClientIp` (`lib/auth-security.ts`) reads the client IP from the RIGHT
      of `X-Forwarded-For`, counting back `TRUSTED_PROXY_HOPS`. Proxies append, so
      the left-most entry is attacker-controlled — reading it makes every limiter
      keyed on IP trivially bypassable.
- [ ] Login limiting has a second counter keyed on the email ALONE, so spreading
      guesses across addresses cannot grant unlimited attempts on one account.

## Audit

- [ ] Destructive/sensitive admin actions call `logAudit` (`lib/audit.ts`): company
      approve/reject, admin-user CRUD, act-as, product/category delete, customer
      password reset. Extend the `AuditAction` union when adding new sensitive
      operations.
- [ ] Setting a dealer's password to a CHOSEN value is SUPER_ADMIN-only — it is
      equivalent to impersonation and would otherwise route around the
      SUPER_ADMIN gate on `/api/auth/act-as`.

## Repo guards

- [ ] Husky pre-commit hook installed (`.husky/pre-commit`, `"prepare": "husky"`):
      blocks committing `.env*` (except `.env.example`), blocks prod-shaped DB
      hostnames, runs `tsc --noEmit`.
- [ ] CI (`.github/workflows/ci.yml`) runs typecheck + tests on every PR.
- [ ] Production `DATABASE_URL` lives only in Railway, never in a working-tree `.env`.

---

Stamping a new customer? The `dealer-portal-stamp` skill references this file —
do not mark a build launch-ready until every box above is checked.
