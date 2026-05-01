import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDealerSettings } from "@/lib/settings";
import { getSiteSettings } from "@/lib/cms";
import { getTheme } from "@/lib/theme";
import { formatPrice } from "@/lib/pricing";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/marketing/ImageLightbox";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_URL || "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorySlug: string; productSlug: string }>;
}) {
  const { categorySlug, productSlug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug: productSlug, active: true },
    select: { name: true, description: true },
  });

  if (!product) return { title: "Product Not Found" };

  const description = product.description?.substring(0, 160) || `${product.name} — available for wholesale ordering.`;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${categorySlug}/${productSlug}` },
    openGraph: {
      title: product.name,
      description,
      url: `/products/${categorySlug}/${productSlug}`,
    },
  };
}

export default async function PublicProductDetailPage({
  params,
}: {
  params: Promise<{ categorySlug: string; productSlug: string }>;
}) {
  const { categorySlug, productSlug } = await params;
  const settings = await getDealerSettings();

  const product = await prisma.product.findUnique({
    where: { slug: productSlug, active: true },
    include: {
      category: { select: { name: true, slug: true } },
      variants: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!product || product.category.slug !== categorySlug) notFound();

  const siteSettings = await getSiteSettings();
  const brand = siteSettings?.siteTitle ?? getTheme().brand.name;
  const productUrl = `${SITE_URL}/products/${product.category.slug}/${product.slug}`;
  const primaryImage = product.images[0]?.url;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: primaryImage ? `${SITE_URL}${primaryImage}` : undefined,
    brand: { "@type": "Brand", name: brand },
    url: productUrl,
    ...(product.variants.length > 0 && {
      offers: product.variants.map((v) => ({
        "@type": "Offer",
        sku: v.sku,
        name: v.name,
        availability: "https://schema.org/InStock",
        ...(settings.showPricesToPublic && { price: Number(v.baseRetailPrice) }),
      })),
    }),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Products", item: `${SITE_URL}/products` },
      { "@type": "ListItem", position: 2, name: product.category.name, item: `${SITE_URL}/products/${product.category.slug}` },
      { "@type": "ListItem", position: 3, name: product.name, item: productUrl },
    ],
  };

  return (
    <div className="container" style={{ padding: "32px 16px", maxWidth: "900px", margin: "0 auto" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div className="public-catalog-breadcrumb">
        <Link href="/products">Products</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href={`/products/${product.category.slug}`}>{product.category.name}</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{product.name}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginTop: "24px" }}>
        {/* Images */}
        <div>
          {product.images.length > 0 ? (
            <ImageLightbox
              images={product.images.map((img) => ({ url: img.url, alt: img.altText ?? product.name }))}
            />
          ) : (
            <div style={{ width: "100%", aspectRatio: "4/3", background: "var(--color-surface)", borderRadius: "var(--radius-lg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: "14px" }}>
              No image available
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-primary)", marginBottom: "4px" }}>
            {product.category.name}
          </div>
          <h1 style={{ fontSize: "24px", marginBottom: "12px" }}>{product.name}</h1>

          {product.description && (
            <p style={{ color: "var(--color-text-muted)", fontSize: "15px", lineHeight: 1.7, marginBottom: "24px" }}>
              {product.description}
            </p>
          )}

          {/* Variants & Pricing */}
          {product.variants.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              {product.variants.map((v) => (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "14px" }}>{v.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>SKU: {v.sku}</div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "15px" }}>
                    {settings.showPricesToPublic
                      ? formatPrice(Number(v.baseRetailPrice))
                      : <span style={{ color: "var(--color-text-muted)", fontWeight: 400, fontSize: "13px" }}>Login for pricing</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button href="/auth/login" size="lg" style={{ width: "100%" }}>
            Login to Order
          </Button>

          <p style={{ textAlign: "center", marginTop: "12px", fontSize: "13px", color: "var(--color-text-muted)" }}>
            Sign in or create an account to place orders.
          </p>
        </div>
      </div>
    </div>
  );
}
