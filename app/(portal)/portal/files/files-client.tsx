"use client";

import { useState } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
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

export function FilesClient({ folders, assets }: { folders: Folder[]; assets: Asset[] }) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); // null = All Files
  const [query, setQuery] = useState("");

  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const q = query.trim().toLowerCase();

  const visibleAssets = assets
    .filter((a) => (selectedFolderId === null ? true : a.folderId === selectedFolderId))
    .filter((a) =>
      q === ""
        ? true
        : (a.title || a.originalName).toLowerCase().includes(q) ||
          a.originalName.toLowerCase().includes(q),
    );

  const rows: AssetRow[] = visibleAssets.map((a) => ({
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
          <button
            type="button"
            className={`files-folder-item ${selectedFolderId === null ? "is-active" : ""}`}
            onClick={() => setSelectedFolderId(null)}
          >
            <svg className="files-folder-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h16v2H4z" />
            </svg>
            <span className="files-folder-name">All Files</span>
            <span className="files-folder-count">{assets.length}</span>
          </button>

          {folders.map((folder) => (
            <button
              type="button"
              key={folder.id}
              className={`files-folder-item ${selectedFolderId === folder.id ? "is-active" : ""}`}
              onClick={() => setSelectedFolderId(folder.id)}
            >
              <FolderGlyph color={folderColorHex(folder.accentColor)} />
              <span className="files-folder-name" title={folder.name}>
                {folder.name}
              </span>
              <span className="files-folder-count">{folder.fileCount}</span>
            </button>
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search files"
          />
        </div>

        {rows.length === 0 ? (
          <div className="files-empty">
            <p>
              {q
                ? "No files match your search."
                : selectedFolder
                  ? `No files in “${selectedFolder.name}.”`
                  : "No files available yet."}
            </p>
          </div>
        ) : (
          <Table columns={columns} data={rows} emptyMessage="No files found." />
        )}
      </section>
    </div>
  );
}
