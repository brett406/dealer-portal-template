"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { logAudit } from "@/lib/audit";
import { invalidateProductCaches } from "@/lib/cache-invalidation";
import { repriceAll, type RepriceTrigger } from "@/lib/bom/reprice";
import { validateBomGraph, SAVE_MAX_DEPTH, type EngineMaterial } from "@/lib/bom/cost";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// generateSlug moved to lib/slug.ts — import from there in client components
// invalidateProductCaches moved to lib/cache-invalidation.ts (shared with the admin API)

function productPath(id: string) {
  return `/admin/products/${id}`;
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
      z.coerce.number().int().min(1, "Minimum order quantity must be at least 1"),
    ])
    .optional()
    .default(null),
  madeToOrder: z.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().optional().default(0),
  active: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
});

// Nullable money input: an empty string (field left blank) becomes null;
// otherwise coerce to a non-negative number. Used for the optional USD prices.
const nullableMoney = (label: string) =>
  z
    .union([
      z.literal("").transform(() => null),
      z.coerce.number().min(0, `${label} must be 0 or greater`),
    ])
    .optional()
    .default(null);

const variantSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  sku: z.string().min(1, "SKU is required").max(50),
  baseRetailPrice: z.coerce.number().min(0, "Price must be 0 or greater"),
  baseRetailPriceUsd: nullableMoney("USD price"),
  stockQuantity: z.coerce.number().int().min(0, "Stock must be 0 or greater"),
  lowStockThreshold: z.coerce.number().int().min(0).optional().default(5),
  active: z.boolean().optional().default(true),
});

const uomSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  conversionFactor: z.coerce.number().int().min(1, "Conversion factor must be at least 1"),
  priceOverride: nullableMoney("Price override"),
  priceOverrideUsd: nullableMoney("USD price override"),
  sortOrder: z.coerce.number().int().optional().default(0),
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
    madeToOrder: formData.get("madeToOrder") === "on",
    sortOrder: formData.get("sortOrder"),
    active: formData.get("active") === "on",
    featured: formData.get("featured") === "on",
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const existing = await prisma.product.findFirst({
    where: { slug: parsed.data.slug },
  });
  if (existing) return { errors: { slug: "A product with this slug already exists" } };

  const tags = ((formData.get("tags") as string) ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const product = await prisma.product.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      minOrderQuantity: parsed.data.minOrderQuantity,
      madeToOrder: parsed.data.madeToOrder,
      tags,
      sortOrder: parsed.data.sortOrder,
      active: parsed.data.active,
      featured: parsed.data.featured,
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
    madeToOrder: formData.get("madeToOrder") === "on",
    sortOrder: formData.get("sortOrder"),
    active: formData.get("active") === "on",
    featured: formData.get("featured") === "on",
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const existing = await prisma.product.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (existing) return { errors: { slug: "A product with this slug already exists" } };

  const tags = ((formData.get("tags") as string) ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  await prisma.product.update({
    where: { id },
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      minOrderQuantity: parsed.data.minOrderQuantity,
      madeToOrder: parsed.data.madeToOrder,
      tags,
      sortOrder: parsed.data.sortOrder,
      active: parsed.data.active,
      featured: parsed.data.featured,
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

export async function toggleProductFeatured(id: string): Promise<FormState> {
  await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return { error: "Product not found" };

  await prisma.product.update({
    where: { id },
    data: { featured: !product.featured },
  });

  invalidateProductCaches(id);
  revalidatePath("/admin/products");
  revalidatePath("/");
  return {};
}

export async function deleteProduct(id: string): Promise<FormState> {
  const user = await requireAdmin();

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

  await logAudit({
    action: "DELETE_PRODUCT",
    userId: user.id,
    targetId: id,
    targetType: "Product",
    details: { name: product.name },
  });

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
  const user = await requireAdmin();

  const parsed = variantSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    baseRetailPrice: formData.get("baseRetailPrice"),
    baseRetailPriceUsd: formData.get("baseRetailPriceUsd") ?? "",
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
      baseRetailPriceUsd: parsed.data.baseRetailPriceUsd,
      stockQuantity: parsed.data.stockQuantity,
      lowStockThreshold: parsed.data.lowStockThreshold,
      active: parsed.data.active,
    },
  });

  // §13.6 — a new variant under an effective-priceFromBom product is repriced
  // immediately (it inherits the product BOM; null priceFromBom = inherit).
  let repriceError: string | null = null;
  if (await variantPriceIsBomLocked(null, productId)) {
    repriceError = await triggerReprice("BOM_UPDATE", user.id);
  }

  invalidateProductCaches(productId);
  revalidatePath(productPath(productId));
  if (repriceError) return { error: repriceError };
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
    baseRetailPriceUsd: formData.get("baseRetailPriceUsd") ?? "",
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

  // §5 guardrail — when the variant's effective priceFromBom is on (and the
  // global toggle is on), baseRetailPrice is owned by the BOM engine. Reject a
  // direct write; never write the field for such variants. Disabled inputs
  // don't submit, so an absent/blank field is fine.
  const priceLocked = await variantPriceIsBomLocked(variant.priceFromBom, variant.productId);
  if (priceLocked) {
    const rawPrice = formData.get("baseRetailPrice");
    const submitted = rawPrice !== null && String(rawPrice).trim() !== "";
    if (submitted && Math.abs(parsed.data.baseRetailPrice - Number(variant.baseRetailPrice)) > 0.005) {
      return {
        errors: {
          baseRetailPrice:
            "This variant's price is computed from its BOM — turn off price-from-BOM to set it manually",
        },
      };
    }
  }

  await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      name: parsed.data.name,
      sku: parsed.data.sku,
      ...(priceLocked ? {} : { baseRetailPrice: parsed.data.baseRetailPrice }),
      // USD price is a manual field independent of the BOM engine (BOM computes
      // only the CAD baseRetailPrice), so it is always writable.
      baseRetailPriceUsd: parsed.data.baseRetailPriceUsd,
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
    priceOverrideUsd: formData.get("priceOverrideUsd") ?? "",
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  await prisma.productUOM.create({
    data: {
      productId,
      name: parsed.data.name,
      conversionFactor: parsed.data.conversionFactor,
      priceOverride: parsed.data.priceOverride,
      priceOverrideUsd: parsed.data.priceOverrideUsd,
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
    priceOverrideUsd: formData.get("priceOverrideUsd") ?? "",
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
      priceOverrideUsd: parsed.data.priceOverrideUsd,
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

// ═══════════════════════════════════════════════════════════════════════════════
// Accessories
// ═══════════════════════════════════════════════════════════════════════════════

export async function searchProductsForAccessory(
  productId: string,
  query: string,
): Promise<{ id: string; name: string; sku: string; imageUrl: string | null }[]> {
  await requireAdmin();

  if (!query || query.trim().length < 2) return [];

  const existing = await prisma.productAccessory.findMany({
    where: { productId },
    select: { accessoryId: true },
  });
  const excludeIds = [productId, ...existing.map((e) => e.accessoryId)];

  const products = await prisma.product.findMany({
    where: {
      active: true,
      id: { notIn: excludeIds },
      OR: [
        { name: { contains: query.trim(), mode: "insensitive" } },
        { variants: { some: { sku: { contains: query.trim(), mode: "insensitive" } } } },
      ],
    },
    take: 10,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      variants: { take: 1, orderBy: { sortOrder: "asc" }, select: { sku: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
    },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.variants[0]?.sku ?? "—",
    imageUrl: p.images[0]?.url ?? null,
  }));
}

export async function addAccessory(
  productId: string,
  accessoryId: string,
): Promise<FormState> {
  await requireAdmin();

  const count = await prisma.productAccessory.count({ where: { productId } });

  await prisma.productAccessory.create({
    data: { productId, accessoryId, sortOrder: count },
  });

  revalidatePath(productPath(productId));
  return { success: true };
}

export async function removeAccessory(productAccessoryId: string): Promise<FormState> {
  await requireAdmin();

  const record = await prisma.productAccessory.findUnique({ where: { id: productAccessoryId } });
  if (!record) return { error: "Not found" };

  await prisma.productAccessory.delete({ where: { id: productAccessoryId } });

  revalidatePath(productPath(record.productId));
  return {};
}

export async function reorderAccessories(
  productId: string,
  orderedIds: string[],
): Promise<FormState> {
  await requireAdmin();

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.productAccessory.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  revalidatePath(productPath(productId));
  return {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOM costing (docs/BOM-COSTING.md §5–§7, §15–§16)
// ═══════════════════════════════════════════════════════════════════════════════

/** Exactly one of productId / productVariantId — the BOM line's parent (§3). */
type BomParentRef = { productId: string; productVariantId?: undefined } | { productVariantId: string; productId?: undefined };

const bomMarkupField = z
  .union([
    z.literal("").transform(() => null),
    z.literal(null).transform(() => null),
    z.coerce
      .number()
      .min(0, "Markup must be 0 or greater")
      .max(999.99, "Markup must be 999.99 or less"),
  ])
  .optional()
  .default(null)
  .transform((v) => (v === null ? null : Math.round(v * 100) / 100));

const bomNotesField = z
  .union([z.string().max(500, "Notes must be 500 characters or less"), z.null()])
  .optional()
  .default(null)
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));

const productBomPricingSchema = z.object({
  priceFromBom: z.boolean(),
  materialMarginPercent: bomMarkupField,
  laborMarginPercent: bomMarkupField,
});

const variantBomPricingSchema = z.object({
  // Tri-state (§6): null inherits the product's priceFromBom.
  priceFromBom: z.enum(["inherit", "on", "off"]),
  materialMarginPercent: bomMarkupField,
  laborMarginPercent: bomMarkupField,
});

const bomComponentSchema = z.object({
  materialId: z.string().min(1, "Material is required"),
  quantity: z.coerce
    .number()
    .gt(0, "Quantity must be greater than 0")
    .max(99999999.9999, "Quantity is too large")
    .transform((v) => Math.round(v * 10000) / 10000),
  notes: bomNotesField,
});

const bomLaborLineSchema = z.object({
  laborRateId: z.string().min(1, "Labor rate is required"),
  hours: z.coerce
    .number()
    .gt(0, "Hours must be greater than 0")
    .max(99999999.99, "Hours is too large")
    .transform((v) => Math.round(v * 100) / 100),
  notes: bomNotesField,
});

/** Null when enabled; the FormState error string when the module is off (§6). */
async function requireBomEnabled(): Promise<string | null> {
  const settings = await prisma.siteSetting.findFirst({
    select: { bomCostingEnabled: true },
  });
  return settings?.bomCostingEnabled ? null : "BOM costing is disabled";
}

/**
 * §5 read-only-price check: effective priceFromBom (variant ?? product) AND
 * the global toggle. Missing SiteSetting row = off (§14.2).
 */
async function variantPriceIsBomLocked(
  variantPriceFromBom: boolean | null,
  productId: string,
): Promise<boolean> {
  const settings = await prisma.siteSetting.findFirst({
    select: { bomCostingEnabled: true },
  });
  if (!settings?.bomCostingEnabled) return false;
  if (variantPriceFromBom !== null) return variantPriceFromBom;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { priceFromBom: true },
  });
  return product?.priceFromBom ?? false;
}

/**
 * Every cost-affecting mutation reprices afterwards (§5). The mutation itself
 * has already committed; a reprice failure is surfaced, not swallowed.
 */
async function triggerReprice(trigger: RepriceTrigger, userId: string): Promise<string | null> {
  try {
    await repriceAll({ trigger, userId });
    return null;
  } catch (err) {
    console.error("[BOM] reprice failed after admin edit:", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return `Saved, but repricing failed: ${message}`;
  }
}

/** Resolve + verify a BOM parent; returns the owning productId for revalidation/audit. */
async function resolveBomParent(parent: BomParentRef): Promise<
  | { error: string }
  | {
      where: { productId: string } | { productVariantId: string };
      productId: string;
      targetId: string;
      targetType: "Product" | "ProductVariant";
    }
> {
  if (parent.productId) {
    const product = await prisma.product.findUnique({
      where: { id: parent.productId },
      select: { id: true },
    });
    if (!product) return { error: "Product not found" };
    return {
      where: { productId: product.id },
      productId: product.id,
      targetId: product.id,
      targetType: "Product",
    };
  }
  if (!parent.productVariantId) return { error: "Invalid BOM parent" };
  const variant = await prisma.productVariant.findUnique({
    where: { id: parent.productVariantId },
    select: { id: true, productId: true },
  });
  if (!variant) return { error: "Variant not found" };
  return {
    where: { productVariantId: variant.id },
    productId: variant.productId,
    targetId: variant.id,
    targetType: "ProductVariant",
  };
}

// ─── Product/variant markup + priceFromBom ──────────────────────────────────

export async function updateProductBomPricing(
  productId: string,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();
  const disabled = await requireBomEnabled();
  if (disabled) return { error: disabled };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { priceFromBom: true, materialMarginPercent: true, laborMarginPercent: true },
  });
  if (!product) return { error: "Product not found" };

  const parsed = productBomPricingSchema.safeParse({
    priceFromBom: formData.get("priceFromBom") === "on",
    materialMarginPercent: formData.get("materialMarginPercent"),
    laborMarginPercent: formData.get("laborMarginPercent"),
  });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  await prisma.product.update({
    where: { id: productId },
    data: {
      priceFromBom: parsed.data.priceFromBom,
      materialMarginPercent: parsed.data.materialMarginPercent,
      laborMarginPercent: parsed.data.laborMarginPercent,
    },
  });

  // Margin/toggle changes are audited as BOM_UPDATE (PRODUCT_UPDATE is the
  // admin-API convention); the reprice itself logs BOM_REPRICE (§13.9).
  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: productId,
    targetType: "Product",
    details: {
      op: "pricing",
      before: {
        priceFromBom: product.priceFromBom,
        materialMarginPercent: product.materialMarginPercent?.toString() ?? null,
        laborMarginPercent: product.laborMarginPercent?.toString() ?? null,
      },
      after: {
        priceFromBom: parsed.data.priceFromBom,
        materialMarginPercent: parsed.data.materialMarginPercent,
        laborMarginPercent: parsed.data.laborMarginPercent,
      },
    },
  });

  const repriceError = await triggerReprice("MARGIN_UPDATE", user.id);
  revalidatePath(productPath(productId));
  if (repriceError) return { error: repriceError };
  return { success: true };
}

