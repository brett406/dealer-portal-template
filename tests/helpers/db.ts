import { prisma, assertLocalOrTestHost } from "@/lib/prisma";

/**
 * Truncates all tables using TRUNCATE CASCADE to avoid foreign key issues.
 *
 * Defense-in-depth (DATABASE_SAFETY.md §3b): re-assert the host is local/test
 * immediately before the destructive TRUNCATE. lib/prisma.ts already refuses a
 * non-test URL, but this guard stands on its own so a future refactor of the
 * client can't silently re-expose the wipe path.
 */
export async function resetDatabase() {
  const testUrl = process.env.DATABASE_TEST_URL;
  if (!testUrl) {
    throw new Error("resetDatabase: DATABASE_TEST_URL is required");
  }
  assertLocalOrTestHost(testUrl, "DATABASE_TEST_URL");

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
