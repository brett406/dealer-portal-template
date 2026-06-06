import { NextRequest } from "next/server";
import { authenticateAdminApi } from "@/lib/admin-api/auth";
import { apiOk, apiError } from "@/lib/admin-api/http";
import { createCollectionItem, type CreateCollectionItemResult } from "@/lib/admin-api/content";

/**
 * POST /api/admin/content/{collectionKey}
 * Body: a single item, or { items: [...] }.
 * Item: { payload: { title, body, ... }, slug?, published? }
 * E.g. collectionKey = "blog". Payload strings are sanitized on save.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collectionKey: string }> },
) {
  const a = await authenticateAdminApi(request);
  if (!a.ok) return a.response;

  const { collectionKey } = await params;
  if (!collectionKey) return apiError(400, "Missing collectionKey");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const items: unknown[] =
    body && typeof body === "object" && Array.isArray((body as { items?: unknown[] }).items)
      ? (body as { items: unknown[] }).items
      : [body];

  if (items.length === 0) return apiError(400, "No items provided");
  if (items.length > 100) return apiError(400, "Too many items in one request (max 100)");

  const results: CreateCollectionItemResult[] = [];
  for (const item of items) {
    try {
      results.push(await createCollectionItem(collectionKey, item, a.actorUserId));
    } catch (e) {
      console.error("[admin-api] collection-item create failed:", e);
      results.push({ status: "error", reason: "internal error creating item" });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  return apiOk({ collectionKey, created, total: results.length, results });
}
