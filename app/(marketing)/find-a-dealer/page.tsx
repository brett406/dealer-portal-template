import { Metadata } from "next";
import { getActiveLocatorDealers, getLocatorFilterOptions } from "@/lib/locator-dealers";
import { getSiteSettings } from "@/lib/cms";
import { getTheme } from "@/lib/theme";
import { DealerLocator } from "@/components/marketing/DealerLocator";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const brand = settings?.siteTitle ?? getTheme().brand.name;
  return {
    title: `Find a Dealer — ${brand}`,
    description: `Locate ${brand} dealers near you.`,
    alternates: { canonical: "/find-a-dealer" },
    openGraph: { title: `Find a Dealer — ${brand}`, url: "/find-a-dealer" },
  };
}

export default async function FindADealerPage() {
  const [dealers, filterOptions, settings] = await Promise.all([
    getActiveLocatorDealers(),
    getLocatorFilterOptions(),
    getSiteSettings(),
  ]);

  const defaultCenter = settings?.defaultMapCenterLat !== null && settings?.defaultMapCenterLng !== null && settings?.defaultMapCenterLat !== undefined && settings?.defaultMapCenterLng !== undefined
    ? { lat: Number(settings.defaultMapCenterLat), lng: Number(settings.defaultMapCenterLng) }
    : { lat: 56.1304, lng: -106.3468 };
  const defaultZoom = settings?.defaultMapZoom ?? 4;

  return (
    <div className="container" style={{ padding: "32px 16px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Find a Dealer</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
        Search by region, dealer type, or industry. Click a marker for details.
      </p>

      {dealers.length === 0 ? (
        <div className="locator-empty" style={{ marginTop: "2rem" }}>
          No dealers have been added yet. Admins can add them from{" "}
          <a href="/admin/locator-dealers">/admin/locator-dealers</a>.
        </div>
      ) : (
        <DealerLocator
          dealers={dealers}
          filterOptions={filterOptions}
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
        />
      )}
    </div>
  );
}
