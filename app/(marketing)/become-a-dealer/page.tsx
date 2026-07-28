import { Metadata } from "next";
import { getPageContent, getSiteSettings } from "@/lib/cms";
import { getTheme } from "@/lib/theme";
import { prisma } from "@/lib/prisma";
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

  // Ask about the products this portal actually sells. These used to be
  // hardcoded to one customer's catalogue, so every other portal asked its
  // dealers about products it doesn't carry.
  const categories = await prisma.productCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true },
  });

  const businessTypes = (p.businessTypes ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="dealer-page">
      <h1>{p.title || "Become a Dealer"}</h1>
      <p>
        {p.description || "Thank you for your interest in becoming a wholesale partner. Please complete the form below and our team will be in touch."}
      </p>
      <DealerForm
        productCategories={categories.map((c) => c.name)}
        businessTypes={businessTypes}
      />
    </div>
  );
}
