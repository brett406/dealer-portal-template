import { Metadata } from "next";
import { getSiteSettings, getPageContent } from "@/lib/cms";
import { getTheme } from "@/lib/theme";
import { ContactForm } from "./contact-form";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const brand = settings?.siteTitle ?? getTheme().brand.name;
  return {
    title: `Contact — ${brand}`,
    description: settings?.siteDescription ?? undefined,
    alternates: { canonical: "/contact" },
    openGraph: { title: `Contact — ${brand}`, url: "/contact" },
  };
}

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const page = await getPageContent("contact");
  const p = (page?.payload ?? {}) as Record<string, string>;

  return (
    <div className="contact-page">
      <h1>{p.title || "Contact Us"}</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        {p.subtitle || "Have questions? We'd love to hear from you."}
      </p>

      <div className="contact-grid">
        <div className="contact-info">
          <h3>{p.infoHeading || "Get in Touch"}</h3>
          {settings?.contactEmail && (
            <p>
              <strong>Email:</strong>{" "}
              <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
            </p>
          )}
          {settings?.contactPhone && (
            <p><strong>Phone:</strong> {settings.contactPhone}</p>
          )}
          {settings?.contactAddress && (
            <p><strong>Address:</strong> {settings.contactAddress}</p>
          )}

          {p.mapEmbedUrl && (
            <div className="contact-map">
              <iframe
                src={p.mapEmbedUrl}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`${settings?.siteTitle ?? "Location"}`}
              />
            </div>
          )}
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
