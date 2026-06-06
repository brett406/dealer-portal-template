import { NextRequest } from "next/server";
import { saveUpload, validateFile } from "@/lib/uploads";
import { logAudit } from "@/lib/audit";
import { authenticateAdminApi } from "@/lib/admin-api/auth";
import { apiOk, apiError } from "@/lib/admin-api/http";

/**
 * POST /api/admin/uploads (multipart: field "file")
 * Token-authed image/asset upload. Reuses the hardened lib/uploads.ts
 * (extension blocklist, MIME + size checks). Returns { url } to pass as a
 * product's imageUrl. The shared media volume is admin-only (per SECURITY-BASELINE).
 */
export async function POST(request: NextRequest) {
  const a = await authenticateAdminApi(request);
  if (!a.ok) return a.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError(400, "Invalid form data");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return apiError(400, "No file provided (multipart field 'file')");

  const validation = validateFile({ name: file.name, type: file.type, size: file.size });
  if (!validation.valid) return apiError(400, validation.error ?? "Invalid file");

  try {
    const result = await saveUpload(file);
    await logAudit({
      action: "ASSET_UPLOAD",
      userId: a.actorUserId,
      targetType: "Asset",
      details: { via: "admin-api", filename: result.filename },
    });
    return apiOk({ url: result.url, filename: result.filename });
  } catch (e) {
    console.error("[admin-api] upload failed:", e);
    return apiError(500, "Failed to save file");
  }
}
