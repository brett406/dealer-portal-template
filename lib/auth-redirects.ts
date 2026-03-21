import type { Session } from "next-auth";

export type LoginRedirectReason = "auth-required" | "session-expired" | "forbidden";

/**
 * Return the post-login destination based on the user's role.
 */
export function getPostLoginRedirect(session: Session): string {
  if (session.user.mustChangePassword) {
    return "/auth/change-password";
  }

  switch (session.user.role) {
    case "SUPER_ADMIN":
    case "STAFF":
      return "/admin";
    case "CUSTOMER":
      return "/portal/catalog";
    default:
      return "/auth/login";
  }
}

/**
 * Sanitize a redirect path to prevent open redirects.
 * Only allows paths starting with / (not //) and belonging to known app prefixes.
 */
export function sanitizeRedirectPath(input: unknown, fallback: string): string {
  if (typeof input !== "string") {
    return fallback;
  }

  const trimmed = input.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  const allowedPrefixes = ["/admin", "/portal", "/auth"];

  if (allowedPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
    return trimmed;
  }

  return fallback;
}

/**
 * Build a login redirect URL with reason and optional next path.
 */
export function buildLoginRedirectPath(reason: LoginRedirectReason, next?: string): string {
  const params = new URLSearchParams({ reason });
  const safeNext = next ? sanitizeRedirectPath(next, "") : "";

  if (safeNext) {
    params.set("next", safeNext);
  }

  return `/auth/login?${params.toString()}`;
}
