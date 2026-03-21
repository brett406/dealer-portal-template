import { Metadata } from "next";
import { getPageContent } from "@/lib/cms";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About BCP — Canadian Wholesale Farm Tool Distributor",
  description:
    "BCP (Bauman Custom Products) is a Canadian wholesale distributor of farm, stable, and landscape tool programs for retailers across Canada.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About BCP — Canadian Wholesale Farm Tool Distributor",
    description:
      "BCP (Bauman Custom Products) is a Canadian wholesale distributor of farm, stable, and landscape tool programs for retailers across Canada.",
    url: "/about",
  },
};

export default async function AboutPage() {
  const page = await getPageContent("about");
  const p = page?.payload ?? {};

  return (
    <div className="about-page">
      <h1>{(p.title as string) || "About Us"}</h1>
      <div className="about-body">
        {(p.body as string) || (
          <p>
            We are a trusted wholesale supplier with decades of experience
            serving dealers and distributors across the region. Our commitment
            to quality products and reliable service sets us apart.
          </p>
        )}
      </div>
    </div>
  );
}
