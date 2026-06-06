import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/slug";
import { logAudit } from "@/lib/audit";

/**
 * Catalog service for the admin API (TEMPLATE / generic schema).
 *
 * Mirrors the validated logic of the admin UI server actions (createProduct +
 * auto-"Each" UOM + addVariant) in a session-free, token-authed context.
 * Additive + idempotent: a product whose variant SKU already exists is skipped,
 * never overwritten or deleted.
 *
 * NOTE ON FORKS: this is the generic template model (variant = baseRetailPrice,
 * priced via the company's flat PriceLevel discount). Customer forks that add a
 * price-type matrix (e.g. BCP's GRN/RED/NET) extend this with a `priceTypeCode`
 * on the variant input and resolve it to `priceTypeId` in their own copy.
 */

export const variantInputSchema = z.object({
  name: z.string().trim().min(1).default("Each"),
  sku: z.string().trim().min(1),
  retail: z.number().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().min(1), // category NAME, resolved to an id
  description: z.string().optional().nullable(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  madeToOrder: z.boolean().default(false),
  minOrderQuantity: z.number().int().positive().optional().nullable(),
  variants: z.array(variantInputSchema).min(1),
  imageUrl: z.string().trim().min(1).optional(), // a URL already returned by the uploads endpoint
  imageAlt: z.string().optional().nullable(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export type CreateProductResult =
  | { status: "created"; productId: string; slug: string; skus: string[] }
  | { status: "skipped"; reason: string; sku?: string }
  | { status: "error"; reason: string };

export async function listCategories() {
  return prisma.productCategory.findMany({
    where: { active: true },
    select: { id: true, name: true, slug: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createProduct(
  raw: unknown,
  actorUserId: string,
): Promise<CreateProductResult> {
  const parsed = createProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const input = parsed.data;

  const category = await prisma.productCategory.findFirst({
    where: { name: input.category, active: true },
    select: { id: true },
  });
  if (!category) return { status: "skipped", reason: `category-not-found:${input.category}` };

  for (const v of input.variants) {
    const exists = await prisma.productVariant.findUnique({ where: { sku: v.sku }, select: { id: true } });
    if (exists) return { status: "skipped", reason: "sku-exists", sku: v.sku };
  }

  let slug = generateSlug(input.name);
  if (await prisma.product.findFirst({ where: { slug }, select: { id: true } })) {
    slug = `${slug}-${input.variants[0].sku.toLowerCase()}`;
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: input.name,
        slug,
        categoryId: category.id,
        description: input.description ?? null,
        minOrderQuantity: input.minOrderQuantity ?? null,
        madeToOrder: input.madeToOrder,
        tags: [],
        sortOrder: 0,
        active: input.active,
        featured: input.featured,
      },
    });
    await tx.productUOM.create({
      data: { productId: created.id, name: "Each", conversionFactor: 1, sortOrder: 0 },
    });
    for (const [i, v] of input.variants.entries()) {
      await tx.productVariant.create({
        data: {
          productId: created.id,
          name: v.name,
          sku: v.sku,
          baseRetailPrice: v.retail,
          stockQuantity: v.stock,
          lowStockThreshold: v.lowStockThreshold,
          active: true,
          sortOrder: i,
        },
      });
    }
    if (input.imageUrl) {
      await tx.productImage.create({
        data: { productId: created.id, url: input.imageUrl, altText: input.imageAlt ?? null, isPrimary: true, sortOrder: 0 },
      });
    }
    return created;
  });

  await logAudit({
    action: "PRODUCT_CREATE",
    userId: actorUserId,
    targetId: product.id,
    targetType: "Product",
    details: { via: "admin-api", name: input.name, skus: input.variants.map((v) => v.sku) },
  });

  return { status: "created", productId: product.id, slug, skus: input.variants.map((v) => v.sku) };
}

export const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

export async function createCategory(raw: unknown, actorUserId: string) {
  const parsed = createCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error" as const, reason: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const input = parsed.data;
  const slug = generateSlug(input.name);
  const existing = await prisma.productCategory.findFirst({ where: { OR: [{ name: input.name }, { slug }] }, select: { id: true } });
  if (existing) return { status: "skipped" as const, reason: "category-exists", categoryId: existing.id };

  const category = await prisma.productCategory.create({
    data: { name: input.name, slug, description: input.description ?? null, active: input.active },
  });
  await logAudit({ action: "CATEGORY_CREATE", userId: actorUserId, targetId: category.id, targetType: "ProductCategory", details: { via: "admin-api", name: input.name } });
  return { status: "created" as const, categoryId: category.id, slug };
}
