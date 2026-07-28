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
        ],
      },
    ];
  },
};

export default nextConfig;
