/**
 * Client IP resolution — the single place that reads forwarding headers.
 *
 * Proxies APPEND the peer they saw to X-Forwarded-For, so everything to the
 * LEFT of our own trusted hops is whatever the caller typed. Reading entry [0]
 * lets an attacker mint a fresh bucket per request, which silently defeats
 * every rate limiter keyed on IP — login, registration, password reset, and the
 * public contact and dealer-application forms.
 *
 * Keep all header parsing here. Six call sites had their own copy of the
 * `split(",")[0]` version, so fixing one of them fixed almost nothing.
 */

/**
 * Number of proxies in front of this app that append to X-Forwarded-For.
 * 1 covers the platform edge (Railway). Set to 2 when a CDN such as Cloudflare
 * sits in front of it, or every visitor collapses into one shared bucket.
 */
function trustedProxyHops(): number {
  return Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? "1") || 1);
}

/** Minimal shape shared by `Headers` and next/headers' ReadonlyHeaders. */
type HeaderReader = { get(name: string): string | null | undefined };

export function resolveClientIp(forwarded: string | null | undefined, realIp: string | null | undefined): string {
  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (chain.length > 0) {
      const index = Math.max(0, chain.length - trustedProxyHops());
      return chain[index] || "unknown";
    }
  }

  return realIp?.trim() || "unknown";
}

/** For route handlers and anywhere holding a `Request`. */
export function clientIpFromRequest(request: Request): string {
  return resolveClientIp(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip"));
}

/** For server actions and pages using `headers()` from next/headers. */
export function clientIpFromHeaders(h: HeaderReader): string {
  return resolveClientIp(h.get("x-forwarded-for"), h.get("x-real-ip"));
}
