import { Metadata } from "next";
import { getTheme, getThemeCSSVariables } from "@/lib/theme";
import { getSiteSettings } from "@/lib/cms";
import { GAnalytics } from "@/components/GAnalytics";
import { StructuredData } from "@/components/StructuredData";
import "./globals.css";

// The root layout (and its generateMetadata) read site settings from the
// database, so every route depends on a live DB. DATABASE_URL is not present
// during the Docker `next build`, and lib/prisma throws when it's unset — so any
// build-time static prerender (e.g. /_not-found) would crash the build. Render
// at request time, where the DB is connected. This app is inherently dynamic
// (auth, per-dealer pricing) so nothing is lost.
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const theme = getTheme();
  const settings = await getSiteSettings();
  const brand = settings?.siteTitle ?? theme.brand.name;
  const title = settings?.defaultSeoTitle ?? brand;
  const description = settings?.defaultSeoDescription ?? settings?.siteDescription ?? undefined;

  return {
    title: { default: title, template: `%s | ${brand}` },
    description,
    metadataBase: new URL(SITE_URL),
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/apple-icon.png",
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      url: SITE_URL,
      siteName: brand,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: SITE_URL },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cssVars = getThemeCSSVariables();
  const theme = getTheme();

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root { ${cssVars} } body { font-family: ${theme.typography.fontFamily}; }` }} />
      </head>
      <body>
        <StructuredData />
        <GAnalytics />
        {children}
      </body>
    </html>
  );
}
