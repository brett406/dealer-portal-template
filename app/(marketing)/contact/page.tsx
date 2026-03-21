import { Metadata } from "next";
import { getSiteSettings } from "@/lib/cms";
import { ContactForm } from "./contact-form";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact BCP — Wholesale Farm Tool Inquiries",
  description:
    "Contact Bauman Custom Products for wholesale farm, stable, and landscape tool inquiries. Phone: 519.698.0717. Email: sales@bcpinc.ca. Ontario, Canada.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact BCP — Wholesale Farm Tool Inquiries",
    description:
      "Contact Bauman Custom Products for wholesale farm, stable, and landscape tool inquiries. Phone: 519.698.0717. Email: sales@bcpinc.ca. Ontario, Canada.",
    url: "/contact",
  },
};

export default async function ContactPage() {
  const settings = await getSiteSettings();

  return (
    <div className="contact-page">
      <h1>Contact Us</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        Have questions? We&apos;d love to hear from you.
      </p>

      <div className="contact-grid">
        <div className="contact-info">
          <h3>Get in Touch</h3>
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
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
