import { NextRequest } from "next/server";
import { authenticateAdminApi } from "@/lib/admin-api/auth";
import { apiOk, apiError } from "@/lib/admin-api/http";
import { listCategories, createCategory } from "@/lib/admin-api/catalog";

/** GET /api/admin/categories — active categories (id, name, slug) for FK resolution. */
export async function GET(request: NextRequest) {
  const a = await authenticateAdminApi(request);
  if (!a.ok) return a.response;
  return apiOk({ categories: await listCategories() });
}

/** POST /api/admin/categories — { name, description?, active? }. Idempotent by name/slug. */
export async function POST(request: NextRequest) {
  const a = await authenticateAdminApi(request);
  if (!a.ok) return a.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const result = await createCategory(body, a.actorUserId);
  if (result.status === "error") return apiError(400, result.reason);
  return apiOk(result);
}
