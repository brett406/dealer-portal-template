import { Metadata } from "next";
import Image from "next/image";
import { getPageContent } from "@/lib/cms";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About BCP — Wholesale Farm, Stable & Landscape Tools | Canadian Dealer Programs",
  description:
    "Bauman Custom Products (BCP) is a Canadian wholesale distributor of farm tools, stable equipment, and landscape supplies. We partner with retailers across Canada offering competitive pricing, consistent inventory, and trusted brands like Scenic Road and ScrapeRake.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About BCP — Wholesale Farm, Stable & Landscape Tools | Canadian Dealer Programs",
    description:
      "Bauman Custom Products (BCP) is a Canadian wholesale distributor of farm tools, stable equipment, and landscape supplies. Dealer programs with competitive pricing and trusted brands.",
    url: "/about",
  },
};

export default async function AboutPage() {
  const page = await getPageContent("about");
  const p = page?.payload ?? {};

  return (
    <div className="about-page">
      <div className="about-hero">
        <Image src="/uploads/about-header.jpg" alt="Bauman Custom Products — Canadian wholesale farm and stable tools" className="about-hero-img" width={1200} height={575} priority sizes="(max-width: 900px) 100vw, 900px" />
      </div>
      <h1>{(p.title as string) || "Wholesale Farm, Stable & Landscape Tools for Canadian Dealers"}</h1>
      <div className="about-body">
        {(p.body as string) || (
          <>
            <p>
              Bauman Custom Products (BCP) is a Canadian wholesale distributor specializing in
              farm tools, stable equipment, and landscape supplies built for the demands of modern
              agriculture. Based in Ontario and serving retailers from coast to coast, we provide
              dealer programs that are easy to stock, competitively priced, and backed by brands
              your customers already know.
            </p>

            <p>
              Our product lineup includes heavy-duty wheelbarrows, manure and hay forks, barn
              scrapers, stable rakes, push brooms, and water management systems — all engineered
              for agricultural, equine, and commercial landscaping environments. Every product we
              distribute is selected for durability, daily-use performance, and proven demand at
              the retail level.
            </p>

            <h2>Why dealers choose BCP</h2>

            <p>
              We keep inventory moving. Our dealer programs are designed around consistent product
              availability, competitive wholesale pricing, and reliable fulfillment so you&apos;re
              never left explaining an empty shelf to your customers. Whether you run a farm supply
              store, a co-op, an equine tack shop, or a rural hardware outlet, we build supply
              partnerships that work long-term.
            </p>

            <p>
              Our brands — including Scenic Road, ScrapeRake, StableScraper, and HogFlo — are
              recognized across Canadian agriculture for quality and value. We&apos;re actively
              expanding our dealer network across every province and welcome new retail partners
              looking to add dependable tool programs to their stores.
            </p>

            <p>
              If you&apos;re a retailer looking for a wholesale supplier of agricultural tools,
              stable equipment, or landscape products in Canada, we&apos;d welcome the opportunity
              to work together.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
