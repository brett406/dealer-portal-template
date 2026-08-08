/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // E2E runs its own dev server in this same checkout (playwright.config.ts).
  // Two dev servers sharing one .next corrupt each other's chunks (random
  // _next/static 404s on whichever server you were actually using), so the
  // E2E server builds into its own directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Forks add their own external image hosts here. Keep this empty in the
    // template so no customer's storage bucket ships to another customer.
    remotePatterns: [],
  },
  poweredByHeader: false,
  async headers() {
    // Every external host a fork legitimately talks to, in one place. A fork
    // adding its own integration (a different analytics tool, a different
    // map/captcha provider) extends this list rather than picking between
    // "no CSP" and "CSP that breaks on day one." Google Analytics is opt-in
    // per SiteSetting.googleAnalyticsId (admin UI, no redeploy needed) — its
    // hosts are allowed unconditionally so turning it on later never
    // silently breaks against a policy that doesn't know about it yet.
    const csp = [
      "default-src 'self'",
      // Next.js ships an inline hydration/streaming script on every page, and
      // this app uses plenty of inline `style={}` attributes — both need
      // 'unsafe-inline' short of a nonce-based rewrite (a bigger, separate
      // change). Everything else below is a real, enumerated allowlist, so
      // this still blocks the classes of attack CSP is mainly for: exfil to
      // arbitrary hosts, framing, plugins, base-tag/form hijacking.
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.tile.openstreetmap.org",
      "font-src 'self' data:",
      "connect-src 'self' https://challenges.cloudflare.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com",
      "frame-src https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          // The portal and admin must never be framed — an attacker overlaying
          // a decoy on an iframe can otherwise click-jack an authenticated
          // admin into destructive actions.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
