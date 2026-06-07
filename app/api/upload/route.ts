import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { saveUpload, validateFile } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  // CSRF protection — hand-rolled API route (no NextAuth/Server Action CSRF here).
  const csrfError = validateOrigin(request);
  if (csrfError) {
    return NextResponse.json({ error: csrfError }, { status: 403 });
  }

  // Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Uploads are an admin/staff-only operation: every caller of /api/upload is
  // under app/admin/**. Dealers (CUSTOMER) must not write to the shared media
  // volume. If a dealer-facing upload feature is ever added, give it its own
  // route with its own quota/validation rather than widening this one.
  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file
  const validation = validateFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Save file
  try {
    const result = await saveUpload(file);
    return NextResponse.json({
      url: result.url,
      filename: result.filename,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Upload failed:", message);
    return NextResponse.json(
      { error: `Failed to save file: ${message}` },
      { status: 500 },
    );
  }
}
