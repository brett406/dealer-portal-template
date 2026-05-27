import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUploadsDir, MIME_BY_EXTENSION } from "@/lib/uploads";

// Raster images are safe to preview inline; everything else (incl. SVG, which
// can carry script) is served as a download.
const INLINE_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/**
 * Serve uploaded files from the persistent volume (Railway production) or the
 * local uploads dir.
 *
 * Dealer media is login-gated (DATABASE_SAFETY / MEDIA-MANAGEMENT spec Phase 2):
 * these files are NOT public assets. Any authenticated user (admin or approved
 * dealer) may download; anonymous requests get 401. Always link downloads
 * through this route, never the ungated static `/uploads/...` path.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  // ── Auth gate ──────────────────────────────────────────────
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { filename } = await params;

  // Prevent path traversal
  const safe = path.basename(decodeURIComponent(filename));
  if (safe !== decodeURIComponent(filename) || safe.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(getUploadsDir(), safe);

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(safe).toLowerCase();
    const contentType = MIME_BY_EXTENSION[ext] ?? "application/octet-stream";

    // Use the friendly original name for the download, if we have a record.
    const asset = await prisma.asset.findFirst({
      where: { filename: safe },
      select: { originalName: true },
    });
    const downloadName = asset?.originalName || safe;

    // Inline-preview raster images unless ?download=1; force-download the rest.
    const forceDownload = request.nextUrl.searchParams.get("download") === "1";
    const inline = INLINE_IMAGE_EXTENSIONS.has(ext) && !forceDownload;

    const asciiName = downloadName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
    const disposition =
      `${inline ? "inline" : "attachment"}; filename="${asciiName}"; ` +
      `filename*=UTF-8''${encodeURIComponent(downloadName)}`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        // Private: these are auth-gated dealer assets, never shared caches.
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": disposition,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
