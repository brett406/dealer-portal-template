import { prisma } from "@/lib/prisma";
import { firstParam, getPageParam, pageSlice, PER_PAGE } from "@/lib/pagination";
import { MediaClient } from "./media-client";
import "./media.css";

export const dynamic = "force-dynamic";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string | string[]; page?: string | string[] }>;
}) {
  const { folder: folderParam, page } = await searchParams;
  const folder = firstParam(folderParam);
  const pageNum = getPageParam(page);
  const perPage = PER_PAGE.admin;

  // Assets are folder-scoped + paginated server-side. Folders themselves are
  // never paginated (the sidebar always shows the full set).
  const where: Record<string, unknown> = {};
  if (folder) where.folderId = folder;

  // Count first (with the independent folder list + library total) so the page
  // slice uses the clamped page — deleting the last file on a high page drops you
  // back to a real page instead of an empty one.
  const [folders, libraryTotal, filteredCount] = await Promise.all([
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
    prisma.asset.count({ where }),
  ]);

  const { meta: pageMeta, skip, take } = pageSlice(filteredCount, pageNum, perPage);

  const assets = await prisma.asset.findMany({
    where,
    // createdAt can tie; id tiebreaker keeps paging stable across pages.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take,
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
  });

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
