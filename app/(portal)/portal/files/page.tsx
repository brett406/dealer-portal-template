import { requireCustomer } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { escapeLike, getPageParam, pageSlice, PER_PAGE } from "@/lib/pagination";
import { FilesClient } from "./files-client";
import "./files.css";

export const dynamic = "force-dynamic";

export default async function PortalFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; q?: string; page?: string }>;
}) {
  // Dealers only (CUSTOMER with an APPROVED company). All approved dealers see
  // all folders — no per-dealer scoping in v1.
  await requireCustomer("/portal/files");

  const { folder, q, page } = await searchParams;
  const pageNum = getPageParam(page);
  const perPage = PER_PAGE.portal;
  const query = q?.trim() || undefined;

  // Filtered asset query: folder scope + full-library search (searches every
  // asset, not just the current page — server-side so it scales).
  const where: Record<string, unknown> = {};
  if (folder) where.folderId = folder;
  if (query) {
    const safe = escapeLike(query);
    where.OR = [
      { title: { contains: safe, mode: "insensitive" } },
      { originalName: { contains: safe, mode: "insensitive" } },
    ];
  }

  // Count first (with the independent folder list + library total) so the page
  // slice uses the clamped page rather than overshooting into an empty page.
  const [folders, libraryTotal, filteredCount] = await Promise.all([
    prisma.assetFolder.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
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
      folderId: true,
      createdAt: true,
    },
  });

  const folderData = folders.map((f) => ({
    id: f.id,
    name: f.name,
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
    folderId: a.folderId,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1>Files</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "4px", marginBottom: "24px" }}>
        Browse and download brochures, spec sheets, and other resources.
      </p>
      <FilesClient
        folders={folderData}
        assets={assetData}
        libraryTotal={libraryTotal}
        selectedFolderId={folder ?? null}
        query={query ?? ""}
        pageMeta={pageMeta}
      />
    </div>
  );
}