export async function updateVariantBomPricing(
  variantId: string,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();
  const disabled = await requireBomEnabled();
  if (disabled) return { error: disabled };

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: {
      productId: true,
      priceFromBom: true,
      materialMarginPercent: true,
      laborMarginPercent: true,
    },
  });
  if (!variant) return { error: "Variant not found" };

  const parsed = variantBomPricingSchema.safeParse({
    priceFromBom: formData.get("priceFromBom"),
    materialMarginPercent: formData.get("materialMarginPercent"),
    laborMarginPercent: formData.get("laborMarginPercent"),
  });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const priceFromBom =
    parsed.data.priceFromBom === "inherit" ? null : parsed.data.priceFromBom === "on";

  await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      priceFromBom,
      materialMarginPercent: parsed.data.materialMarginPercent,
      laborMarginPercent: parsed.data.laborMarginPercent,
    },
  });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: variantId,
    targetType: "ProductVariant",
    details: {
      op: "pricing",
      before: {
        priceFromBom: variant.priceFromBom,
        materialMarginPercent: variant.materialMarginPercent?.toString() ?? null,
        laborMarginPercent: variant.laborMarginPercent?.toString() ?? null,
      },
      after: {
        priceFromBom,
        materialMarginPercent: parsed.data.materialMarginPercent,
        laborMarginPercent: parsed.data.laborMarginPercent,
      },
    },
  });

  const repriceError = await triggerReprice("MARGIN_UPDATE", user.id);
  revalidatePath(productPath(variant.productId));
  if (repriceError) return { error: repriceError };
  return { success: true };
}

