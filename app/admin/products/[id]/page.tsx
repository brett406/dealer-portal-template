import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateProduct } from "../actions";
import { ProductBasicForm } from "../product-basic-form";
import { VariantSection } from "../variant-section";
import { UOMSection } from "../uom-section";
import { ImageSection } from "../image-section";
import { AccessorySection } from "../accessory-section";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories, priceLevels] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { sortOrder: "asc" } },
        unitsOfMeasure: { orderBy: { sortOrder: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
        accessories: {
          orderBy: { sortOrder: "asc" },
          include: {
            accessory: {
              select: {
                id: true,
                name: true,
                variants: { take: 1, orderBy: { sortOrder: "asc" }, select: { sku: true } },
                images: { where: { isPrimary: true }, take: 1, select: { url: true } },
              },
            },
          },
        },
      },
    }),
    prisma.productCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.priceLevel.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, discountPercent: true },
    }),
  ]);

  if (!product) notFound();

  const boundUpdate = updateProduct.bind(null, id);

  const variantData = product.variants.map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    baseRetailPrice: Number(v.baseRetailPrice),
    stockQuantity: v.stockQuantity,
    lowStockThreshold: v.lowStockThreshold,
    active: v.active,
    sortOrder: v.sortOrder,
  }));

  const uomData = product.unitsOfMeasure.map((u) => ({
    id: u.id,
    name: u.name,
    conversionFactor: u.conversionFactor,
    priceOverride: u.priceOverride !== null ? Number(u.priceOverride) : null,
    sortOrder: u.sortOrder,
  }));

  const imageData = product.images.map((img) => ({
    id: img.id,
    url: img.url,
    altText: img.altText,
    isPrimary: img.isPrimary,
    sortOrder: img.sortOrder,
  }));

  const priceLevelData = priceLevels.map((pl) => ({
    id: pl.id,
    name: pl.name,
    discountPercent: Number(pl.discountPercent),
  }));

  return (
    <div>
      <h1>Edit Product</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        {product.name}
      </p>

      <div className="prod-edit-section">
        <h2>Basic Information</h2>
        <ProductBasicForm
          action={boundUpdate}
          categories={categories}
          defaultValues={{
            name: product.name,
            slug: product.slug,
            categoryId: product.categoryId,
            description: product.description ?? undefined,
            minOrderQuantity: product.minOrderQuantity,
            madeToOrder: product.madeToOrder,
            tags: product.tags,
            sortOrder: product.sortOrder,
            active: product.active,
          }}
          submitLabel="Save Changes"
          cancelHref="/admin/products"
        />
      </div>

      <VariantSection
        productId={id}
        variants={variantData}
        priceLevels={priceLevelData}
      />

      <UOMSection
        productId={id}
        uoms={uomData}
        baseRetailPrice={variantData[0]?.baseRetailPrice ?? 0}
      />

      <ImageSection
        productId={id}
        images={imageData}
      />

      <AccessorySection
        productId={id}
        accessories={product.accessories.map((a) => ({
          id: a.id,
          accessoryId: a.accessory.id,
          name: a.accessory.name,
          sku: a.accessory.variants[0]?.sku ?? "—",
          imageUrl: a.accessory.images[0]?.url ?? null,
        }))}
      />
    </div>
  );
}
