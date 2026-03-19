import { prisma } from "@/lib/prisma";

/**
 * Check if a test database is available.
 * If not, tests should skip gracefully.
 */
export async function checkDatabaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Create dealer-settings PageContent for tests that need shipping calculation.
 */
export async function createDealerSettings(overrides: Record<string, string> = {}) {
  return prisma.pageContent.upsert({
    where: { pageKey: "dealer-settings" },
    update: {
      payload: {
        shippingMethod: "flat",
        flatShippingRate: "0",
        ...overrides,
      },
    },
    create: {
      pageKey: "dealer-settings",
      payload: {
        shippingMethod: "flat",
        flatShippingRate: "0",
        ...overrides,
      },
      seo: {},
    },
  });
}
