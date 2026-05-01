---
name: dealer-portal-stamp
description: >
  Stamp a new customer dealer portal from this template — the end-to-end playbook from
  empty repo through DNS cutover. Use this skill whenever the user is starting a new
  customer build off the dealer-portal template, picking up a stamp partway through, or
  asking what's left before launch. Triggers: "stamp BHF", "new dealer portal customer",
  "kick off the [customer] build", "what's next on [customer]", "is [customer] ready to
  ship", "reskin checklist", "[customer] launch checklist". For TEMPLATE-level changes
  (improving the template itself, not stamping a customer), do NOT use this skill —
  edit the template directly.
---

# Dealer Portal Stamp Skill

## Why this exists

Every new customer stamp goes through the same ~10 steps in the same order. Without
a playbook each one drifts: env vars get missed, the seed gets re-run on a populated
DB, RESEND_API_KEY shows up to bite us at launch. This skill makes the stamp boring
on purpose so launches don't surprise anyone.

The work this skill covers is what happens AFTER `Use this template` on GitHub —
turning a fresh stamp into a live, branded, content-populated, deployed dealer
portal.

## Phases

### Phase 1 — Repo + local boot (~30 min)

1. **GitHub:** click `Use this template` on `brett406/dealer-portal-template` →
   create new private repo. Naming: `<customer-shortname>` (lowercase, hyphenated).
   Examples: `bhf-mfg`, `nm-attachments`, `bcp-website`.
2. **Clone locally** under `~/Documents/Claude Work/<repo-name>/`.
3. **Install + generate:** `npm install && npx prisma generate`.
4. **Local DB:** `createdb <repo_name>_dev`, set `DATABASE_URL` in `.env.local`.
5. **Set required env vars** in `.env.local`:
   - `DATABASE_URL` (local pg)
   - `AUTH_SECRET` (`openssl rand -base64 32`)
   - `AUTH_URL=http://localhost:3000`
   - `NEXTAUTH_URL=http://localhost:3000`
6. **Migrate + seed:** `npx prisma migrate deploy && npx prisma db seed`.
7. **Boot:** `npm run dev`. Visit `http://localhost:3000` — should show the generic
   template landing with placeholder logo and demo accounts working.
8. **Smoke-test:** sign in as `admin@example.com / password`, place a test order as
   `john@acmehardware.com / DemoPassword123!`, confirm the order goes through.

### Phase 2 — Reskin (~30 min, per docs/RESKINNING.md)

**Design pre-flight gate — clear before starting Phase 2:**

Do NOT begin reskinning until ALL of these are in hand:

- [ ] Final-form logo SVG in `public/uploads/`
- [ ] At least 3 production-ready hero photographs (2400px+ wide, real environment)
- [ ] The customer-specific design skill (e.g. `bhf-design`) committed to
      `<repo>/.claude/skills/`. If it doesn't exist yet, run the
      `brand-discovery` skill FIRST.
