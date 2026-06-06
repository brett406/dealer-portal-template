import { NextRequest } from "next/server";
import { authenticateAdminApi } from "@/lib/admin-api/auth";
import { apiOk } from "@/lib/admin-api/http";
import { listPriceLevels } from "@/lib/admin-api/companies";

/** GET /api/admin/price-levels — price levels (id, name, discountPercent) for company FK resolution. */
export async function GET(request: NextRequest) {
  const a = await authenticateAdminApi(request);
  if (!a.ok) return a.response;
  return apiOk({ priceLevels: await listPriceLevels() });
}
