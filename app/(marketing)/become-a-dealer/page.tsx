import { DealerForm } from "./dealer-form";

export const metadata = {
  title: "Become a Dealer — Bauman Custom Products",
  description:
    "Apply to become a BCP dealer. Access wholesale pricing on farm, stable, and landscape tools from Scenic Road, ScrapeRake, and StableScraper.",
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
