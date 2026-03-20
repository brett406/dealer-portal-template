import { Inter } from "next/font/google";
import { getTheme, getThemeCSSVariables } from "@/lib/theme";
import { GAnalytics } from "@/components/GAnalytics";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

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
    <html lang="en" className={inter.className}>
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
