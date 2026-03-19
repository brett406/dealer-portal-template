/**
 * Generate a URL-safe slug from a name.
 * Shared between categories, products, and any other slugged entities.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
