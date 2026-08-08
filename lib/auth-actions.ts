"use server";

import { signOut } from "@/lib/auth";

/**
 * Sign-out as a Server Action, not a raw `<form action="/api/auth/signout">`
 * POST. The raw-form version silently fails once a real Content-Security-Policy
 * is in place: Auth.js's built-in CSRF protection expects a `csrfToken` field
 * (or the matching `authjs.csrf-token` cookie, which is only ever set by a
 * visit to /api/auth/csrf — a plain nav to the portal never triggers that), so
 * the POST bounces without clearing the session cookie. No error is shown; the
 * button just does nothing and the user stays logged in. Server Actions get
 * Next.js's own CSRF handling (Origin-header check) for free, which the
 * NextAuth signOut() call underneath doesn't need to duplicate.
 */
export async function signOutAction() {
  await signOut({ redirectTo: "/auth/login" });
}
