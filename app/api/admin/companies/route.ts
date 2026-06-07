import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdminApi } from "@/lib/admin-api/auth";
import { apiOk, apiError } from "@/lib/admin-api/http";
import { createCompany } from "@/lib/admin-api/companies";

/** GET /api/admin/companies?limit= — recent dealer companies. */
export async function GET(request: NextRequest) {
  const a = await authenticateAdminApi(request);
  if (!a.ok) return a.response;
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 50) || 50, 200);
  const companies = await prisma.company.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, active: true, approvalStatus: true, priceLevel: { select: { name: true } } },
  });
  return apiOk({ companies });
}

/** POST /api/admin/companies — { name, priceLevel, taxRate?, phone?, notes?, active? }. Idempotent by name. */
export async function POST(request: NextRequest) {
  const a = await authenticateAdminApi(request);
  if (!a.ok) return a.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const result = await createCompany(body, a.actorUserId);
  if (result.status === "error") return apiError(400, result.reason);
  return apiOk(result);
}
