import { Metadata } from "next";
import { getPageContent, getSiteSettings } from "@/lib/cms";
import { getTheme } from "@/lib/theme";
import { DealerForm } from "./dealer-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const brand = settings?.siteTitle ?? getTheme().brand.name;
  return {
    title: `Become a Dealer — ${brand}`,
    description: settings?.siteDescription ?? undefined,
    alternates: { canonical: "/become-a-dealer" },
    openGraph: { title: `Become a Dealer — ${brand}`, url: "/become-a-dealer" },
  };
}

export default async function BecomeADealerPage() {
  const page = await getPageContent("become-a-dealer");
  const p = (page?.payload ?? {}) as Record<string, string>;

  return (
    <div className="dealer-page">
      <h1>{p.title || "Become a Dealer"}</h1>
      <p>
        {p.description || "Thank you for your interest in becoming a wholesale partner. Please complete the form below and our team will be in touch."}
      </p>
      <DealerForm />
    </div>
  );
}
