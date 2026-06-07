import type { ContentConfig, DeepPartial } from "@/lib/content-config";

/**
 * Per-app CMS content-config overrides, deep-merged over the core
 * `content.config.yaml` by `lib/content-config.ts`.
 *
 * APP-OWNED FILE. Each stamped customer edits ONLY this file to customize the
 * CMS — add a page or field, change a label/default, etc. — instead of forking
 * the whole YAML. That keeps `content.config.yaml` a clean core default that
 * propagates from the template via a normal sync.
 *
 * Example:
 *   export const contentOverrides: DeepPartial<ContentConfig> = {
 *     pages: {
 *       home: { fields: { headline: { type: "text", label: "Hero headline" } } },
 *       warranty: { label: "Warranty", fields: { body: { type: "richtext", label: "Body" } } },
 *     },
 *   };
 */
export const contentOverrides: DeepPartial<ContentConfig> = {};
