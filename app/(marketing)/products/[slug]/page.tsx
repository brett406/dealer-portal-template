import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDealerSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/pricing";
import { Button } from "@/components/ui/Button";
import "@/app/(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug, active: true },
    select: { name: true, description: true },
  });

  if (!product) return { title: "Product Not Found" };

  return {
    title: product.name,
    description: product.description?.substring(0, 160) || `${product.name} — available for wholesale ordering.`,
  };
}

export default async function PublicProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const settings = await getDealerSettings();

  const product = await prisma.product.findUnique({
    where: { slug, active: true },
    include: {
      category: { select: { name: true } },
      variants: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!product) notFound();

  return (
    <div className="container" style={{ padding: "32px 16px", maxWidth: "900px", margin: "0 auto" }}>
      <Link href="/products" style={{ fontSize: "13px", color: "var(--color-primary)", textDecoration: "none" }}>
        &larr; Back to Products
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginTop: "24px" }}>
        {/* Images */}
        <div>
          {product.images.length > 0 ? (
            <img
              src={product.images[0].url}
              alt={product.name}
              style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: "var(--radius-lg)", background: "var(--color-surface)" }}
            />
          ) : (
            <div style={{ width: "100%", aspectRatio: "4/3", background: "var(--color-surface)", borderRadius: "var(--radius-lg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: "14px" }}>
              No image available
            </div>
          )}
          {product.images.length > 1 && (
            <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
              {product.images.slice(1).map((img) => (
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.altText ?? ""}
                  style={{ width: "64px", height: "64px", objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                />
              ))}
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
