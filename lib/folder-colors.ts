/**
 * Folder accent colors — the single source of truth for the media-management
 * folder palette. Used to tint folder icons in the sidebar and render the
 * accent-color picker swatches. New folders default to "slate".
 *
 * Keep this in sync with the `accentColor` field on AssetFolder
 * (prisma/schema.prisma), which stores the palette KEY (not the hex).
 */

export type FolderColorKey =
  | "slate"
  | "red"
  | "orange"
  | "yellow"
  | "lime"
  | "green"
  | "teal"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "pink";

// Ordered slate-first, then a rainbow (red → pink). Existing keys (slate, red,
// orange, blue, purple, green) are preserved so folders created earlier keep
// their color. Hexes track the Tailwind 500 scale used elsewhere in the theme.
export const FOLDER_COLORS: Record<FolderColorKey, { label: string; hex: string }> = {
  slate: { label: "Slate", hex: "#64748b" },
  red: { label: "Red", hex: "#ef4444" },
  orange: { label: "Orange", hex: "#f97316" },
  yellow: { label: "Yellow", hex: "#eab308" },
  lime: { label: "Lime", hex: "#84cc16" },
  green: { label: "Green", hex: "#22c55e" },
  teal: { label: "Teal", hex: "#14b8a6" },
  cyan: { label: "Cyan", hex: "#06b6d4" },
  blue: { label: "Blue", hex: "#3b82f6" },
  indigo: { label: "Indigo", hex: "#6366f1" },
  purple: { label: "Purple", hex: "#a855f7" },
  pink: { label: "Pink", hex: "#ec4899" },
};

/** Default accent color applied to newly created folders. */
export const DEFAULT_FOLDER_COLOR: FolderColorKey = "slate";

/** All palette keys, in display order (for rendering the picker). */
export const FOLDER_COLOR_KEYS = Object.keys(FOLDER_COLORS) as FolderColorKey[];

/** Type guard — validates an arbitrary value against the palette keys. */
export function isFolderColorKey(value: unknown): value is FolderColorKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(FOLDER_COLORS, value);
}

/**
 * Resolve a stored accent-color key to its hex value for tinting.
 * Falls back to the default color for null/unknown keys (older folders, or
 * keys removed from the palette).
 */
export function folderColorHex(key: string | null | undefined): string {
  return isFolderColorKey(key)
    ? FOLDER_COLORS[key].hex
    : FOLDER_COLORS[DEFAULT_FOLDER_COLOR].hex;
}
