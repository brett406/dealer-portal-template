import { getTheme } from "@/lib/theme";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const theme = getTheme();

  return (
    <div className="marketing-layout">
      <a href="#main-content" className="visually-hidden" style={{ position: "absolute", zIndex: 999 }}>
        Skip to main content
      </a>
      <SiteHeader brandName={theme.brand.name} logo={theme.brand.logo} />
      <main id="main-content" className="marketing-main">{children}</main>
      <SiteFooter brandName={theme.brand.name} />
    </div>
  );
}
