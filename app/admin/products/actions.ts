"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { invalidateCache } from "@/lib/cache";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// generateSlug moved to lib/slug.ts — import from there in client components

function productPath(id: string) {
  return `/admin/products/${id}`;
}

function invalidateProductCaches(productId?: string) {
  invalidateCache("products:");
  invalidateCache("customer-pricing");
  if (productId) {
    invalidateCache(`pricing:${productId}`);
  } else {
    invalidateCache("pricing:");
  }
}

function extractErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type FormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or less"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
  categoryId: z.string().min(1, "Category is required"),
  description: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => v || undefined),
  minOrderQuantity: z
    .union([
      z.literal("").transform(() => null),
      z.literal(null).transform(() => null),
      z.number({ coerce: true }).int().min(1, "Minimum order quantity must be at least 1"),
    ])
    .optional()
    .default(null),
  sortOrder: z.number({ coerce: true }).int().optional().default(0),
  active: z.boolean().optional().default(true),
});

const variantSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  sku: z.string().min(1, "SKU is required").max(50),
  baseRetailPrice: z.number({ coerce: true }).min(0, "Price must be 0 or greater"),
  stockQuantity: z.number({ coerce: true }).int().min(0, "Stock must be 0 or greater"),
  lowStockThreshold: z.number({ coerce: true }).int().min(0).optional().default(5),
  active: z.boolean().optional().default(true),
});

const uomSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  conversionFactor: z.number({ coerce: true }).int().min(1, "Conversion factor must be at least 1"),
  priceOverride: z
    .union([
      z.literal("").transform(() => null),
      z.number({ coerce: true }).min(0, "Price override must be 0 or greater"),
    ])
    .optional()
    .default(null),
  sortOrder: z.number({ coerce: true }).int().optional().default(0),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Product CRUD
// ═══════════════════════════════════════════════════════════════════════════════

export async function createProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    minOrderQuantity: formData.get("minOrderQuantity"),
    sortOrder: formData.get("sortOrder"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const existing = await prisma.product.findFirst({
    where: { slug: parsed.data.slug },
  });
  if (existing) return { errors: { slug: "A product with this slug already exists" } };

  const product = await prisma.product.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      minOrderQuantity: parsed.data.minOrderQuantity,
      sortOrder: parsed.data.sortOrder,
      active: parsed.data.active,
    },
  });

  // Auto-create default "Each" UOM
  await prisma.productUOM.create({
    data: {
      productId: product.id,
      name: "Each",
      conversionFactor: 1,
      sortOrder: 0,
    },
  });

  invalidateProductCaches();
  redirect(productPath(product.id));
}

export async function updateProduct(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    minOrderQuantity: formData.get("minOrderQuantity"),
    sortOrder: formData.get("sortOrder"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const existing = await prisma.product.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (existing) return { errors: { slug: "A product with this slug already exists" } };

  await prisma.product.update({
    where: { id },
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      minOrderQuantity: parsed.data.minOrderQuantity,
      sortOrder: parsed.data.sortOrder,
      active: parsed.data.active,
    },
  });

  revalidatePath(productPath(id));
  invalidateProductCaches();
  return { success: true };
}

export async function toggleProductActive(id: string): Promise<FormState> {
  await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return { error: "Product not found" };

  await prisma.product.update({
    where: { id },
    data: { active: !product.active },
  });

  invalidateProductCaches(id);
  revalidatePath("/admin/products");
  return {};
}

export async function deleteProduct(id: string): Promise<FormState> {
  await requireAdmin();

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { include: { _count: { select: { orderItems: true } } } },
      _count: { select: { variants: true, images: true, unitsOfMeasure: true } },
    },
  });

  if (!product) return { error: "Product not found" };

  const hasOrders = product.variants.some((v) => v._count.orderItems > 0);
  if (hasOrders) {
    return { error: "Cannot delete — this product has order history. Deactivate it instead." };
  }

  // Delete children, then product
  await prisma.productImage.deleteMany({ where: { productId: id } });
  await prisma.productUOM.deleteMany({ where: { productId: id } });
  await prisma.productVariant.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });

  revalidatePath("/admin/products");
  return {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Variant CRUD
// ═══════════════════════════════════════════════════════════════════════════════

export async function addVariant(
  productId: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = variantSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    baseRetailPrice: formData.get("baseRetailPrice"),
    stockQuantity: formData.get("stockQuantity"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    active: formData.has("active") ? formData.get("active") === "on" : true,
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const skuExists = await prisma.productVariant.findFirst({
    where: { sku: parsed.data.sku },
  });
  if (skuExists) return { errors: { sku: "A variant with this SKU already exists" } };

  await prisma.productVariant.create({
    data: {
      productId,
      name: parsed.data.name,
      sku: parsed.data.sku,
      baseRetailPrice: parsed.data.baseRetailPrice,
      stockQuantity: parsed.data.stockQuantity,
      lowStockThreshold: parsed.data.lowStockThreshold,
      active: parsed.data.active,
    },
  });

  invalidateProductCaches(productId);
  revalidatePath(productPath(productId));
  return { success: true };
}

export async function updateVariant(
  variantId: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = variantSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    baseRetailPrice: formData.get("baseRetailPrice"),
    stockQuantity: formData.get("stockQuantity"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    active: formData.has("active") ? formData.get("active") === "on" : true,
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const skuExists = await prisma.productVariant.findFirst({
    where: { sku: parsed.data.sku, NOT: { id: variantId } },
  });
  if (skuExists) return { errors: { sku: "A variant with this SKU already exists" } };

  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) return { error: "Variant not found" };

  await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      name: parsed.data.name,
      sku: parsed.data.sku,
      baseRetailPrice: parsed.data.baseRetailPrice,
      stockQuantity: parsed.data.stockQuantity,
      lowStockThreshold: parsed.data.lowStockThreshold,
      active: parsed.data.active,
    },
  });

  invalidateProductCaches(variant.productId);
  revalidatePath(productPath(variant.productId));
  return { success: true };
}

