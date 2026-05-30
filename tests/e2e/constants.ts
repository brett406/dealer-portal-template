// Shared constants for the Playwright E2E suite. Seed data, credentials, and
// counts are deterministic so the pagination assertions are exact.

export const E2E = {
  port: 3137,
  baseURL: "http://127.0.0.1:3137",

  // Seeded credentials (passwords are bcrypt-hashed in seed.ts).
  password: "E2e-Test-Pass-1234",
  adminEmail: "e2e-admin@example.com",
  customerEmail: "e2e-dealer@example.com",

  // Public catalog: 30 active products in one category. publicGrid = 24/page → 2 pages.
  categorySlug: "e2e-widgets",
  productCount: 30,

  // Files browser: 20 assets total (portal = 15/page → 2 pages of "All Files").
  // 16 live in the "Brochures" folder (→ 2 folder pages); 4 are unfiled "Catalog" files.
  folderName: "Brochures",
  folderAssetCount: 16,
  unfiledAssetCount: 4,
} as const;

export const AUTH_DIR = "playwright/.auth";
export const ADMIN_STATE = `${AUTH_DIR}/admin.json`;
export const CUSTOMER_STATE = `${AUTH_DIR}/customer.json`;