// ─── BOM component lines ─────────────────────────────────────────────────────

export async function addBomComponent(
  parent: BomParentRef,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();
  const disabled = await requireBomEnabled();
  if (disabled) return { error: disabled };

  const ctx = await resolveBomParent(parent);
  if ("error" in ctx) return { error: ctx.error };

  const parsed = bomComponentSchema.safeParse({
    materialId: formData.get("materialId"),
    quantity: formData.get("quantity"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const material = await prisma.material.findUnique({
    where: { id: parsed.data.materialId },
    select: { id: true, name: true, kind: true, archivedAt: true },
  });
  if (!material) return { errors: { materialId: "Material not found" } };
  if (material.archivedAt) {
    return { errors: { materialId: `"${material.name}" is archived — choose another material` } };
  }

  const duplicate = await prisma.bomComponent.findFirst({
    where: { ...ctx.where, materialId: material.id },
    select: { id: true },
  });
  if (duplicate) {
    return {
      errors: { materialId: `"${material.name}" is already on this BOM — edit its quantity instead` },
    };
  }

  // Save-time depth gate (§13.4): products/variants can't be children of a
  // material, so this edge can never create a cycle — but a sub-assembly child
  // still adds a level. Model the parent as a virtual node over the material
  // graph and check 1 + subtree depth ≤ SAVE_MAX_DEPTH via validateBomGraph.
  if (material.kind === "subassembly") {
    const [materialRows, existingLines] = await Promise.all([
      prisma.material.findMany({
        select: { id: true, kind: true, components: { select: { materialId: true } } },
      }),
      prisma.bomComponent.findMany({ where: ctx.where, select: { materialId: true } }),
    ]);
    const graph: EngineMaterial[] = materialRows.map((m) => ({
      id: m.id,
      kind: m.kind,
      components: m.components.map((c) => ({ materialId: c.materialId, quantity: 1 })),
    }));
    graph.push({
      id: "__bom_parent__",
      kind: "subassembly",
      components: [...existingLines.map((l) => l.materialId), material.id].map((id) => ({
        materialId: id,
        quantity: 1,
      })),
    });
    const check = validateBomGraph(graph);
    if (check.cycle) {
      return { error: `This would create a BOM cycle: ${check.cycle.join(" → ")}` };
    }
    if (check.maxDepth > SAVE_MAX_DEPTH) {
      return {
        errors: {
          materialId: `Adding "${material.name}" would make this BOM ${check.maxDepth} levels deep (max ${SAVE_MAX_DEPTH})`,
        },
      };
    }
  }

  await prisma.bomComponent.create({
    data: {
      ...ctx.where,
      materialId: material.id,
      quantity: parsed.data.quantity,
      notes: parsed.data.notes,
    },
  });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: ctx.targetId,
    targetType: ctx.targetType,
    details: {
      op: "add",
      lineType: "component",
      materialId: material.id,
      materialName: material.name,
      quantity: String(parsed.data.quantity),
    },
  });

  const repriceError = await triggerReprice("BOM_UPDATE", user.id);
  revalidatePath(productPath(ctx.productId));
  if (repriceError) return { error: repriceError };
  return { success: true };
}

export async function updateBomComponent(
  componentId: string,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();
  const disabled = await requireBomEnabled();
  if (disabled) return { error: disabled };

  const line = await prisma.bomComponent.findUnique({
    where: { id: componentId },
    include: {
      material: { select: { id: true, name: true } },
      productVariant: { select: { productId: true } },
    },
  });
  if (!line) return { error: "BOM line not found" };
  const productId = line.productId ?? line.productVariant?.productId;
  // Sub-assembly (material-parent) lines are managed in /admin/materials.
  if (!productId) return { error: "This BOM line belongs to a sub-assembly" };

  const parsed = bomComponentSchema
    .pick({ quantity: true, notes: true })
    .safeParse({ quantity: formData.get("quantity"), notes: formData.get("notes") });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  await prisma.bomComponent.update({
    where: { id: componentId },
    data: { quantity: parsed.data.quantity, notes: parsed.data.notes },
  });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: line.productId ?? line.productVariantId!,
    targetType: line.productId ? "Product" : "ProductVariant",
    details: {
      op: "update",
      lineType: "component",
      materialId: line.material.id,
      materialName: line.material.name,
      quantityBefore: line.quantity.toString(),
      quantityAfter: String(parsed.data.quantity),
    },
  });

  const repriceError = await triggerReprice("BOM_UPDATE", user.id);
  revalidatePath(productPath(productId));
  if (repriceError) return { error: repriceError };
  return { success: true };
}

