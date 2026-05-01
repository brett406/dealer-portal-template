import { Metadata } from "next";
import { getTheme, getThemeCSSVariables } from "@/lib/theme";
import { getSiteSettings } from "@/lib/cms";
import { GAnalytics } from "@/components/GAnalytics";
import { StructuredData } from "@/components/StructuredData";
import "./globals.css";

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
