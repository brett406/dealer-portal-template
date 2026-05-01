import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDealerSettings } from "@/lib/settings";
import { getPageContent, getSiteSettings } from "@/lib/cms";
import { getTheme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { CategoryTagFilter } from "./category-tag-filter";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSiteSettings(), getPageContent("products")]);
  const brand = settings?.siteTitle ?? getTheme().brand.name;
  const p = (page?.payload ?? {}) as Record<string, string>;
  const title = `${p.title || "Product Catalog"} — ${brand}`;
  const description = p.description || settings?.siteDescription || undefined;

  return {
    title,
    description,
    alternates: { canonical: "/products" },
    openGraph: { title, description, url: "/products" },
  };
}

export default async function PublicProductsPage() {
  const settings = await getDealerSettings();
  const page = await getPageContent("products");
  const p = (page?.payload ?? {}) as Record<string, string>;

  if (!settings.showProductsToPublic) {
    return (
      <div className="public-login-prompt">
        <h1>{p.title || "Product Catalog"}</h1>
        <p>Please log in to browse our product catalog.</p>
        <Button href="/auth/login" style={{ marginTop: "1rem" }}>Login</Button>
      </div>
    );
  }

  const categories = await prisma.productCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: { where: { active: true } } } },
    },
  });

  const tagSet = new Set<string>();
  for (const c of categories) {
    for (const t of c.tags) tagSet.add(t);
  }
  const tags = [...tagSet].sort();

  const cards = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: c._count.products,
    tags: c.tags,
  }));

  return (
    <div className="container public-catalog">
      <h1>{p.title || "Product Catalog"}</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        {p.description || "Browse our full product line."}
      </p>

      <CategoryTagFilter categories={cards} availableTags={tags} />
    </div>
  );
}