export async function deleteBomComponent(componentId: string): Promise<FormState> {
  const user = await requireAdmin();
  const disabled = await requireBomEnabled();
  if (disabled) return { error: disabled };

  const line = await prisma.bomComponent.findUnique({
    where: { id: componentId },
    include: {
      material: { select: { id: true, name: true } },
      productVariant: { select: { productId: true } },
    },
  });
  if (!line) return { error: "BOM line not found" };
  const productId = line.productId ?? line.productVariant?.productId;
  if (!productId) return { error: "This BOM line belongs to a sub-assembly" };

  await prisma.bomComponent.delete({ where: { id: componentId } });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: line.productId ?? line.productVariantId!,
    targetType: line.productId ? "Product" : "ProductVariant",
    details: {
      op: "remove",
      lineType: "component",
      materialId: line.material.id,
      materialName: line.material.name,
      quantity: line.quantity.toString(),
    },
  });

  const repriceError = await triggerReprice("BOM_UPDATE", user.id);
  revalidatePath(productPath(productId));
  if (repriceError) return { error: repriceError };
  return { success: true };
}

// ─── BOM labor lines ─────────────────────────────────────────────────────────

export async function addBomLaborLine(
  parent: BomParentRef,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();
  const disabled = await requireBomEnabled();
  if (disabled) return { error: disabled };

  const ctx = await resolveBomParent(parent);
  if ("error" in ctx) return { error: ctx.error };

  const parsed = bomLaborLineSchema.safeParse({
    laborRateId: formData.get("laborRateId"),
    hours: formData.get("hours"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const rate = await prisma.laborRate.findUnique({
    where: { id: parsed.data.laborRateId },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!rate) return { errors: { laborRateId: "Labor rate not found" } };
  if (rate.archivedAt) {
    return { errors: { laborRateId: `"${rate.name}" is archived — choose another labor rate` } };
  }

  const duplicate = await prisma.bomLaborLine.findFirst({
    where: { ...ctx.where, laborRateId: rate.id },
    select: { id: true },
  });
  if (duplicate) {
    return {
      errors: { laborRateId: `"${rate.name}" is already on this BOM — edit its hours instead` },
    };
  }

  await prisma.bomLaborLine.create({
    data: {
      ...ctx.where,
      laborRateId: rate.id,
      hours: parsed.data.hours,
      notes: parsed.data.notes,
    },
  });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: ctx.targetId,
    targetType: ctx.targetType,
    details: {
      op: "add",
      lineType: "labor",
      laborRateId: rate.id,
      laborRateName: rate.name,
      hours: String(parsed.data.hours),
    },
  });

  const repriceError = await triggerReprice("BOM_UPDATE", user.id);
  revalidatePath(productPath(ctx.productId));
  if (repriceError) return { error: repriceError };
  return { success: true };
}

export async function updateBomLaborLine(
  lineId: string,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();
  const disabled = await requireBomEnabled();
  if (disabled) return { error: disabled };

  const line = await prisma.bomLaborLine.findUnique({
    where: { id: lineId },
    include: {
      laborRate: { select: { id: true, name: true } },
      productVariant: { select: { productId: true } },
    },
  });
  if (!line) return { error: "BOM labor line not found" };
  const productId = line.productId ?? line.productVariant?.productId;
  if (!productId) return { error: "This labor line belongs to a sub-assembly" };

  const parsed = bomLaborLineSchema
    .pick({ hours: true, notes: true })
    .safeParse({ hours: formData.get("hours"), notes: formData.get("notes") });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  await prisma.bomLaborLine.update({
    where: { id: lineId },
    data: { hours: parsed.data.hours, notes: parsed.data.notes },
  });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: line.productId ?? line.productVariantId!,
    targetType: line.productId ? "Product" : "ProductVariant",
    details: {
      op: "update",
      lineType: "labor",
      laborRateId: line.laborRate.id,
      laborRateName: line.laborRate.name,
      hoursBefore: line.hours.toString(),
      hoursAfter: String(parsed.data.hours),
    },
  });

  const repriceError = await triggerReprice("BOM_UPDATE", user.id);
  revalidatePath(productPath(productId));
  if (repriceError) return { error: repriceError };
  return { success: true };
}

