import { requireCustomer } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { FilesClient } from "./files-client";
import "./files.css";

export const dynamic = "force-dynamic";

export default async function PortalFilesPage() {
  // Dealers only (CUSTOMER with an APPROVED company). All approved dealers see
  // all folders — no per-dealer scoping in v1.
  await requireCustomer("/portal/files");

  const [folders, assets] = await Promise.all([
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
    prisma.asset.findMany({
      orderBy: { createdAt: "desc" },
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
    }),
  ]);

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
      <FilesClient folders={folderData} assets={assetData} />
    </div>
  );
}
