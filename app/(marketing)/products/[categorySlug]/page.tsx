import { notFound } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
import { prisma } from "@/lib/prisma";
import { getDealerSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/pricing";
import { Button } from "@/components/ui/Button";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ categorySlug: string }> }) {
  const { categorySlug } = await params;
  const category = await prisma.productCategory.findUnique({
    where: { slug: categorySlug, active: true },
    select: { name: true },
  });

  if (!category) return { title: "Category Not Found" };

  return {
    title: category.name,
    description: `Browse our wholesale ${category.name.toLowerCase()} catalog.`,
  };
}

export default async function CategoryProductsPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;
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

  const category = await prisma.productCategory.findUnique({
    where: { slug: categorySlug, active: true },
    select: { id: true, name: true, slug: true },
  });

  if (!category) notFound();

  const products = await prisma.product.findMany({
    where: { categoryId: category.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      variants: {
        where: { active: true },
        select: { baseRetailPrice: true },
        orderBy: { baseRetailPrice: "asc" },
      },
      images: {
        where: { isPrimary: true },
        select: { url: true },
        take: 1,
      },
    },
  });

  return (
    <div className="container public-catalog">
      <div className="public-catalog-breadcrumb">
        <Link href="/products">Products</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{category.name}</span>
      </div>

      <h1>{category.name}</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        {products.length} {products.length === 1 ? "product" : "products"}
        {!settings.showPricesToPublic && " — Log in for pricing and ordering."}
      </p>

      <div className="public-catalog-grid">
        {products.map((p) => {
          const prices = p.variants.map((v) => Number(v.baseRetailPrice));
          const minPrice = prices.length > 0 ? Math.min(...prices) : null;
          const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

          return (
            <Link
              key={p.id}
              href={`/products/${category.slug}/${p.slug}`}
              className="public-product-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {p.images[0] ? (
                <NextImage
                  src={p.images[0].url}
                  alt={p.name}
                  width={300}
                  height={180}
                  style={{ width: "100%", height: "180px", objectFit: "cover" }}
                />
              ) : (
                <div style={{ width: "100%", height: "180px", background: "var(--color-bg, #f1f5f9)" }} />
              )}
              <div className="card-body">
                <div className="card-name">{p.name}</div>
                {settings.showPricesToPublic && minPrice !== null ? (
                  <div className="card-price">
                    {minPrice === maxPrice
                      ? formatPrice(minPrice)
                      : `From ${formatPrice(minPrice)}`}
                  </div>
                ) : !settings.showPricesToPublic ? (
                  <div className="card-price" style={{ color: "var(--color-text-muted)" }}>
                    Login for pricing
                  </div>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