- [ ] At least 5 sentences of real about-us copy from the customer (a paragraph
      they're willing to publish — not a placeholder)
- [ ] Locked colour palette with a contrast-check pass against white and dark
      backgrounds

**If any of those is missing, stop.** Reskinning against placeholders means the
customer reviews a stamp that's 80% generic-template and 20% their logo, and
the engagement loses momentum. The customer's mental model becomes "this is
what my site looks like" — and "we'll polish brand later" then feels like a
downgrade rather than the finish line.

Locked in `theme.config.yaml` and `content.config.yaml`. NO code changes.

1. **`theme.config.yaml`:** brand name, logo, favicon, full color palette, fonts.
2. **Logo + favicon:** drop into `public/uploads/`. Update `manifest.webmanifest`
   with brand name + theme_color.
3. **Site Settings (Admin → Settings):** brand name, description, contact email +
   phone + address, notification email.
4. **Homepage (Admin → Pages → Home):** every section is a CMS field. Populate
   headline, subheadline, CTA, dependable-tools section, image grid, brands group,
   featured-categories blurb, FAQs group, final CTA.
5. **About / Contact / Become-a-Dealer pages:** title + body + map embed if
   applicable.

If the customer needs Google Fonts not already loaded, add a `<link>` in
`app/layout.tsx`. (System fonts are the template default.)

### Phase 3 — Content migration (per customer, see `docs/LOCATOR-DEALER.md`)

The template intentionally does NOT ship a generic CSV importer. Per project
policy, write a one-off importer per customer because every source CSV has
different columns and pre-cleaning rules.

1. **Identify the source.** Webflow CSV exports? Squarespace? A spreadsheet from
   the customer? Check the customer's raw-data folder
   (typically `~/Documents/Claude Work/<CUSTOMER>/`).
2. **Write a per-customer importer** under `scripts/import-<customer>-<thing>.ts`
   (e.g. `scripts/import-bhf-products.ts`). Use Webflow's standard CSV columns
   (`Slug`, `Item ID`, `Archived`, `Draft`) to filter out drafts.
3. **Run with `npx tsx scripts/import-<...>.ts`** locally first, verify in admin,
   then commit the script (NOT the source CSV — those are sensitive customer
   data) and re-run on production after deploy.
4. **Images:** download from `uploads-ssl.webflow.com/...` URLs in the CSV to
   `public/uploads/`, rewrite the URL field to the local `/uploads/...` path.
5. **Locator dealers:** import via `LocatorDealer` model with `geocodeAddress`
   per row, sleeping 1.1s between calls (Nominatim policy).
6. **Industries / cross-cutting tags:** populate `ProductCategory.tags` and/or
   `Product.tags` so the chip filter on `/products` has options.

### Phase 4 — Deploy to Railway (~20 min, per `docs/DEPLOYMENT.md`)

1. New Railway project → deploy from GitHub repo (link the new customer repo).
2. Add Postgres service to the project; Railway auto-injects `DATABASE_URL`.
3. Set env vars on the backend service:
   - `AUTH_SECRET` (regenerate, do NOT reuse local)
   - `AUTH_URL` (Railway URL initially; change to custom domain at cutover)
   - `NEXTAUTH_URL` (same as `AUTH_URL`)
   - `RESEND_API_KEY` (production key for the customer's Resend domain)
   - `EMAIL_FROM` (verified sender on customer's domain)
   - Optional: `ORDER_TZ` (default `America/Toronto`),
     `GEOCODE_USER_AGENT` (e.g. `bhf-mfg (https://bhfmfg.com)`)
4. **Migrations run automatically** via `scripts/start.sh` on every deploy.
   The seed does NOT run on prod — by design. `prisma/seed.ts` refuses to
   run when `NODE_ENV=production` or when the DB already has users
   (set `ALLOW_SEED_OVERWRITE=1` to bypass — only for dev resets).
5. Browse the Railway URL → `/setup` shows the first-run wizard. Create
   the customer's super-admin from there, NOT by running seed.
6. Re-run any per-customer import scripts against the production DB
   (`DATABASE_URL` set to production for the run). These are idempotent
   and ONLY add real customer data — never touch demo content.

### Phase 5 — DNS cutover (per `railway-deploy` skill)

1. Customer adds Railway's CNAME / A record to their domain DNS.
2. Wait for SSL provisioning in Railway.
3. Update `AUTH_URL` and `NEXTAUTH_URL` env vars to the custom domain. Redeploy.
4. Test sign-in end-to-end on the custom domain — JWT cookies are bound to
   `AUTH_URL` so a mismatch breaks login silently.
5. Submit sitemap to Google Search Console. Update `public/robots.txt` with the
   final domain.

## Pre-launch checklist

Run before announcing the new portal to the customer's audience.

**Hard-stops — if any of these fail, do not announce:**

- [ ] **Demo copy is dead.** Grep the rendered HTML across every public page
      for: "Welcome to your dealer portal", "your dealer portal", "Dealer
      Portal" (as a literal h1), "example.com", "sales@example.com",
      "Tell your company's story here". Any hit means the seed defaults leaked
      into production. Fix before launching.
- [ ] **No placeholder logo.** The neutral SVG at `/uploads/logo.svg` shipped
      with the template must be replaced.
- [ ] **No demo accounts on production.** `admin@example.com`,
      `john@acmehardware.com`, `staff@example.com` and friends should not
      exist in the production user table. If they do, the seed ran on
      production — clean them out.
- [ ] **`AUTH_URL` matches the live domain.** A mismatch silently breaks login
      via JWT cookie binding.

**Standard checklist:**

- [ ] Theme + logo + favicon all match brand
- [ ] Homepage CMS sections populated
- [ ] About / Contact / Become-a-Dealer pages have real copy
- [ ] At least one product per category exists (or category list is hidden)
- [ ] At least 5 LocatorDealer rows present and geocoded (if dealer locator is in scope)
- [ ] Industry tag chips render on `/products` (if catalog is segmented)
- [ ] Test order placed end-to-end on production
- [ ] Order confirmation + admin notification emails received
- [ ] Forgot-password flow works end-to-end on production
- [ ] `RESEND_API_KEY` set + verified — `Send Test Email` from admin works
- [ ] Custom domain resolves with SSL
- [ ] `robots.txt` Sitemap line points at the custom domain
- [ ] Sign in / sign out / change password all work on custom domain
- [ ] Google Analytics ID set (if applicable)
- [ ] PWA install prompt shows brand name (`manifest.webmanifest` updated)
- [ ] Mobile pass: every page legible at 375px width

## Common stamps that miss

- Forgetting to set `AUTH_SECRET` → silent NextAuth failures.
- Reusing localhost `AUTH_SECRET` in production → JWT signature errors.
- `AUTH_URL` left as Railway URL after DNS cutover → cookies bind to wrong domain.
- `RESEND_API_KEY` unset → emails silently log to console; no alerts.
- Stale CMS defaults from seed (e.g. "Welcome to your dealer portal.") published
  to production because nobody opened Admin → Pages.
- `manifest.webmanifest` still says "Dealer Portal" → ugly PWA install prompt.

## Per-customer skills

Each new customer typically grows its own design + content-migration skills under
`<repo>/.claude/skills/`:

- `<customer>-design` — brand identity, copy tone, layout decisions specific to
  that customer. Output of the `brand-discovery` skill.
- `webflow-import` (or similar) — the per-customer source-data migration playbook

The `bhf-mfg` repo is the canonical example. New customers should clone the
shape of `bhf-design`, NOT copy its content.

## Related skills

- **`brand-discovery`** — runs as Phase 0 before this skill if the customer
  doesn't already have a locked brand. Produces the customer-specific design
  skill that gates Phase 2.
- **`railway-deploy`** — handles the deploy + DNS cutover details.
