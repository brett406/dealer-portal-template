import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDealerSettings } from "@/lib/settings";
import { getPageContent, getSiteSettings } from "@/lib/cms";
import { getTheme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
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

  return (
    <div className="container public-catalog">
      <h1>{p.title || "Product Catalog"}</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        {p.description || "Browse our full product line."}
      </p>

      <div className="public-catalog-grid">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/products/${cat.slug}`}
            className="public-category-card"
          >
            <div className="category-card-body">
              <div className="category-card-name">{cat.name}</div>
              <div className="category-card-count">
                {cat._count.products} {cat._count.products === 1 ? "product" : "products"}
              </div>
            </div>
            <div className="category-card-arrow">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7 4L13 10L7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
