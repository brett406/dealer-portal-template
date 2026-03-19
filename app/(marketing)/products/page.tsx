import Link from "next/link";
import NextImage from "next/image";
import { prisma } from "@/lib/prisma";
import { getDealerSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/pricing";
import { Button } from "@/components/ui/Button";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

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

  const products = await prisma.product.findMany({
    where: { active: true, category: { active: true } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      category: { select: { name: true } },
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
      <h1>Product Catalog</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        Browse our full range of products.
        {!settings.showPricesToPublic && " Log in for pricing and ordering."}
      </p>

      <div className="public-catalog-grid">
        {products.map((p) => {
          const prices = p.variants.map((v) => Number(v.baseRetailPrice));
          const minPrice = prices.length > 0 ? Math.min(...prices) : null;
          const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

          return (
            <Link key={p.id} href={`/products/${p.slug}`} className="public-product-card" style={{ textDecoration: "none", color: "inherit" }}>
              {p.images[0] ? (
                <NextImage src={p.images[0].url} alt={p.name} width={300} height={180} style={{ width: "100%", height: "180px", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "180px", background: "var(--color-bg, #f1f5f9)" }} />
              )}
              <div className="card-body">
                <div className="card-category">{p.category.name}</div>
                <div className="card-name">{p.name}</div>
                {settings.showPricesToPublic && minPrice !== null ? (
                  <div className="card-price">
                    {minPrice === maxPrice
                      ? formatPrice(minPrice)
                      : `From ${formatPrice(minPrice)}`}
                  </div>
                ) : !settings.showPricesToPublic ? (
                  <div className="card-price" style={{ color: "var(--color-text-muted)" }}>
                    <Link href="/auth/login" style={{ color: "var(--color-primary)", textDecoration: "none" }}>
                      Login for pricing
                    </Link>
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
