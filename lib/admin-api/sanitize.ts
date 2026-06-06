import sanitizeHtml from "sanitize-html";

/**
 * Richtext sanitizer for admin-API-authored CMS content.
 *
 * INTERIM / INTEGRATION NOTE: this mirrors the allowlist of the canonical
 * `lib/sanitize.ts` from the June-2026 security pass (same `sanitize-html` lib +
 * options). When that pass lands, repoint this to `@/lib/sanitize` so there is a
 * single source of truth. Requires `sanitize-html` + `@types/sanitize-html` in
 * package.json (the security pass adds them; ensure the lockfile carries them).
 *
 * CMS content is sanitized on save here AND on render (SafeHtml) — defense in depth.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "blockquote", "code", "pre",
    "ul", "ol", "li",
    "a", "img",
    "span", "div",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }, true),
  },
};

/** Sanitize a single HTML/richtext string. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/** Sanitize every string value of a CMS field payload (safe for plain-text fields too). */
export function sanitizePayload(payload: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    out[k] = typeof v === "string" ? sanitizeRichText(v) : String(v ?? "");
  }
  return out;
}
