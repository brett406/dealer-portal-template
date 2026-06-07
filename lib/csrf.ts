import { NextRequest } from "next/server";

function normalize(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Allowed request origins for CSRF validation:
 *   - AUTH_URL / NEXTAUTH_URL (the app's primary URL), plus
 *   - any origins listed in CSRF_ALLOWED_ORIGINS (comma-separated).
 *
 * Set CSRF_ALLOWED_ORIGINS per deployment to cover apex + www + the platform
 * domain, e.g. "https://example.ca,https://www.example.ca,https://app.up.railway.app".
 * (This replaced a per-fork hardcoded list — keep deployment-specific origins in
 * the env var, never in this core file.)
 */
function getAllowedOrigins(): Set<string> {
  const set = new Set<string>();
  if (process.env.AUTH_URL) set.add(normalize(process.env.AUTH_URL));
  if (process.env.NEXTAUTH_URL) set.add(normalize(process.env.NEXTAUTH_URL));
  for (const o of (process.env.CSRF_ALLOWED_ORIGINS ?? "").split(",")) {
    const trimmed = o.trim();
    if (trimmed) set.add(normalize(trimmed));
  }
  if (set.size === 0) set.add("http://localhost:3000");
  return set;
}

/**
 * Validate that the request Origin (or Referer) matches one of the app's known
 * public URLs. Prevents CSRF where a malicious site submits POST requests using
 * the user's authenticated session cookies.
 *
 * Returns null if valid, or an error message string if invalid.
 */
export function validateOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // In development, allow requests without origin (e.g., curl, Postman)
  if (process.env.NODE_ENV === "development") {
    return null;
  }

  const allowed = getAllowedOrigins();

  // Check Origin header first (preferred)
  if (origin) {
    if (!allowed.has(normalize(origin))) {
      console.warn(`[CSRF] Origin mismatch: got "${origin}", expected one of ${[...allowed].join(", ")}`);
      return "Invalid request origin";
    }
    return null;
  }

  // Fall back to Referer header
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowed.has(normalize(refererOrigin))) {
        console.warn(`[CSRF] Referer mismatch: got "${refererOrigin}", expected one of ${[...allowed].join(", ")}`);
        return "Invalid request origin";
      }
      return null;
    } catch {
      return "Invalid referer header";
    }
  }

  // No Origin or Referer — reject in production
  console.warn("[CSRF] No Origin or Referer header in production request");
  return "Missing request origin";
}
