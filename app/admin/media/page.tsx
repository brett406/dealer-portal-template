import { prisma } from "@/lib/prisma";
import { MediaClient } from "./media-client";
import "./media.css";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const assets = await prisma.asset.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
      size: true,
      storagePath: true,
      createdAt: true,
    },
  });

  const data = assets.map((a) => ({
    id: a.id,
    filename: a.filename,
    originalName: a.originalName,
    mimeType: a.mimeType,
    size: a.size,
    storagePath: a.storagePath,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1>Media Library</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "4px", marginBottom: "24px" }}>
        Upload and manage images for products, pages, and settings.
      </p>
      <MediaClient assets={data} />
    </div>
  );
}
