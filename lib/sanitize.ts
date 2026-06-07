import sanitizeHtml from "sanitize-html";

/**
 * Sanitize CMS richtext before it is stored OR rendered.
 *
 * Richtext fields are admin-authored but were previously stored and rendered as
 * raw HTML via dangerouslySetInnerHTML — a stored-XSS sink (a compromised or
 * careless admin, or any future non-admin edit path, could inject script).
 * We sanitize on BOTH boundaries (save in app/admin/pages/actions.ts, render in
 * components/cms/SafeHtml.tsx) as defense in depth.
 *
 * The allowlist covers the formatting the richtext editor can produce: basic
 * block/inline text, lists, links, and images. Scripts, event handlers,
 * iframes, styles, and javascript: URLs are stripped.
 */
const ALLOWED_TAGS = [
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "blockquote", "code", "pre",
  "ul", "ol", "li",
  "a", "img",
  "span", "div",
  "table", "thead", "tbody", "tr", "th", "td",
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    "*": ["class"],
  },
  // Only http(s), mailto, tel and relative URLs. Blocks javascript:/data: vectors.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  // Force external links to be safe.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }, true),
  },
};

export function sanitizeRichtext(html: unknown): string {
  if (typeof html !== "string" || html.length === 0) return "";
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
