import { MetadataRoute } from "next";

/**
 * robots.txt, generated rather than shipped as a static file.
 *
 * This used to be `public/robots.txt` with the sitemap line commented out and a
 * `https://your-domain.com` placeholder, on the assumption each fork would edit
 * it. None did — so every deployed portal has been telling crawlers nothing
 * about its sitemap, however complete that sitemap is.
 *
 * The domain is derived the same way `app/sitemap.ts` derives it, so it is
 * correct on every fork with no per-customer step.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated and machine-only areas. Crawling them yields nothing
        // useful and buries the catalogue in login redirects.
        disallow: ["/admin", "/portal", "/api", "/auth", "/setup"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
