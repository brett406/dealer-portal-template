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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "smbmfg.s3.ca-central-1.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
