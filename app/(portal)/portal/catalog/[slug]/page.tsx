import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCustomerPricing } from "../actions";
import { ProductDetailClient } from "@/components/portal/ProductDetailClient";
import "@/app/(portal)/portal/catalog/catalog.css";

export const dynamic = "force-dynamic";

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
        accessories: {
          orderBy: { sortOrder: "asc" },
          include: {
            accessory: {
              select: {
                id: true,
                name: true,
                slug: true,
                active: true,
                madeToOrder: true,
                category: { select: { name: true } },
                variants: { where: { active: true }, take: 1, orderBy: { sortOrder: "asc" }, select: { id: true, baseRetailPrice: true, stockQuantity: true } },
                unitsOfMeasure: { take: 1, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, conversionFactor: true, priceOverride: true } },
                images: { where: { isPrimary: true }, take: 1, select: { url: true } },
              },
            },
          },
        },
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

  const accessoryProducts = product.accessories
    .filter((a) => a.accessory?.active && a.accessory.variants.length > 0)
    .map((a) => {
      const acc = a.accessory;
      const v = acc.variants[0];
      const u = acc.unitsOfMeasure[0];
      return {
        id: acc.id,
        name: acc.name,
        slug: acc.slug,
        categoryName: acc.category.name,
        primaryImageUrl: acc.images[0]?.url ?? null,
        madeToOrder: acc.madeToOrder,
        baseRetailPrice: Number(v.baseRetailPrice),
        defaultVariantId: v.id,
        defaultUomId: u?.id ?? null,
        stockQuantity: v.stockQuantity,
      };
    });

  return (
    <ProductDetailClient
      product={{
        id: product.id,
        name: product.name,
        description: product.description,
        categoryName: product.category.name,
        minOrderQuantity: product.minOrderQuantity,
        madeToOrder: product.madeToOrder,
        tags: product.tags,
      }}
      variants={variants}
      uoms={uoms}
      images={images}
      discountPercent={pricing?.discountPercent ?? 0}
      priceLevelName={pricing?.priceLevelName ?? "Retail"}
      accessories={accessoryProducts}
    />
  );
}
