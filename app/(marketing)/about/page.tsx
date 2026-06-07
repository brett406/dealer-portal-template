import { Metadata } from "next";
import Image from "next/image";
import { getPageContent, getSiteSettings } from "@/lib/cms";
import { getTheme } from "@/lib/theme";
import { SafeHtml } from "@/components/cms/SafeHtml";
import { EditableField } from "@/components/cms/EditableField";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const brand = settings?.siteTitle ?? getTheme().brand.name;
  return {
    title: `About — ${brand}`,
    description: settings?.siteDescription ?? undefined,
    alternates: { canonical: "/about" },
    openGraph: { title: `About — ${brand}`, url: "/about" },
  };
}

export default async function AboutPage() {
  const page = await getPageContent("about");
  const p = (page?.payload ?? {}) as Record<string, string>;

  return (
    <div className="about-page">
      {p.heroImage && (
        <div className="about-hero">
          <Image
            src={p.heroImage}
            alt={p.title || "About us"}
            className="about-hero-img"
            width={1200}
            height={575}
            priority
            sizes="(max-width: 900px) 100vw, 900px"
          />
        </div>
      )}
      <EditableField pageKey="about" fieldKey="title" type="text" value={p.title}>
        <h1>{p.title || "About Us"}</h1>
      </EditableField>
      <div className="about-body">
        <EditableField pageKey="about" fieldKey="body" type="richtext" value={p.body}>
          {p.body ? (
            <SafeHtml html={p.body} />
          ) : (
            <p>Tell your company&apos;s story here. Edit this content from Admin → Pages → About.</p>
          )}
        </EditableField>
      </div>
    </div>
  );
}
