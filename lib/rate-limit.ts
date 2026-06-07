/**
 * DB-backed rate limiter for public server actions (contact, register,
 * become-a-dealer, password reset, setup).
 *
 * Previously this was an in-memory Map, which silently failed on Railway: each
 * app instance had its own counter and every redeploy reset them, so the limit
 * was effectively per-instance-per-deploy. Backing it with a Postgres row makes
 * the window hold across instances and restarts.
 *
 * NOTE: login throttling lives in lib/auth-security.ts (LoginAttempt) and is
 * unaffected by this module.
 */

import { prisma } from "@/lib/prisma";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
};

/**
 * Check (and record) whether an action is allowed for the given key.
 * @param key - Unique identifier (e.g., "contact:<ip>")
 * @param maxRequests - Max requests allowed within the window
 * @param windowSeconds - Window length in seconds
 *
 * The read-then-write here can admit a few extra requests under heavy
 * concurrency for the same key; that's an acceptable tradeoff for throttling
 * public forms (it is not an auth/security boundary).
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  // No record yet, or the previous window has expired → start a fresh window.
  if (!existing || now > existing.resetAt) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (existing.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  const updated = await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return { allowed: true, remaining: Math.max(0, maxRequests - updated.count) };
}
