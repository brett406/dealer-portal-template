"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { buildPageUrl, type PageMeta } from "@/lib/pagination";
import { folderColorHex } from "@/lib/folder-colors";
import { fileBadge, fileExtension, isPreviewableImage } from "@/lib/file-icons";
import "./files.css";

type Folder = {
  id: string;
  name: string;
  accentColor: string | null;
  sortOrder: number;
  fileCount: number;
};

type Asset = {
  id: string;
  filename: string;
  originalName: string;
  title: string | null;
  mimeType: string;
  size: number;
  folderId: string | null;
  createdAt: string;
};

type AssetRow = Asset & { name: string; type: string };

const BASE_PATH = "/portal/files";

// Auth-gated download route (never the ungated /uploads/... static path).
function downloadHref(filename: string) {
  return `/api/uploads/${encodeURIComponent(filename)}?download=1`;
}
function thumbHref(filename: string) {
  return `/api/uploads/${encodeURIComponent(filename)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function FolderGlyph({ color }: { color: string }) {
  return (
    <svg className="files-folder-icon" viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
    </svg>
  );
}

export function FilesClient({
  folders,
  assets,
  libraryTotal,
  selectedFolderId,
  query,
  pageMeta,
}: {
  folders: Folder[];
  assets: Asset[];
  libraryTotal: number;
  selectedFolderId: string | null;
  query: string;
  pageMeta: PageMeta;
}) {
  const router = useRouter();
  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null;

  // Folder + search + page all live in the URL so the server returns one
  // paginated, folder-scoped slice. Search runs server-side over the whole
  // library, not just the current page.
  const folderHref = (folderId: string | null) =>
    buildPageUrl(BASE_PATH, { folder: folderId ?? undefined, q: query || undefined }, 1);

  // Debounced search: push ?q= (resetting to page 1) ~350ms after typing stops.
  const [search, setSearch] = useState(query);
  const committedQuery = useRef(query);

  // Keep the input in sync when the URL query changes outside of typing
  // (browser back/forward, or a folder link that carries q). Without this the
  // box could show stale text that no longer matches the results.
  useEffect(() => {
    setSearch(query);
    committedQuery.current = query;
  }, [query]);

  useEffect(() => {
    if (search === committedQuery.current) return;
    const t = setTimeout(() => {
      committedQuery.current = search;
      router.push(
        buildPageUrl(BASE_PATH, { folder: selectedFolderId ?? undefined, q: search.trim() || undefined }, 1),
      );
    }, 350);
    return () => clearTimeout(t);
  }, [search, selectedFolderId, router]);

  const rows: AssetRow[] = assets.map((a) => ({
    ...a,
    name: a.title || a.originalName,
    type: fileExtension(a.originalName) || a.mimeType,
  }));

  const columns: TableColumn<AssetRow>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (row) => {
        const badge = fileBadge(row.mimeType, row.originalName);
        return (
          <div className="files-name">
            {isPreviewableImage(row.mimeType, row.originalName) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="files-thumb" src={thumbHref(row.filename)} alt="" loading="lazy" />
            ) : (
              <span className={`files-type-chip tone-${badge.tone}`}>{badge.label}</span>
            )}
            <span className="files-name-text" title={row.originalName}>
              {row.title || row.originalName}
            </span>
          </div>
        );
      },
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (row) => <span className="files-type-label">{row.type || "—"}</span>,
    },
    {
      key: "createdAt",
      label: "Uploaded",
      sortable: true,
      render: (row) => <span className="files-uploaded">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="files-row-actions">
          <a
            className="btn btn-primary btn-sm"
            href={downloadHref(row.filename)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="files-layout">
      {/* ── Folder sidebar (read-only) ── */}
      <aside className="files-sidebar">
        <div className="files-sidebar-heading">Folders</div>
        <div className="files-folder-list">
          <Link
            href={folderHref(null)}
            className={`files-folder-item ${selectedFolderId === null ? "is-active" : ""}`}
          >
            <svg className="files-folder-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h16v2H4z" />
            </svg>
            <span className="files-folder-name">All Files</span>
            <span className="files-folder-count">{libraryTotal}</span>
          </Link>

          {folders.map((folder) => (
            <Link
              href={folderHref(folder.id)}
              key={folder.id}
              className={`files-folder-item ${selectedFolderId === folder.id ? "is-active" : ""}`}
            >
              <FolderGlyph color={folderColorHex(folder.accentColor)} />
              <span className="files-folder-name" title={folder.name}>
                {folder.name}
              </span>
              <span className="files-folder-count">{folder.fileCount}</span>
            </Link>
          ))}
        </div>
      </aside>

      {/* ── Main file area ── */}
      <section className="files-main">
        <div className="files-toolbar">
          <h2 className="files-current-title">{selectedFolder ? selectedFolder.name : "All Files"}</h2>
          <input
            type="search"
            className="files-search"
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search files"
          />
        </div>

        {rows.length === 0 ? (
          <div className="files-empty">
            <p>
              {query
                ? "No files match your search."
                : selectedFolder
                  ? `No files in “${selectedFolder.name}.”`
                  : "No files available yet."}
            </p>
          </div>
        ) : (
          <>
            <Table columns={columns} data={rows} emptyMessage="No files found." />
            <Pagination
              meta={pageMeta}
              basePath={BASE_PATH}
              filters={{ folder: selectedFolderId ?? undefined, q: query || undefined }}
              label="files"
            />
          </>
        )}
      </section>
    </div>
  );
}
