# Public Dealer Locator

The template ships with a public-facing dealer locator at `/find-a-dealer` that shows
all active `LocatorDealer` records on a Leaflet map with filtering and search.

`LocatorDealer` is intentionally **separate** from `Customer` / `Company`:

- `Customer` / `Company` — wholesale ordering accounts that log in and place orders
- `LocatorDealer` — public retail outlets that the public can find on a map

A single business may exist as both, or as either alone. Don't try to merge them.

## Admin

`/admin/locator-dealers` — list, create, edit, delete. Each dealer has:

| Field | Notes |
|---|---|
| Name | Required |
| Slug | Auto-generated from name if blank |
| Dealer Type | Free-form ("Authorized", "Distributor", "Service Centre"…) |
| Industries | Comma-separated; used for filter chips |
| Address | Full mailing address |
| Country | 2-letter (CA, US, …); defaults to `SiteSetting.defaultCountry` |
| Latitude / Longitude | Filled in by the geocoder on save |
| Phone / Email / Website | Shown in the map popup and dealer card |
| Notes | Admin-only — never shown publicly |
| Active | Inactive dealers are hidden from `/find-a-dealer` |
| Sort Order | Tiebreaker for display order |

## Geocoding

When the **"Look up latitude / longitude from address on save"** checkbox is ticked,
the server calls [Nominatim](https://nominatim.openstreetmap.org/) with the dealer's
address. No API key required.

Nominatim's usage policy:
- ≤1 request per second (don't bulk-import without a sleep between calls)
- Set `GEOCODE_USER_AGENT` in your env to identify your app

If geocoding fails (rate-limit, ambiguous address, network), the dealer is still saved
without coordinates and listed on the public page but not pinned to the map.

## Public page

`/find-a-dealer` shows:

- A search box (matches name, city, region, postal code, dealer type, industries)
- Filter chips for **Region**, **Dealer Type**, and **Industry** — only render
  for facets that have at least one value across the dataset
- A scrollable card list (left) and an OpenStreetMap-tiled Leaflet map (right)
- Click a card → map flies to that pin; click a pin → popup with phone + website
- Bounds auto-fit to the filtered set

Map defaults are configurable in `SiteSetting`:

- `defaultMapCenterLat` / `defaultMapCenterLng` — initial centre when no dealers match
- `defaultMapZoom` — initial zoom (default 4)

If unset, the map centres on the geographic centre of Canada at zoom 4.

## Bulk import

Per project policy, the template does not ship a generic CSV importer. For each
client migration, write a one-off script under `scripts/` that:

1. Reads the customer's CSV (Webflow / Squarespace / spreadsheet — column shapes vary)
2. Maps columns to `LocatorDealer` fields
3. Calls `prisma.locatorDealer.createMany` (or upserts on slug)
4. Optionally runs `geocodeAddress` per row with a 1.1-second sleep between calls

Example skeleton — `scripts/import-locator-dealers-acme.ts`:

```ts
import { prisma } from "../lib/prisma";
import { geocodeAddress } from "../lib/geocode";
import { generateSlug } from "../lib/slug";
import fs from "fs";
import { parse } from "csv-parse/sync";

const rows = parse(fs.readFileSync("./acme-dealers.csv"), { columns: true });

for (const r of rows) {
  const data = {
    name: r["Name"],
    slug: generateSlug(r["Name"]),
    line1: r["Address"] || null,
    city: r["City"] || null,
    region: r["Province"] || null,
    postalCode: r["Postal"] || null,
    country: "CA",
    phone: r["Phone"] || null,
    website: r["Website"] || null,
    dealerType: r["Dealer Type"] || null,
  };
  const geo = await geocodeAddress(data);
  await prisma.locatorDealer.upsert({
    where: { slug: data.slug },
    update: { ...data, latitude: geo?.latitude ?? null, longitude: geo?.longitude ?? null },
    create: { ...data, latitude: geo?.latitude ?? null, longitude: geo?.longitude ?? null },
  });
  await new Promise((r) => setTimeout(r, 1100)); // Nominatim rate limit
}
```

Run with `npx tsx scripts/import-locator-dealers-acme.ts`.
