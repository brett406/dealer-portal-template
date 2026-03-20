import { Inter } from "next/font/google";
import { getTheme, getThemeCSSVariables } from "@/lib/theme";
import { getSiteSettings } from "@/lib/cms";
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cssVars = getThemeCSSVariables();
  const siteSettings = await getSiteSettings();
  const gaId = siteSettings?.googleAnalyticsId;

  return (
    <html lang="en" className={inter.className}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root { ${cssVars} }` }} />
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
              }}
            />
          </>
        )}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
