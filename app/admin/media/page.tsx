import { prisma } from "@/lib/prisma";
import { buildPageMeta, getPageParam, paginate, PER_PAGE } from "@/lib/pagination";
import { MediaClient } from "./media-client";
import "./media.css";

export const dynamic = "force-dynamic";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; page?: string }>;
}) {
  const { folder, page } = await searchParams;
  const pageNum = getPageParam(page);
  const perPage = PER_PAGE.admin;

  // Assets are folder-scoped + paginated server-side. Folders themselves are
  // never paginated (the sidebar always shows the full set).
  const where: Record<string, unknown> = {};
  if (folder) where.folderId = folder;

  const [folders, libraryTotal, assets, filteredCount] = await Promise.all([
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
    prisma.asset.count(),
    prisma.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginate(pageNum, perPage),
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
    prisma.asset.count({ where }),
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

  const pageMeta = buildPageMeta(filteredCount, pageNum, perPage);

  return (
    <div>
      <h1>Media Library</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "4px", marginBottom: "24px" }}>
        Organize files into folders and make them available to your dealers.
      </p>
      <MediaClient
        folders={folderData}
        assets={assetData}
        libraryTotal={libraryTotal}
        selectedFolderId={folder ?? null}
        pageMeta={pageMeta}
      />
    </div>
  );
}
