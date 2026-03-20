import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/cache";

export type ProductSearchResult = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  minOrderQuantity: number | null;
  primaryImageUrl: string | null;
  priceRange: { min: number; max: number } | null;
  variantCount: number;
  tags: string[];
};

export type SearchSuggestion = {
  id: string;
  name: string;
  slug: string;
  categoryName: string;
};

/**
 * Search products with full-text search for longer queries,
 * falling back to ILIKE for short queries. Cursor-based pagination.
 */
export async function searchProducts(opts: {
  query?: string;
  categoryId?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ products: ProductSearchResult[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 20;
  const query = opts.query?.trim();

  const cacheKey = `products:search:${query ?? ""}:${opts.categoryId ?? ""}:${opts.cursor ?? ""}:${limit}`;

  return cached(cacheKey, 60, async () => {
    // For full-text search queries (3+ chars), try PostgreSQL FTS with ranking
    if (query && query.length >= 3) {
      try {
        return await searchWithFullText(query, opts.categoryId, opts.cursor, limit);
      } catch {
        return searchWithPrisma(query, opts.categoryId, opts.cursor, limit);
      }
    }

    return searchWithPrisma(query, opts.categoryId, opts.cursor, limit);
  });
}

/**
 * Full-text search using PostgreSQL ts_rank for relevance ordering.
 * Name matches rank higher than description matches (2x weight).
 */
async function searchWithFullText(
  query: string,
  categoryId: string | undefined,
  cursor: string | undefined,
  limit: number,
): Promise<{ products: ProductSearchResult[]; nextCursor: string | null }> {
  const tsQuery = query
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((w) => w.length > 0)
    .join(" & ");

  if (!tsQuery) {
    return searchWithPrisma(query, categoryId, cursor, limit);
  }

  // Build parameterized query
  const params: unknown[] = [tsQuery, `%${query}%`, limit + 1];
  let paramIdx = 4;

  let categoryFilter = "";
  if (categoryId) {
    categoryFilter = `AND p."categoryId" = $${paramIdx}`;
    params.push(categoryId);
    paramIdx++;
  }

  let cursorFilter = "";
  if (cursor) {
    cursorFilter = `AND p."id" > $${paramIdx}`;
    params.push(cursor);
  }

  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      categoryId: string;
      minOrderQuantity: number | null;
      categoryName: string;
      rank: number;
    }[]
  >(
    `SELECT
      p."id", p."name", p."slug", p."description", p."categoryId", p."minOrderQuantity",
      c."name" as "categoryName",
      (
        ts_rank(to_tsvector('english', coalesce(p."name", '')), to_tsquery('english', $1)) * 2.0 +
        ts_rank(to_tsvector('english', coalesce(p."description", '')), to_tsquery('english', $1))
      ) as rank
    FROM "Product" p
    JOIN "ProductCategory" c ON c."id" = p."categoryId"
    WHERE p."active" = true
      AND c."active" = true
      ${categoryFilter}
      ${cursorFilter}
      AND (
        to_tsvector('english', coalesce(p."name", '') || ' ' || coalesce(p."description", ''))
          @@ to_tsquery('english', $1)
        OR p."name" ILIKE $2
        OR EXISTS (
          SELECT 1 FROM "ProductVariant" v
          WHERE v."productId" = p."id" AND v."sku" ILIKE $2
        )
      )
    ORDER BY rank DESC, p."sortOrder" ASC, p."id" ASC
    LIMIT $3`,
    ...params,
  );

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Batch-fetch variants and images
  const productIds = items.map((r) => r.id);

  const [variants, images, productsWithTags] = await Promise.all([
    prisma.productVariant.findMany({
      where: { productId: { in: productIds }, active: true },
      select: { productId: true, baseRetailPrice: true },
      orderBy: { baseRetailPrice: "asc" },
    }),
    prisma.productImage.findMany({
      where: { productId: { in: productIds }, isPrimary: true },
      select: { productId: true, url: true },
    }),
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, tags: true },
    }),
  ]);

  const variantsByProduct = new Map<string, number[]>();
  for (const v of variants) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push(Number(v.baseRetailPrice));
    variantsByProduct.set(v.productId, list);
  }

  const imageByProduct = new Map<string, string>();
  for (const img of images) {
    imageByProduct.set(img.productId, img.url);
  }

  const tagsByProduct = new Map<string, string[]>();
  for (const p of productsWithTags) {
    tagsByProduct.set(p.id, p.tags);
  }

  const products: ProductSearchResult[] = items.map((r) => {
    const prices = variantsByProduct.get(r.id) ?? [];
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      minOrderQuantity: r.minOrderQuantity,
      primaryImageUrl: imageByProduct.get(r.id) ?? null,
      priceRange: prices.length > 0
        ? { min: Math.min(...prices), max: Math.max(...prices) }
        : null,
      variantCount: prices.length,
      tags: tagsByProduct.get(r.id) ?? [],
    };
  });

  return { products, nextCursor };
}

/**
 * Standard Prisma search for short queries or no query.
 * Uses select (not include) to avoid overfetching.
 */
async function searchWithPrisma(
  query: string | undefined,
  categoryId: string | undefined,
  cursor: string | undefined,
  limit: number,
): Promise<{ products: ProductSearchResult[]; nextCursor: string | null }> {
  const where: Record<string, unknown> = { active: true, category: { active: true } };

  if (categoryId) where.categoryId = categoryId;

  if (query && query.length > 0) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { variants: { some: { sku: { contains: query, mode: "insensitive" } } } },
    ];
  }

  if (cursor) where.id = { gt: cursor };

  const products = await prisma.product.findMany({
    where,
    take: limit + 1,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      categoryId: true,
      minOrderQuantity: true,
      tags: true,
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

  const hasMore = products.length > limit;
  const items = hasMore ? products.slice(0, limit) : products;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const results: ProductSearchResult[] = items.map((p) => {
    const prices = p.variants.map((v) => Number(v.baseRetailPrice));
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      categoryId: p.categoryId,
      categoryName: p.category.name,
      minOrderQuantity: p.minOrderQuantity,
      primaryImageUrl: p.images[0]?.url ?? null,
      priceRange: prices.length > 0
        ? { min: Math.min(...prices), max: Math.max(...prices) }
        : null,
      variantCount: p.variants.length,
      tags: p.tags,
    };
  });

  return { products: results, nextCursor };
}

/**
 * Search suggestions for autocomplete (top 5, fast).
 */
export async function searchSuggestions(query: string): Promise<SearchSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const products = await prisma.product.findMany({
    where: {
      active: true,
      category: { active: true },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
      ],
    },
    take: 5,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      category: { select: { name: true } },
    },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    categoryName: p.category.name,
  }));
}
