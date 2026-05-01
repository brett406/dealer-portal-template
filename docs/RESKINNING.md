# Re-skinning Guide

Re-skin the portal for a new client in under 30 minutes — no code changes required.

Almost every brand-facing string, color, font, and image is driven by either `theme.config.yaml`, `content.config.yaml`, or admin-managed CMS records. The only file you need to **edit** is `theme.config.yaml`. Everything else can be set through the admin UI after first run, or pre-seeded by editing the seed defaults.

---

## 1. Theme — colors, fonts, brand name (5 min)

Edit `theme.config.yaml` at the repo root:

```yaml
brand:
  name: "Acme Wholesale"             # Shown in headers, emails, structured data
  logo: "/uploads/logo.svg"          # Path to logo (in public/uploads/)
  favicon: "/uploads/favicon.ico"

colors:
  primary: "#1f2937"                 # Main brand color — buttons, headers
  primaryDark: "#111827"             # Hover / pressed
  secondary: "#3b82f6"               # Accent
  background: "#ffffff"
  surface: "#f9fafb"
  text: "#111827"
  textMuted: "#6b7280"
  border: "#e5e7eb"
  success: "#22c55e"
  warning: "#f59e0b"
  error: "#ef4444"

typography:
  fontFamily: "system-ui, -apple-system, sans-serif"
  headingFontFamily: "system-ui, -apple-system, sans-serif"
  baseFontSize: "16px"

layout:
  maxWidth: "1200px"
  borderRadius: "8px"
  navStyle: "standard"
```

Restart `npm run dev` after editing — the file is read once and cached.

All CSS variables (`--color-primary`, `--font-family`, etc.) are injected from this file at the root layout, so every component picks up the new theme without code changes.

## 2. Logo + Favicon (5 min)

Drop your assets into `public/uploads/` and update the paths in `theme.config.yaml`:

```
public/uploads/logo.svg            # 240×64 recommended; SVG preferred
public/uploads/favicon.ico         # 32×32 .ico
public/icon-192x192.png            # PWA icon
public/icon-512x512.png            # PWA icon
```

Update `public/manifest.webmanifest` `name` and `short_name` for PWA install prompts.

## 3. Site Settings (Admin → Settings) — 5 min

After running `db:seed` (or completing the setup wizard), open `/admin/settings` and set:

- **Site Title** — full brand name shown in browser tabs and emails
- **Site Description** — used as default SEO description
- **Contact Email / Phone / Address** — appear in the footer, contact page, and structured data
- **Notification Email** — admin recipient for new orders, contact form, registrations
- **Google Analytics ID** — optional

## 4. Homepage Content (Admin → Pages → Home) — 10 min

Every section of the homepage is driven by CMS fields. Edit them in the admin without touching code:

- **Hero** — `headline`, `headlineAccent`, `subheadline`, `ctaText`, `ctaHref`, `heroImage`
- **Dependable Tools section** — `dependableHeading`, `dependableImage`, inline CTA text + link
- **How It Works** — `howItWorksLabel`, `howItWorksBody` (rich text)
- **Image Grid** — `gridImage1`, `gridImage2`, `gridOverlayText`
- **Brands section** — repeatable `brands` group: `name`, `category`, `logo`
- **Featured Categories** — pulled from `ProductCategory` where `featured: true`
- **Landscape image** — `landscapeImage`
- **FAQ section** — repeatable `faqs` group: `number`, `question`, `answer`
- **Final CTA** — `ctaSectionTitle`, `ctaSectionAccent`, `ctaSectionTagline`, `ctaSectionBody`, button text + link

Sections render only when their content is populated — empty fields are skipped, so a minimal homepage is just `headline` + `subheadline` + a few feature/FAQ rows.

## 5. About / Contact / Become-a-Dealer pages

All three pages pull copy from `PageContent`. Edit at:

- Admin → Pages → About — `title`, `heroImage`, `body` (rich text)
- Admin → Pages → Contact — `title`, `subtitle`, `infoHeading`, `mapEmbedUrl`
- Admin → Pages → Become a Dealer — `title`, `description`

## 6. Product Catalog (10 min)

Two paths:

**Manual:** Admin → Products → New Product (and Categories first if needed).

**Bulk:** edit `prisma/seed.ts` to replace the demo product list with real data and run `npm run db:reset`. Drop product images into `public/uploads/` and reference them as `/uploads/your-image.jpg`.

For first-time customer migrations from another platform (Webflow, Shopify), write a one-off TypeScript import script tailored to that customer's CSV shape and place it under `scripts/`. The template intentionally does NOT ship a generic CSV importer — every customer has different column shapes, and a case-by-case script is faster than maintaining a config-driven importer.

## 7. Deployment Checklist

- [ ] `theme.config.yaml` updated (brand name, colors, fonts)
- [ ] Logo and favicon replaced in `public/uploads/` and `public/`
- [ ] `manifest.webmanifest` updated (name, theme_color)
- [ ] Setup wizard run, or `db:seed` completed
- [ ] Site Settings populated in `/admin/settings`
- [ ] Homepage content edited in `/admin/pages/home`
- [ ] About / Contact / Become-a-Dealer pages populated
- [ ] Price levels configured (`/admin/price-levels`)
- [ ] Tax rates configured (`/admin/tax-rates`)
- [ ] Shipping settings configured (`/admin/settings`)
- [ ] Feature toggles set (public catalog, registration, PO numbers)
- [ ] First product / category added
- [ ] Test order placed end-to-end
- [ ] `RESEND_API_KEY` set, test email sent successfully
- [ ] Domain pointed at deployment

## What's intentionally NOT pluggable

These are project-level decisions, not template settings:

- **Catalog hierarchy** — products live under `ProductCategory`. If you need a third level (e.g. Industry → Category → Product), use `Product.tags` for the upper level rather than extending the schema.
- **Pricing model** — `PriceLevel` is a global discount % per company. For per-product or per-customer overrides, extend `PriceLevel` or add a `CustomerPriceOverride` model.
- **Multi-currency** — single currency per deployment.
- **Multi-language** — English only.
