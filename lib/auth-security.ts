import { prisma } from "@/lib/prisma";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
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

  // On successful login, delete old failures for this email+ip so they don't accumulate
  if (success) {
    await prisma.loginAttempt.deleteMany({
      where: {
        email: normalizedEmail,
        ipAddress: ip,
        success: false,
      },
    });
  }
}
