import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ─── Host allowlist ─────────────────────────────────────────────────────────
// Used by this module + reusable by reset / truncate helpers in tests and
// scripts. See DATABASE_SAFETY.md §3a/3b.
export function assertLocalOrTestHost(
  url: string,
  label = "DATABASE_URL",
): void {
  const host = new URL(url).hostname;
  const ok =
    /^(localhost|127\.0\.0\.1)$/.test(host) || /-test|_test/i.test(host);
  if (!ok) {
    throw new Error(
      `${label} host "${host}" is not local/test. Refusing to run. See DATABASE_SAFETY.md.`,
    );
  }
}

// ─── URL resolution ─────────────────────────────────────────────────────────
// Test mode MUST use a separate DATABASE_TEST_URL pointing at a local/test host.
// Falling back to DATABASE_URL is the pattern that wiped a prod DB in May 2026
// and is explicitly banned by DATABASE_SAFETY.md §4. No `?? DATABASE_URL`. Ever.
function resolveDatabaseUrl(): string {
  const isTest =
    process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);

  if (isTest) {
    const testUrl = process.env.DATABASE_TEST_URL;
    if (!testUrl) {
      throw new Error(
        "DATABASE_TEST_URL is required in test mode. Refusing to fall back to DATABASE_URL. See DATABASE_SAFETY.md.",
      );
    }
    assertLocalOrTestHost(testUrl, "DATABASE_TEST_URL");
    return testUrl;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }
  return process.env.DATABASE_URL;
}

// ─── Lazy Proxy client ──────────────────────────────────────────────────────
// Construction (and the URL/host check) happens on first property access. Don't
// make it eager — Next.js's build phase imports every route module just to
// collect config, and an eager throw bricks the build.
const globalForPrisma = globalThis as unknown as {
  __prisma__?: PrismaClient;
};

let cached: PrismaClient | undefined = globalForPrisma.__prisma__;

function getClient(): PrismaClient {
  if (cached) return cached;
  const adapter = new PrismaPg({ connectionString: resolveDatabaseUrl() });
  cached = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__prisma__ = cached;
  }
  return cached;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return Reflect.get(getClient(), prop);
  },
}) as PrismaClient;
