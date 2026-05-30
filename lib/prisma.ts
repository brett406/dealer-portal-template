import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Resolve the database URL for the current process.
 *
 * Per DATABASE_SAFETY.md §3a: in test mode we REQUIRE a separate test URL and
 * assert its host is local/test-pattern. There is intentionally NO
 * `?? DATABASE_URL` fallback — that silent fallback is exactly what wiped a
 * production database once (a test run truncated whatever DATABASE_URL pointed
 * at because DATABASE_TEST_URL was unset). Fail loud instead of running.
 */
function resolveDatabaseUrl(): string {
  const isTest = process.env.NODE_ENV === "test" || !!process.env.VITEST;
  if (isTest) {
    const testUrl = process.env.DATABASE_TEST_URL;
    if (!testUrl) {
      throw new Error(
        "DATABASE_TEST_URL is required in test mode. Refusing to fall back to DATABASE_URL.",
      );
    }
    const host = new URL(testUrl).hostname;
    const ok = /^(localhost|127\.0\.0\.1)$/.test(host) || /-test|_test/i.test(host);
    if (!ok) {
      throw new Error(
        `DATABASE_TEST_URL host "${host}" is not local/test. Refusing to run.`,
      );
    }
    return testUrl;
  }
  return process.env.DATABASE_URL!;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: resolveDatabaseUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
