import { getTheme } from "@/lib/theme";
import { getDealerSettings } from "@/lib/settings";
import { getSiteSettings } from "@/lib/cms";
import { isEditor } from "@/lib/cms-edit";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { EditModeProvider } from "@/components/cms/EditModeProvider";
import { EditToolbar } from "@/components/cms/EditToolbar";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const theme = getTheme();
  // Editors get the inline edit layer; anonymous visitors get plain children
  // (no CMS client JS is shipped to them).
  const editor = await isEditor();
  let dealerSettings;
  try {
    dealerSettings = await getDealerSettings();
  } catch {
    dealerSettings = null;
  }
  const siteSettings = await getSiteSettings();
  const brandName = siteSettings?.siteTitle ?? theme.brand.name;

  return (
    <div className="marketing-layout">
      <a href="#main-content" className="visually-hidden" style={{ position: "absolute", zIndex: 999 }}>
        Skip to main content
      </a>
      {dealerSettings?.announcementBannerEnabled && dealerSettings.announcementBannerText && (
        <div
          style={{
            background: dealerSettings.announcementBannerBgColor,
            color: dealerSettings.announcementBannerTextColor,
            textAlign: "center",
            padding: "0.5rem 1rem",
            fontSize: "0.85rem",
            fontWeight: 500,
          }}
        >
          {dealerSettings.announcementBannerText}
        </div>
      )}
      <SiteHeader brandName={brandName} logo={theme.brand.logo} />
      <main id="main-content" className="marketing-main">
        {editor ? (
          <EditModeProvider>
            <EditToolbar />
            {children}
          </EditModeProvider>
        ) : (
          children
        )}
      </main>
      <SiteFooter
        brandName={brandName}
        logo={theme.brand.logo}
        contactPhone={siteSettings?.contactPhone}
        contactEmail={siteSettings?.contactEmail}
        contactAddress={siteSettings?.contactAddress}
      />
    </div>
  );
}
