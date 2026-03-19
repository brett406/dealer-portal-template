import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware that redirects to /setup if the app hasn't been set up yet.
 * Uses an internal API call to check setup status (middleware can't use Prisma directly).
 * Caches the result — once setup is done, it's done forever.
 */

let setupDone = false;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip for setup page, API routes, static files, and Next.js internals
  if (
    pathname.startsWith("/setup") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/uploads/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Once setup is confirmed, never check again
  if (setupDone) return NextResponse.next();

  try {
    const url = new URL("/api/setup-status", request.url);
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.complete) {
        setupDone = true;
        return NextResponse.next();
      }

      // Not complete — redirect to setup
      return NextResponse.redirect(new URL("/setup", request.url));
    }
  } catch {
    // API not available (e.g., during startup) — let the request through
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