export async function deleteVariant(variantId: string): Promise<FormState> {
  await requireAdmin();

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      orderItems: { select: { order: { select: { status: true } } } },
      cartItems: { select: { id: true } },
    },
  });

  if (!variant) return { error: "Variant not found" };

  const activeStatuses = ["RECEIVED", "PROCESSING", "SHIPPED"];
  const hasActiveOrders = variant.orderItems.some((oi) =>
    activeStatuses.includes(oi.order.status),
  );
  if (hasActiveOrders) {
    return { error: "Cannot delete — this variant is in active orders" };
  }

  await prisma.productVariant.delete({ where: { id: variantId } });
  revalidatePath(productPath(variant.productId));
  return {};
}

export async function toggleVariantActive(variantId: string): Promise<FormState> {
  await requireAdmin();
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) return { error: "Variant not found" };

  await prisma.productVariant.update({
    where: { id: variantId },
    data: { active: !variant.active },
  });

  revalidatePath(productPath(variant.productId));
  return {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// UOM CRUD
// ═══════════════════════════════════════════════════════════════════════════════

export async function addUOM(
  productId: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = uomSchema.safeParse({
    name: formData.get("name"),
    conversionFactor: formData.get("conversionFactor"),
    priceOverride: formData.get("priceOverride"),
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  await prisma.productUOM.create({
    data: {
      productId,
      name: parsed.data.name,
      conversionFactor: parsed.data.conversionFactor,
      priceOverride: parsed.data.priceOverride,
      sortOrder: parsed.data.sortOrder,
    },
  });

  invalidateProductCaches(productId);
  revalidatePath(productPath(productId));
  return { success: true };
}

export async function updateUOM(
  uomId: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = uomSchema.safeParse({
    name: formData.get("name"),
    conversionFactor: formData.get("conversionFactor"),
    priceOverride: formData.get("priceOverride"),
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const uom = await prisma.productUOM.findUnique({ where: { id: uomId } });
  if (!uom) return { error: "UOM not found" };

  await prisma.productUOM.update({
    where: { id: uomId },
    data: {
      name: parsed.data.name,
      conversionFactor: parsed.data.conversionFactor,
      priceOverride: parsed.data.priceOverride,
      sortOrder: parsed.data.sortOrder,
    },
  });

  invalidateProductCaches(uom.productId);
  revalidatePath(productPath(uom.productId));
  return { success: true };
}

export async function deleteUOM(uomId: string): Promise<FormState> {
  await requireAdmin();

  const uom = await prisma.productUOM.findUnique({
    where: { id: uomId },
    include: { cartItems: { select: { id: true } } },
  });

  if (!uom) return { error: "UOM not found" };

  if (uom.cartItems.length > 0) {
    return { error: "Cannot delete — this UOM is in active carts" };
  }

  await prisma.productUOM.delete({ where: { id: uomId } });
  revalidatePath(productPath(uom.productId));
  return {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Image management
// ═══════════════════════════════════════════════════════════════════════════════

export async function addProductImage(
  productId: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const url = formData.get("url") as string;
  const altText = (formData.get("altText") as string) || undefined;

  if (!url) return { error: "Image URL is required" };

  // Check if this is the first image (auto-set as primary)
  const imageCount = await prisma.productImage.count({ where: { productId } });

  await prisma.productImage.create({
    data: {
      productId,
      url,
      altText,
      isPrimary: imageCount === 0,
      sortOrder: imageCount,
    },
  });

  revalidatePath(productPath(productId));
  return { success: true };
}

export async function deleteProductImage(imageId: string): Promise<FormState> {
  await requireAdmin();

  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) return { error: "Image not found" };

  await prisma.productImage.delete({ where: { id: imageId } });

  // Delete the file from disk
  try {
    const { deleteUpload } = await import("@/lib/uploads");
    const filename = image.url.split("/").pop();
    if (filename) await deleteUpload(filename);
  } catch {
    // File deletion is best-effort
  }

  // If it was primary, set the next image as primary
  if (image.isPrimary) {
    const nextImage = await prisma.productImage.findFirst({
      where: { productId: image.productId },
      orderBy: { sortOrder: "asc" },
    });
    if (nextImage) {
      await prisma.productImage.update({
        where: { id: nextImage.id },
        data: { isPrimary: true },
      });
    }
  }

  revalidatePath(productPath(image.productId));
  return {};
}

export async function setPrimaryImage(imageId: string): Promise<FormState> {
  await requireAdmin();

  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) return { error: "Image not found" };

  await prisma.$transaction([
    prisma.productImage.updateMany({
      where: { productId: image.productId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    }),
  ]);

  revalidatePath(productPath(image.productId));
  return {};
}

export async function reorderImages(
  productId: string,
  imageIds: string[],
): Promise<FormState> {
  await requireAdmin();

  await prisma.$transaction(
    imageIds.map((id, index) =>
      prisma.productImage.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  revalidatePath(productPath(productId));
  return {};
}
