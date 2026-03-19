# Re-skinning Guide

Re-skin the portal for a new client in under 30 minutes.

## 1. Theme Configuration (5 min)

Edit `theme.config.yaml`:

```yaml
brand:
  name: "Your Client Name"
  logo: "/uploads/logo.svg"       # Replace with client logo
  favicon: "/uploads/favicon.ico"

colors:
  primary: "#your-brand-color"     # Main brand color
  primaryDark: "#darker-shade"     # Hover state
  secondary: "#accent-color"
  # Adjust other colors as needed

typography:
  fontFamily: "'Your Font', sans-serif"
```

All CSS variables update automatically — no code changes needed.

## 2. Logo & Favicon (5 min)

1. Place logo at `public/uploads/logo.svg` (or .png)
2. Place favicon at `public/uploads/favicon.ico`
3. Update paths in `theme.config.yaml`

## 3. CMS Content (10 min)

After deploying and seeding, update via Admin → Settings or directly in the database:

**Homepage** (PageContent `pageKey: "home"`):
- `headline`: Main hero text
- `subheadline`: Supporting text
- `ctaText`: Button label
- `ctaHref`: Button link

**Features** (PageGroupItem `pageKey: "home", groupKey: "features"`):
- Update icon, title, description for each feature

**About page** (PageContent `pageKey: "about"`):
- Update `title` and `body`

**Site Settings** (Admin → Settings):
- Business name, contact info, notification email

## 4. Product Catalog (10 min)

1. Update seed data in `prisma/seed.ts` with client's products
2. Or add products manually via Admin → Products

## 5. Deployment Checklist

- [ ] `theme.config.yaml` updated with client brand
- [ ] Logo and favicon replaced
- [ ] CMS content updated
- [ ] Products added (seed or manual)
- [ ] Price levels configured (Admin → Price Levels)
- [ ] Shipping settings configured (Admin → Settings)
- [ ] Feature toggles set (public catalog, registration, PO numbers)
- [ ] Admin email configured
- [ ] Test order placed successfully
