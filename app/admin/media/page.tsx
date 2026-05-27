import { prisma } from "@/lib/prisma";
import { MediaClient } from "./media-client";
import "./media.css";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const [folders, assets] = await Promise.all([
    prisma.assetFolder.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        accentColor: true,
        sortOrder: true,
        _count: { select: { assets: true } },
      },
    }),
    prisma.asset.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        originalName: true,
        title: true,
        mimeType: true,
        size: true,
        storagePath: true,
        folderId: true,
        createdAt: true,
      },
    }),
  ]);

  const folderData = folders.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    accentColor: f.accentColor,
    sortOrder: f.sortOrder,
    fileCount: f._count.assets,
  }));

  const assetData = assets.map((a) => ({
    id: a.id,
    filename: a.filename,
    originalName: a.originalName,
    title: a.title,
    mimeType: a.mimeType,
    size: a.size,
    storagePath: a.storagePath,
    folderId: a.folderId,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1>Media Library</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "4px", marginBottom: "24px" }}>
        Organize files into folders and make them available to your dealers.
      </p>
      <MediaClient folders={folderData} assets={assetData} />
    </div>
  );
}
