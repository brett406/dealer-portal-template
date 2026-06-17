/**
 * Server-side verification for Cloudflare Turnstile — the anti-spam challenge
 * on public forms (contact, become-a-dealer, register, setup).
 *
 * Fail-open by design:
 *   - If TURNSTILE_SECRET_KEY is not configured, verification is SKIPPED so a
 *     deployment without keys keeps working. The DB-backed rate limiter
 *     (lib/rate-limit.ts) and CSRF origin check (lib/csrf.ts) remain the
 *     baseline protection. Set TURNSTILE_SECRET_KEY *and*
 *     NEXT_PUBLIC_TURNSTILE_SITE_KEY (both per-domain, from the Cloudflare
 *     dashboard) to enforce the challenge.
 *   - If the call to Cloudflare itself fails (network/outage), verification is
 *     also skipped — a Cloudflare hiccup should not take a customer's contact
 *     form offline. Spam protection is best-effort, not an auth boundary.
 */

import { headers } from "next/headers";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

/**
 * Verify a Turnstile token submitted with a public form.
 * @param token - the `cf-turnstile-response` value from the form's FormData.
 */
export async function verifyTurnstile(
  token: FormDataEntryValue | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true }; // not configured → skip (rate limiting still applies)

  if (!token || typeof token !== "string") {
    return { ok: false, reason: "Please complete the verification challenge and try again." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body });
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true };
    // Token rejected (expired, duplicate, or forged). Ask the user to retry —
    // the widget resets itself on a failed submit to issue a fresh token.
    return { ok: false, reason: "Verification failed. Please try again." };
  } catch (err) {
    console.error("Turnstile verification request failed; allowing submission:", err);
    return { ok: true }; // fail open on transient errors
  }
}
