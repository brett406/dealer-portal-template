import { prisma } from "@/lib/prisma";

/**
 * Get a single page's content by pageKey.
 */
export async function getPageContent(
  pageKey: string,
): Promise<{ payload: Record<string, unknown>; seo: Record<string, unknown> } | null> {
  const page = await prisma.pageContent.findUnique({ where: { pageKey } });
  if (!page) return null;
  return {
    payload: page.payload as Record<string, unknown>,
    seo: page.seo as Record<string, unknown>,
  };
}

/**
 * Get repeatable group items for a page (e.g., features, testimonials).
 */
export async function getPageGroup(
  pageKey: string,
  groupKey: string,
): Promise<{ id: string; sortOrder: number; payload: Record<string, unknown> }[]> {
  const items = await prisma.pageGroupItem.findMany({
    where: { pageKey, groupKey },
    orderBy: { sortOrder: "asc" },
  });

  return items.map((item) => ({
    id: item.id,
    sortOrder: item.sortOrder,
    payload: item.payload as Record<string, unknown>,
  }));
}

/**
 * Get published collection items (e.g., blog posts).
 */
export async function getCollection(
  collectionKey: string,
  opts: { published?: boolean; limit?: number } = {},
): Promise<
  { id: string; slug: string | null; sortOrder: number; payload: Record<string, unknown> }[]
> {
  const items = await prisma.collectionItem.findMany({
    where: {
      collectionKey,
      ...(opts.published !== false ? { published: true } : {}),
    },
    orderBy: { sortOrder: "asc" },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  return items.map((item) => ({
    id: item.id,
    slug: item.slug,
    sortOrder: item.sortOrder,
    payload: item.payload as Record<string, unknown>,
  }));
}

/**
 * Get a single collection item by slug.
 */
export async function getCollectionItem(
  collectionKey: string,
  slug: string,
): Promise<{ id: string; payload: Record<string, unknown> } | null> {
  const item = await prisma.collectionItem.findUnique({
    where: { collectionKey_slug: { collectionKey, slug } },
  });

  if (!item || !item.published) return null;

  return { id: item.id, payload: item.payload as Record<string, unknown> };
}

/**
 * Get the site settings.
 */
export async function getSiteSettings() {
  return prisma.siteSetting.findFirst();
}
