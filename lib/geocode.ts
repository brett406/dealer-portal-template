/**
 * Geocoding via OpenStreetMap Nominatim — no API key, free, rate-limited
 * to ~1 req/sec. Good enough for occasional admin saves of locator dealers.
 *
 * Set GEOCODE_USER_AGENT in env to identify your app to Nominatim
 * (their usage policy requires a contact). Default falls back to the
 * generic dealer-portal UA.
 */

export type GeocodeResult = {
  latitude: number;
  longitude: number;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  process.env.GEOCODE_USER_AGENT ||
  "dealer-portal-template (https://github.com/brett406/dealer-portal-template)";

export async function geocodeAddress(parts: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): Promise<GeocodeResult | null> {
  const components = [
    parts.line1,
    parts.line2,
    parts.city,
    parts.region,
    parts.postalCode,
    parts.country,
  ]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s) => s.trim());

  if (components.length === 0) return null;

  const q = components.join(", ");
  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // Nominatim's rate limit is 1 req/sec; we don't cache here because the
      // caller (admin save) is low-volume. If you bulk-import, add a
      // 1-second sleep between calls.
    });

    if (!res.ok) {
      console.warn(`[geocode] Nominatim returned ${res.status} for "${q}"`);
      return null;
    }

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return { latitude: lat, longitude: lng };
  } catch (err) {
    console.warn("[geocode] Failed:", err);
    return null;
  }
}
