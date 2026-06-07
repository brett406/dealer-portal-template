import { sanitizeRichtext } from "@/lib/sanitize";

/**
 * Richtext/payload sanitization for admin-API-authored CMS content.
 *
 * HTML sanitization is delegated to the canonical `@/lib/sanitize` (the
 * June-2026 security pass) so there is a SINGLE source of truth for the allowlist
 * — this module only adds the recursive payload walk the admin API needs.
 * CMS content is sanitized on save here AND on render (SafeHtml) — defense in depth.
 */

/** Sanitize a single HTML/richtext string via the canonical sanitizer. */
export function sanitizeRichText(html: string): string {
  return sanitizeRichtext(html);
}

/**
 * Recursively sanitize string leaves of a value, preserving structure and
 * non-string primitives (numbers, booleans, null). Arrays/objects keep their
 * shape — only string values are run through the HTML sanitizer.
 */
function sanitizeValue(v: unknown): unknown {
  if (typeof v === "string") return sanitizeRichText(v);
  if (Array.isArray(v)) return v.map(sanitizeValue);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = sanitizeValue(val);
    return out;
  }
  return v; // number | boolean | null | undefined — preserved as-is
}

/** Sanitize a CMS field payload: string leaves sanitized, structure preserved. */
export function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) out[k] = sanitizeValue(v);
  return out;
}
