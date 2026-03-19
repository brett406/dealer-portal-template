import { prisma } from "@/lib/prisma";

/**
 * Truncates all tables using TRUNCATE CASCADE to avoid foreign key issues.
 */
export async function resetDatabase() {
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
