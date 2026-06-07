import { sanitizeRichtext } from "@/lib/sanitize";

/**
 * Render CMS richtext as HTML, sanitized at the render boundary.
 *
 * Use this anywhere CMS-authored richtext is rendered as HTML instead of a raw
 * `dangerouslySetInnerHTML={{ __html: value }}`. Sanitizing here (in addition to
 * on save) means existing stored content is normalized safely without a data
 * backfill, and any field that becomes richtext later is covered automatically.
 */
export function SafeHtml({
  html,
  className,
}: {
  html: unknown;
  className?: string;
}) {
  const clean = sanitizeRichtext(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
