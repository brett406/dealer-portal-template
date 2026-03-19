import fs from "fs";
import path from "path";
import { parse } from "yaml";

export type FieldDef = {
  type: "text" | "richtext" | "image" | "boolean";
  label: string;
  default?: string;
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

export type ContentConfig = {
  pages: Record<string, PageDef>;
  collections?: Record<string, { label: string; fields: Record<string, FieldDef> }>;
};

let cached: ContentConfig | null = null;

export function getContentConfig(): ContentConfig {
  if (cached) return cached;

  const filePath = path.join(process.cwd(), "content.config.yaml");
  const raw = fs.readFileSync(filePath, "utf-8");
  cached = parse(raw) as ContentConfig;
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
