import { Metadata } from "next";
import { DealerForm } from "./dealer-form";

export const metadata: Metadata = {
  title: "Become a BCP Dealer — Wholesale Farm Tool Partnership",
  description:
    "Apply to become a Bauman Custom Products dealer. Wholesale pricing on farm, stable, and landscape tools. Scenic Road, ScrapeRake, and StableScraper brands for Canadian retailers.",
  alternates: { canonical: "/become-a-dealer" },
  openGraph: {
    title: "Become a BCP Dealer — Wholesale Farm Tool Partnership",
    description:
      "Apply to become a Bauman Custom Products dealer. Wholesale pricing on farm, stable, and landscape tools. Scenic Road, ScrapeRake, and StableScraper brands for Canadian retailers.",
    url: "/become-a-dealer",
  },
};

export default function BecomeADealerPage() {
  return (
    <div className="dealer-page">
      <h1>Become a BCP Dealer</h1>
      <p>
        Thank you for your interest in becoming a BCP wholesale partner.
        Please complete the form below and our team will contact you shortly.
      </p>
      <DealerForm />
    </div>
  );
}
