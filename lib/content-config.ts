import fs from "fs";
import path from "path";
import { parse } from "yaml";
import { contentOverrides } from "@/content.overrides";

/**
 * Known field types. Widened with `(string & {})` so a downstream app can
 * introduce its own field type via content.overrides.ts without editing this
 * core file (consumers fall back to text-like handling for unknown types).
 */
export type FieldType = "text" | "richtext" | "image" | "boolean";

export type FieldDef = {
  type: FieldType | (string & {});
  label: string;
  default?: string;
  /** Optional per-app config for custom field types (e.g. select options). */
  config?: Record<string, unknown>;
};

export type GroupDef = {
  label: string;
  fields: Record<string, FieldDef>;
};

export type PageDef = {
  label: string;
  fields: Record<string, FieldDef>;
  groups?: Record<string, GroupDef>;
};

export type CollectionDef = { label: string; fields: Record<string, FieldDef> };

export type ContentConfig = {
  pages: Record<string, PageDef>;
  collections?: Record<string, CollectionDef>;
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge `override` over `base`. Plain objects merge key-by-key; everything
 * else (primitives, arrays) is replaced by the override when present. New keys
 * in the override are added — so an app can add pages/fields or tweak labels
 * and defaults without copying the whole config.
 */
function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : (override as T));
  }
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in out ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

let cached: ContentConfig | null = null;

/**
 * Resolved content config = core defaults (content.config.yaml, shipped from
 * the template/core) layered with per-app overrides (content.overrides.ts,
 * owned by each fork). Forks express only deltas, so core changes propagate
 * through a normal sync instead of every fork hand-maintaining the whole YAML.
 */
export function getContentConfig(): ContentConfig {
  if (cached) return cached;

  const filePath = path.join(process.cwd(), "content.config.yaml");
  const raw = fs.readFileSync(filePath, "utf-8");
  const base = parse(raw) as ContentConfig;

  cached = deepMerge(base, contentOverrides as DeepPartial<ContentConfig>);
  return cached;
}

export function getPageDef(pageKey: string): PageDef | null {
  const config = getContentConfig();
  return config.pages[pageKey] ?? null;
}

export function getPageKeys(): { key: string; label: string }[] {
  const config = getContentConfig();
  return Object.entries(config.pages).map(([key, def]) => ({
    key,
    label: def.label,
  }));
}

export function getCollectionKeys(): { key: string; label: string }[] {
  const config = getContentConfig();
  if (!config.collections) return [];
  return Object.entries(config.collections).map(([key, def]) => ({
    key,
    label: def.label,
  }));
}

export function getCollectionDef(collectionKey: string): CollectionDef | null {
  const config = getContentConfig();
  return config.collections?.[collectionKey] ?? null;
}
