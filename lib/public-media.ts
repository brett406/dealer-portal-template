import { prisma } from "@/lib/prisma";

/**
 * Which uploaded files the storefront already publishes.
 *
 * Uploads are login-gated by default — the media library holds dealer price
 * sheets, brochures and spec docs, which are not public assets. Product and
 * category photos are uploaded through that same route, but they are rendered
 * on pages any visitor can see. Gating them served a 401 to logged-out
 * visitors, which the browser draws as a broken image.
 *
 * So: a file is public exactly when the site already renders it publicly, and
 * private otherwise. Membership is derived on read rather than stored on the
 * file, so it can never drift from what the pages actually show — unlink the
 * photo from the product and the file locks itself again.
 */

const URL_PREFIX = "/api/uploads/";

// A hit is stable (a photo stays linked); a miss must expire quickly so a
// freshly uploaded photo goes public without waiting out a long TTL.
const HIT_TTL_MS = 5 * 60_000;
const MISS_TTL_MS = 15_000;

const cache = new Map<string, { isPublic: boolean; expiresAt: number }>();

/** Test seam / admin hook: forget what we know about publication state. */
export function clearPublicMediaCache(): void {
  cache.clear();
}

async function lookup(filename: string): Promise<boolean> {
  // The same file can be stored raw or percent-encoded depending on which
  // editor wrote the reference; check both spellings.
  const candidates = Array.from(
    new Set([URL_PREFIX + filename, URL_PREFIX + encodeURIComponent(filename)]),
  );

  const [image, category] = await Promise.all([
    prisma.productImage.findFirst({ where: { url: { in: candidates } }, select: { id: true } }),
    prisma.productCategory.findFirst({
      where: { imageUrl: { in: candidates } },
      select: { id: true },
    }),
  ]);
  if (image || category) return true;

  // CMS content is a JSON blob, so match against its text form. `position` is
  // used rather than LIKE so a filename containing % or _ needs no escaping.
  for (const url of candidates) {
    const rows = await prisma.$queryRaw<Array<{ found: number }>>`
      SELECT 1 AS found FROM "PageContent"    WHERE position(${url} in payload::text) > 0
      UNION ALL
      SELECT 1 AS found FROM "PageGroupItem"  WHERE position(${url} in payload::text) > 0
      UNION ALL
      SELECT 1 AS found FROM "CollectionItem" WHERE published AND position(${url} in payload::text) > 0
      LIMIT 1`;
    if (rows.length > 0) return true;
  }

  return false;
}

/**
 * True when `filename` is referenced by a public page — a product photo, a
 * category photo, or media placed in published CMS content.
 */
export async function isPubliclyReferenced(filename: string): Promise<boolean> {
  const now = Date.now();
  const hit = cache.get(filename);
  if (hit && hit.expiresAt > now) return hit.isPublic;

  let isPublic: boolean;
  try {
    isPublic = await lookup(filename);
  } catch {
    // A database hiccup must not hand out a gated file. Fail closed, and do
    // not cache the failure.
    return false;
  }

  cache.set(filename, {
    isPublic,
    expiresAt: now + (isPublic ? HIT_TTL_MS : MISS_TTL_MS),
  });
  return isPublic;
}
