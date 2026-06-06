# Admin API (server-to-server automation)

A token-authed HTTP surface that lets a trusted automation (Hermes / the JB Pro
email agent) perform **routine, additive** catalog/content operations on a live
portal — so adding products no longer requires a developer running a database
script. Destructive/bulk/schema operations are intentionally **not** exposed here.

> Status: v1 complete (template) = catalog + images + content (collections/blog) +
> dealer companies. See `lib/admin-api/` + `app/api/admin/`. Customer forks port these
> unchanged except the catalog (price-type extension — see Fork note).

## Security model

- **Auth:** a single high-entropy `ADMIN_API_TOKEN` (≥32 chars), sent as
  `Authorization: Bearer <token>`, compared in constant time (`lib/admin-api/auth.ts`).
  The token is set **only in Railway** per deployment — never in a working-tree `.env`
  (the Husky hook + `SECURITY-BASELINE.md` enforce this). If unset, every endpoint
  returns `503` (the API is off by default).
- **No `validateOrigin`/CSRF — deliberate.** `lib/csrf.ts` protects *cookie/session*
  auth from browser CSRF. This API has no ambient cookie auth; it requires an explicit
  bearer header, so the CSRF threat model does not apply. The token **is** the control.
  This exemption is intentional and called out here for security review.
- **Defense in depth:** DB-backed `checkRateLimit` (120 req/60s) + `logAudit` on every
  write (new `AuditAction` members: `PRODUCT_CREATE`, `CATEGORY_CREATE`, `ASSET_UPLOAD`, …),
  attributed to the first `SUPER_ADMIN` with `details.via = "admin-api"`.
- **Privilege:** effectively SUPER_ADMIN. Treat the token as a SUPER_ADMIN credential —
  rotate on suspicion, never log it.
- **Additive only:** create/upsert. No delete/reset endpoints. SKU collisions are
  **skipped**, never overwritten.

## Endpoints

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET  | `/api/admin/categories` | — | active categories (FK resolution) |
| POST | `/api/admin/categories` | `{ name, description?, active? }` | idempotent by name/slug |
| POST | `/api/admin/uploads` | multipart `file` | hardened `lib/uploads.ts`; returns `{ url }` |
| GET  | `/api/admin/products?limit=` | — | recent products |
| POST | `/api/admin/products` | product, or `{ products: [...] }` | additive + idempotent |
| POST | `/api/admin/content/{collectionKey}` | item, or `{ items: [...] }` | e.g. `blog`; payload sanitized on save |
| GET  | `/api/admin/price-levels` | — | for company FK resolution |
| GET  | `/api/admin/companies?limit=` | — | recent dealer companies |
| POST | `/api/admin/companies` | `{ name, priceLevel, taxRate?, phone?, notes? }` | resolves priceLevel/taxRate by name |

Blog post (collectionKey `blog`):
```json
{ "payload": { "title": "Made in Canada Products Added", "excerpt": "…",
  "body": "<p>Six new Canadian-made tools…</p>", "date": "2026-06-06" },
  "published": true }
```
Richtext (`body`) is sanitized with `sanitize-html` on save (`lib/admin-api/sanitize.ts`,
mirrors the canonical `lib/sanitize.ts`) — defense in depth with render-time SafeHtml.

Product object:
```json
{
  "name": "Light Rake with Wooden Handle",
  "category": "Garden Tools",
  "description": "14\" wide, 14-tooth steel head…",
  "active": true,
  "madeToOrder": true,
  "variants": [{ "name": "Each", "sku": "BCP-LR14", "retail": 31.95 }],
  "imageUrl": "/api/uploads/...png",
  "imageAlt": "Light Rake with Wooden Handle"
}
```

Every response is `{ ok: boolean, ... }`. `POST /products` returns
`{ ok, data: { created, total, results: [{ status: "created"|"skipped"|"error", … }] } }`.

## Example

```bash
TOKEN=…   # from Railway
BASE=https://www.example-portal.ca

# upload an image
curl -s -X POST "$BASE/api/admin/uploads" -H "Authorization: Bearer $TOKEN" \
  -F file=@./product.png            # → { ok, data: { url } }

# create the product with that image
curl -s -X POST "$BASE/api/admin/products" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "name":"…","category":"Garden Tools","variants":[{"sku":"…","retail":31.95}],"imageUrl":"…" }'
```

## Fork note (IMPORTANT)

This template's catalog is generic: `ProductVariant.baseRetailPrice` priced via the
company's flat `PriceLevel.discountPercent`. Customer forks that added a **price-type
matrix** (e.g. BCP's GRN/RED/NET → `ProductPriceType` + `ProductVariant.priceTypeId`)
must extend the catalog service in their own repo: add `priceTypeCode` to the variant
input, resolve it to `priceTypeId`, and expose `GET /api/admin/price-types`. The auth /
uploads / categories layers are identical and port unchanged.
