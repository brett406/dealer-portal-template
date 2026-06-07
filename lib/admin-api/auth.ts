import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { apiError } from "./http";

/**
 * Bearer-token authentication for the admin API.
 *
 * SECURITY MODEL (see docs/ADMIN-API.md):
 * - This is a server-to-server API authenticated by a single high-entropy
 *   `ADMIN_API_TOKEN` secret (per-deployment, stored only in Railway).
 * - It deliberately does NOT use `validateOrigin` (lib/csrf.ts): CSRF protects
 *   *cookie/session* auth from a browser. This API has no ambient cookie auth —
 *   it requires an explicit Authorization header — so the CSRF threat model does
 *   not apply. The token IS the control. We add DB-backed rate limiting and
 *   audit logging as defense-in-depth.
 * - Effective privilege is admin-level, so the token is as sensitive as a
 *   SUPER_ADMIN credential. Treat it accordingly: rotate on suspicion, never log.
 */

export type AdminApiAuthResult =
  | { ok: true; actorUserId: string }
  | { ok: false; response: NextResponse };

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // Length leak is acceptable (token length is not secret); compare same-length
  // buffers in constant time to avoid leaking byte-position of first mismatch.
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Resolve a SUPER_ADMIN to attribute audit-log entries to. */
async function resolveActorUserId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return admin?.id ?? null;
}

export async function authenticateAdminApi(
  request: NextRequest,
): Promise<AdminApiAuthResult> {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token || token.length < 32) {
    return {
      ok: false,
      response: apiError(503, "Admin API is not configured on this deployment"),
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || !constantTimeEquals(match[1].trim(), token)) {
    return { ok: false, response: apiError(401, "Invalid or missing API token") };
  }

  // Defense-in-depth rate limit (DB-backed: shared counter across instances).
  const rl = await checkRateLimit("admin-api", 120, 60);
  if (!rl.allowed) {
    const response = apiError(429, "Rate limit exceeded", {
      retryAfterSeconds: rl.retryAfterSeconds,
    });
    if (rl.retryAfterSeconds) {
      response.headers.set("Retry-After", String(rl.retryAfterSeconds));
    }
    return { ok: false, response };
  }

  const actorUserId = await resolveActorUserId();
  if (!actorUserId) {
    return {
      ok: false,
      response: apiError(503, "No SUPER_ADMIN user to attribute actions to"),
    };
  }

  return { ok: true, actorUserId };
}
