import { getSiteSettings } from "@/lib/cms";
import { getTheme } from "@/lib/theme";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_URL || "http://localhost:3000";

export async function StructuredData() {
  const settings = await getSiteSettings();
  const theme = getTheme();
  const brand = settings?.siteTitle ?? theme.brand.name;
  const description = settings?.defaultSeoDescription ?? settings?.siteDescription ?? undefined;
  const logoUrl = `${SITE_URL}${theme.brand.logo}`;

  const organizationSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand,
    url: SITE_URL,
    logo: logoUrl,
    sameAs: [],
  };
  if (description) organizationSchema.description = description;
  if (settings?.contactEmail || settings?.contactPhone) {
    const contactPoint: Record<string, unknown> = {
      "@type": "ContactPoint",
      contactType: "sales",
    };
    if (settings.contactPhone) contactPoint.telephone = settings.contactPhone;
    if (settings.contactEmail) contactPoint.email = settings.contactEmail;
    organizationSchema.contactPoint = contactPoint;
  }

  const localBusinessSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WholesaleStore",
    name: brand,
    url: SITE_URL,
    logo: logoUrl,
    image: logoUrl,
    priceRange: "$$",
  };
  if (description) localBusinessSchema.description = description;
  if (settings?.contactPhone) localBusinessSchema.telephone = settings.contactPhone;
  if (settings?.contactEmail) localBusinessSchema.email = settings.contactEmail;
  if (settings?.contactAddress) {
    localBusinessSchema.address = {
      "@type": "PostalAddress",
      streetAddress: settings.contactAddress,
    };
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
    </>
  );
}
