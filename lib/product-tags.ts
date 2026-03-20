export const TAG_STYLES: Record<string, { bg: string; text: string }> = {
  "Sale":        { bg: "#dc2626", text: "#ffffff" },
  "New":         { bg: "#2563eb", text: "#ffffff" },
  "Clearance":   { bg: "#d97706", text: "#ffffff" },
  "Best Seller": { bg: "#059669", text: "#ffffff" },
  "Limited":     { bg: "#7c3aed", text: "#ffffff" },
};

export function getTagStyle(tag: string): { bg: string; text: string } {
  return TAG_STYLES[tag] ?? { bg: "#6b7280", text: "#ffffff" };
}
