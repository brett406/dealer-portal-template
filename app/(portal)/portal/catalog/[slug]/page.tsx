import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCustomerPricing } from "../actions";
import { ProductDetailClient } from "@/components/portal/ProductDetailClient";
import "@/app/(portal)/portal/catalog/catalog.css";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [product, pricing] = await Promise.all([
    prisma.product.findUnique({
      where: { slug, active: true },
      include: {
        category: { select: { name: true } },
        variants: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
        },
        unitsOfMeasure: { orderBy: { sortOrder: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    }),
    getCustomerPricing(),
  ]);

  if (!product) notFound();

  const variants = product.variants.map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    baseRetailPrice: Number(v.baseRetailPrice),
    stockQuantity: v.stockQuantity,
    lowStockThreshold: v.lowStockThreshold,
  }));

  const uoms = product.unitsOfMeasure.map((u) => ({
    id: u.id,
    name: u.name,
    conversionFactor: u.conversionFactor,
    priceOverride: u.priceOverride !== null ? Number(u.priceOverride) : null,
  }));

  const images = product.images.map((img) => ({
    id: img.id,
    url: img.url,
    altText: img.altText,
    isPrimary: img.isPrimary,
  }));

  return (
    <ProductDetailClient
      product={{
        id: product.id,
        name: product.name,
        description: product.description,
        categoryName: product.category.name,
        minOrderQuantity: product.minOrderQuantity,
      }}
      variants={variants}
      uoms={uoms}
      images={images}
      discountPercent={pricing?.discountPercent ?? 0}
      priceLevelName={pricing?.priceLevelName ?? "Retail"}
    />
  );
}
