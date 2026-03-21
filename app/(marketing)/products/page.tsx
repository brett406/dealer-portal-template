import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDealerSettings } from "@/lib/settings";
import { Button } from "@/components/ui/Button";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wholesale Farm & Stable Tools — Product Categories",
  description:
    "Browse our wholesale farm, stable, and landscape tool catalog. Barn forks, brooms, shovels, scrapers, wheelbarrows, and more from Scenic Road, ScrapeRake, and StableScraper.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "Wholesale Farm & Stable Tools — Product Categories",
    description:
      "Browse our wholesale farm, stable, and landscape tool catalog by category.",
    url: "/products",
  },
};

export default async function PublicProductsPage() {
  const settings = await getDealerSettings();

  if (!settings.showProductsToPublic) {
    return (
      <div className="public-login-prompt">
        <h1>Product Catalog</h1>
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
      <h1>Product Catalog</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        Browse our full range of farm, stable, and landscape tools.
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
