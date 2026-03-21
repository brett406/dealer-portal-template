import { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { getTheme, getThemeCSSVariables } from "@/lib/theme";
import { GAnalytics } from "@/components/GAnalytics";
import { StructuredData } from "@/components/StructuredData";
import "./globals.css";

const barlow = Barlow({ subsets: ["latin"], display: "swap", weight: ["300", "400", "500", "600"] });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], display: "swap", weight: ["400", "600", "700", "800", "900"], variable: "--font-display" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_URL || "https://bcpinc.ca";

export async function generateMetadata(): Promise<Metadata> {
  const theme = getTheme();
  const title = "Wholesale Farm, Stable & Landscape Tools for Canadian Retailers | Bauman Custom Products";
  const description = "BCP is a Canadian wholesale distributor of farm, stable, and landscape tools. Scenic Road, ScrapeRake, and StableScraper brands. Become a dealer today.";

  return {
    title: {
      default: title,
      template: "%s | Bauman Custom Products",
    },
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
      locale: "en_CA",
      url: SITE_URL,
      siteName: "Bauman Custom Products",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: SITE_URL,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cssVars = getThemeCSSVariables();

  return (
    <html lang="en" className={`${barlow.className} ${barlowCondensed.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root { ${cssVars} }` }} />
      </head>
      <body>
        <StructuredData />
        <GAnalytics />
        {children}
      </body>
    </html>
  );
}
