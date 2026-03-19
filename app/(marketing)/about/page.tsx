import { getPageContent } from "@/lib/cms";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

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
