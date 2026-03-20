import { Barlow, Barlow_Condensed } from "next/font/google";
import { getTheme, getThemeCSSVariables } from "@/lib/theme";
import { GAnalytics } from "@/components/GAnalytics";
import "./globals.css";

const barlow = Barlow({ subsets: ["latin"], display: "swap", weight: ["300", "400", "500", "600"] });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], display: "swap", weight: ["400", "600", "700", "800", "900"], variable: "--font-display" });

export async function generateMetadata() {
  const theme = getTheme();
  return {
    title: theme.brand.name,
    description: theme.brand.name,
    icons: { icon: theme.brand.favicon },
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
        <GAnalytics />
        {children}
      </body>
    </html>
  );
}
