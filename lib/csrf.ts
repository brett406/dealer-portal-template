import { NextRequest } from "next/server";

/**
 * Validate that the request Origin matches the app's base URL.
 * This prevents CSRF attacks where a malicious site submits POST requests
 * using the user's authenticated session cookies.
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

  const allowedOrigin =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  // Check Origin header first (preferred)
  if (origin) {
    if (origin !== allowedOrigin) {
      console.warn(`[CSRF] Origin mismatch: got "${origin}", expected "${allowedOrigin}"`);
      return "Invalid request origin";
    }
    return null;
  }

  // Fall back to Referer header
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (refererOrigin !== allowedOrigin) {
        console.warn(`[CSRF] Referer mismatch: got "${refererOrigin}", expected "${allowedOrigin}"`);
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
