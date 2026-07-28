import { prisma } from "@/lib/prisma";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_MAX_FAILURES = 20;

/**
 * Number of proxies between the client and this app that append to
 * X-Forwarded-For. 1 covers the platform edge (Railway); set to 2 when a CDN
 * such as Cloudflare sits in front of it.
 */
const TRUSTED_PROXY_HOPS = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? "1") || 1);

/**
 * Resolve the client IP from X-Forwarded-For.
 *
 * Each proxy APPENDS the peer it saw, so everything to the left of our own
 * trusted hops is attacker-supplied. Reading entry [0] (as this did) let a
 * caller mint a fresh rate-limit bucket per request with a spoofed header,
 * which made the login/registration/public-form limiters unenforceable. Count
 * from the right instead, and never trust the header on a direct connection.
 */
export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (chain.length > 0) {
      const index = Math.max(0, chain.length - TRUSTED_PROXY_HOPS);
      return chain[index] || "unknown";
    }
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
}

/**
 * Check if a login attempt is allowed based on recent failure count.
 * Throws an error starting with "RATE_LIMITED:" if blocked.
 */
export async function checkRateLimit(email: string, ip: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS);

  const recentFailures = await prisma.loginAttempt.count({
    where: {
      email: normalizedEmail,
      ipAddress: ip,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (recentFailures >= LOGIN_MAX_FAILURES) {
    // Find the most recent failure to calculate unlock time
    const lastFailure = await prisma.loginAttempt.findFirst({
      where: {
        email: normalizedEmail,
        ipAddress: ip,
        success: false,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: "asc" },
      skip: LOGIN_MAX_FAILURES - 1,
    });

    if (lastFailure) {
      const unlocksAt = new Date(lastFailure.createdAt.getTime() + LOGIN_WINDOW_MS);

      if (unlocksAt.getTime() > Date.now()) {
        throw new Error(`RATE_LIMITED:${unlocksAt.toISOString()}`);
      }
    }
  }

  // Second limiter, keyed on the email alone. The per-IP budget above resets
  // for every distinct source address, so an attacker spreading guesses across
  // addresses would otherwise get unlimited attempts against one account.
  const emailWindowStart = new Date(Date.now() - EMAIL_WINDOW_MS);

  const emailFailures = await prisma.loginAttempt.count({
    where: {
      email: normalizedEmail,
      success: false,
      createdAt: { gte: emailWindowStart },
    },
  });

  if (emailFailures >= EMAIL_MAX_FAILURES) {
    const oldestInWindow = await prisma.loginAttempt.findFirst({
      where: {
        email: normalizedEmail,
        success: false,
        createdAt: { gte: emailWindowStart },
      },
      orderBy: { createdAt: "asc" },
      skip: EMAIL_MAX_FAILURES - 1,
    });

    if (oldestInWindow) {
      const unlocksAt = new Date(oldestInWindow.createdAt.getTime() + EMAIL_WINDOW_MS);

      if (unlocksAt.getTime() > Date.now()) {
        throw new Error(`RATE_LIMITED:${unlocksAt.toISOString()}`);
      }
    }
  }
}

/**
 * Record a login attempt (success or failure).
 */
export async function recordAttempt(email: string, ip: string, success: boolean): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  await prisma.loginAttempt.create({
    data: {
      email: normalizedEmail,
      ipAddress: ip,
      success,
    },
  });

  // On successful login, clear this account's failures so a burst of guesses
  // from other addresses can't keep the legitimate owner near the per-email cap.
  if (success) {
    await prisma.loginAttempt.deleteMany({
      where: {
        email: normalizedEmail,
        success: false,
      },
    });
  }
}
