import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveUpload, validateFile } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "STAFF" && role !== "CUSTOMER") {
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
    console.error("Upload failed:", err);
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 },
    );
  }
}