export async function deleteBomLaborLine(lineId: string): Promise<FormState> {
  const user = await requireAdmin();
  const disabled = await requireBomEnabled();
  if (disabled) return { error: disabled };

  const line = await prisma.bomLaborLine.findUnique({
    where: { id: lineId },
    include: {
      laborRate: { select: { id: true, name: true } },
      productVariant: { select: { productId: true } },
    },
  });
  if (!line) return { error: "BOM labor line not found" };
  const productId = line.productId ?? line.productVariant?.productId;
  if (!productId) return { error: "This labor line belongs to a sub-assembly" };

  await prisma.bomLaborLine.delete({ where: { id: lineId } });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: line.productId ?? line.productVariantId!,
    targetType: line.productId ? "Product" : "ProductVariant",
    details: {
      op: "remove",
      lineType: "labor",
      laborRateId: line.laborRate.id,
      laborRateName: line.laborRate.name,
      hours: line.hours.toString(),
    },
  });

  const repriceError = await triggerReprice("BOM_UPDATE", user.id);
  revalidatePath(productPath(productId));
  if (repriceError) return { error: repriceError };
  return { success: true };
}

/**
 * Prominent per-product BOM-pricing switch (review feedback: the choice must
 * be unmissable; default is OFF). Margins are left untouched — they keep
 * whatever was configured for the next time it's turned on.
 */
export async function toggleProductPriceFromBom(
  productId: string,
  enable: boolean,
): Promise<FormState> {
  const user = await requireAdmin();
  const disabled = await requireBomEnabled();
  if (disabled) return { error: disabled };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { priceFromBom: true },
  });
  if (!product) return { error: "Product not found" };
  if (product.priceFromBom === enable) return { success: true };

  await prisma.product.update({
    where: { id: productId },
    data: { priceFromBom: enable },
  });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: productId,
    targetType: "Product",
    details: { op: "pricing-toggle", before: product.priceFromBom, after: enable },
  });

  // Turning ON computes prices now; turning OFF leaves prices at their last
  // value (§13.6) — nothing to recompute.
  if (enable) {
    const repriceError = await triggerReprice("MARGIN_UPDATE", user.id);
    if (repriceError) {
      revalidatePath(productPath(productId));
      return { error: repriceError };
    }
  }
  revalidatePath(productPath(productId));
  return { success: true };
}
