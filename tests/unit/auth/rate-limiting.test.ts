import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, recordAttempt } from "@/lib/auth-security";

const TEST_EMAIL = "ratelimit@test.com";
const TEST_IP = "192.168.1.100";

describe("Rate limiting", () => {
  it("allows login when no previous failures", async () => {
    await expect(checkRateLimit(TEST_EMAIL, TEST_IP)).resolves.toBeUndefined();
  });

  it("tracks failed attempts", async () => {
    await recordAttempt(TEST_EMAIL, TEST_IP, false);

    const attempts = await prisma.loginAttempt.findMany({
      where: { email: TEST_EMAIL },
    });

    expect(attempts).toHaveLength(1);
    expect(attempts[0].success).toBe(false);
  });

  it("allows login after fewer than 5 failures", async () => {
    for (let i = 0; i < 4; i++) {
      await recordAttempt(TEST_EMAIL, TEST_IP, false);
    }

    await expect(checkRateLimit(TEST_EMAIL, TEST_IP)).resolves.toBeUndefined();
  });

  it("blocks after 5 consecutive failures", async () => {
    for (let i = 0; i < 5; i++) {
      await recordAttempt(TEST_EMAIL, TEST_IP, false);
    }

    await expect(checkRateLimit(TEST_EMAIL, TEST_IP)).rejects.toThrow(/RATE_LIMITED:/);
  });

  it("lockout expires after 15 minutes", async () => {
    // Create 5 failures dated 16 minutes ago (outside the window)
    const sixteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000);

    for (let i = 0; i < 5; i++) {
      await prisma.loginAttempt.create({
        data: {
          email: TEST_EMAIL,
          ipAddress: TEST_IP,
          success: false,
          createdAt: sixteenMinutesAgo,
        },
      });
    }

    // Should be allowed because the failures are outside the 15-minute window
    await expect(checkRateLimit(TEST_EMAIL, TEST_IP)).resolves.toBeUndefined();
  });

  it("successful login resets failure count", async () => {
    // Record 4 failures
    for (let i = 0; i < 4; i++) {
      await recordAttempt(TEST_EMAIL, TEST_IP, false);
    }

    // Record a success — clears all failures
    await recordAttempt(TEST_EMAIL, TEST_IP, true);

    // Record 4 more failures — should not be blocked yet
    for (let i = 0; i < 4; i++) {
      await recordAttempt(TEST_EMAIL, TEST_IP, false);
    }

    await expect(checkRateLimit(TEST_EMAIL, TEST_IP)).resolves.toBeUndefined();
  });
});
