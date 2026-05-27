import { prisma } from "@/lib/prisma";

/**
 * Truncates all tables using TRUNCATE CASCADE to avoid foreign key issues.
 *
 * Per DATABASE_SAFETY.md §3b: re-assert the target host is local/test BEFORE
 * issuing any destructive SQL. The throw happens before TRUNCATE runs, so even
 * if a misconfigured env points the test DB at a real host, nothing is wiped.
 */
export async function resetDatabase() {
  const url = process.env.DATABASE_TEST_URL;
  if (!url) throw new Error("resetDatabase: DATABASE_TEST_URL is required");
  const host = new URL(url).hostname;
  const ok = /^(localhost|127\.0\.0\.1)$/.test(host) || /-test|_test/i.test(host);
  if (!ok) throw new Error(`resetDatabase: refusing to truncate non-local host "${host}"`);

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "OrderStatusHistory",
      "OrderItem",
      "Order",
      "CartItem",
      "Cart",
      "ProductImage",
      "ProductUOM",
      "ProductVariant",
      "Product",
      "ProductCategory",
      "Address",
      "Customer",
      "Company",
      "PriceLevel",
      "PasswordReset",
      "LoginAttempt",
      "User",
      "ContentRevision",
      "FormSubmission",
      "Asset",
      "AssetFolder",
      "CollectionItem",
      "PageGroupItem",
      "PageContent",
      "SiteSetting"
    CASCADE
  `);
}
