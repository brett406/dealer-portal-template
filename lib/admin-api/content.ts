import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/slug";
import { logAudit } from "@/lib/audit";
import { sanitizePayload } from "./sanitize";
import { isUniqueViolation } from "./prisma-errors";

/**
 * Content service for the admin API — CMS collection items (blog posts, etc.).
 * A collection item = { collectionKey, slug, published, payload }. All payload
 * string values are sanitized on save (defense in depth with render-time SafeHtml).
 * Additive + idempotent: a duplicate (collectionKey, slug) is skipped.
 */

export const createCollectionItemSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  slug: z.string().trim().min(1).optional(),
  published: z.boolean().default(false),
});

export type CreateCollectionItemResult =
  | { status: "created"; id: string; slug: string; published: boolean }
  | { status: "skipped"; reason: string; slug?: string }
  | { status: "error"; reason: string };

export async function createCollectionItem(
  collectionKey: string,
  raw: unknown,
  actorUserId: string,
): Promise<CreateCollectionItemResult> {
  const parsed = createCollectionItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const payload = sanitizePayload(parsed.data.payload);

  let slug = parsed.data.slug?.trim() ?? "";
  if (!slug && typeof payload.title === "string" && payload.title) {
    slug = generateSlug(payload.title);
  }
  if (!slug) return { status: "error", reason: "slug-required (provide slug or a title)" };
  // generateSlug may itself have been applied to a sanitized title; re-normalize.
  slug = generateSlug(slug);

  const existing = await prisma.collectionItem.findUnique({
    where: { collectionKey_slug: { collectionKey, slug } },
    select: { id: true },
  });
  if (existing) return { status: "skipped", reason: "slug-exists", slug };

  const last = await prisma.collectionItem.findFirst({
    where: { collectionKey },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  let item;
  try {
    item = await prisma.collectionItem.create({
      data: {
        collectionKey,
        slug,
        published: parsed.data.published,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        payload: payload as Prisma.InputJsonValue,
        updatedByEmail: "admin-api",
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { status: "skipped", reason: "slug-exists", slug };
    throw e;
  }

  await logAudit({
    action: "COLLECTION_ITEM_CREATE",
    userId: actorUserId,
    targetId: item.id,
    targetType: "CollectionItem",
    details: { via: "admin-api", collectionKey, slug, published: parsed.data.published },
  });

  return { status: "created", id: item.id, slug, published: parsed.data.published };
}
