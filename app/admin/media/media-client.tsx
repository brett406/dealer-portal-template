"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table, type TableColumn } from "@/components/ui/Table";
import {
  createFolder,
  renameFolder,
  setFolderColor,
  deleteFolder,
  reorderFolders,
  moveAssets,
  createMediaAsset,
  deleteMedia,
} from "./actions";
import {
  FOLDER_COLORS,
  FOLDER_COLOR_KEYS,
  DEFAULT_FOLDER_COLOR,
  folderColorHex,
  type FolderColorKey,
} from "@/lib/folder-colors";
import { fileBadge, fileExtension, isPreviewableImage } from "@/lib/file-icons";
import "./media.css";

type Folder = {
  id: string;
  name: string;
  slug: string;
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
  storagePath: string;
  folderId: string | null;
  createdAt: string;
};

type AssetRow = Asset & { name: string; type: string };

// Always link downloads through the auth-gated API route, never /uploads/...
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

function asColorKey(value: string | null): FolderColorKey {
  return (FOLDER_COLOR_KEYS as string[]).includes(value ?? "")
    ? (value as FolderColorKey)
    : DEFAULT_FOLDER_COLOR;
}

function FolderGlyph({ color }: { color: string }) {
  return (
    <svg className="media-folder-icon" viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
    </svg>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: FolderColorKey;
  onChange: (key: FolderColorKey) => void;
}) {
  return (
    <>
      <span className="media-color-field-label">Accent color</span>
      <div className="media-color-picker" role="radiogroup" aria-label="Accent color">
        {FOLDER_COLOR_KEYS.map((key) => (
          <button
            type="button"
            key={key}
            role="radio"
            aria-checked={value === key}
            aria-label={FOLDER_COLORS[key].label}
            className={`media-swatch ${value === key ? "is-selected" : ""}`}
            style={{ background: FOLDER_COLORS[key].hex }}
            onClick={() => onChange(key)}
          />
        ))}
      </div>
    </>
  );
}

export function MediaClient({ folders, assets }: { folders: Folder[]; assets: Asset[] }) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); // null = All Files
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showNew, setShowNew] = useState(false);
  const [newColor, setNewColor] = useState<FolderColorKey>(DEFAULT_FOLDER_COLOR);
  const [editTarget, setEditTarget] = useState<Folder | null>(null);
  const [editColor, setEditColor] = useState<FolderColorKey>(DEFAULT_FOLDER_COLOR);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [moveTarget, setMoveTarget] = useState<Asset | null>(null);
  const [moveChoice, setMoveChoice] = useState<string | null>(null);
  const [deleteAssetTarget, setDeleteAssetTarget] = useState<Asset | null>(null);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const visibleAssets =
    selectedFolderId === null ? assets : assets.filter((a) => a.folderId === selectedFolderId);

  const rows: AssetRow[] = visibleAssets.map((a) => ({
    ...a,
    name: a.title || a.originalName,
    type: fileExtension(a.originalName) || a.mimeType,
  }));

  function clearMessages() {
    setError(null);
    setNotice(null);
  }

  // ── Upload ──────────────────────────────────────────────
  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    clearMessages();
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Upload failed");
        setUploading(false);
        return;
      }
      startTransition(async () => {
        const result = await createMediaAsset({
          url: json.url,
          filename: json.filename,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          folderId: selectedFolderId,
        });
        if (result.error) setError(result.error);
        else setNotice("File uploaded");
        if (fileRef.current) fileRef.current.value = "";
        setUploading(false);
      });
    } catch {
      setError("Upload failed — check your connection and try again");
      setUploading(false);
    }
  }

  // ── Folder actions ──────────────────────────────────────
  function handleCreateFolder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) {
      setError("Folder name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createFolder({ name, accentColor: newColor });
      if (r.error) setError(r.error);
      else {
        setShowNew(false);
        setNewColor(DEFAULT_FOLDER_COLOR);
        setNotice("Folder created");
      }
    });
  }

  function handleEditFolder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = editTarget;
    if (!target) return;
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) {
      setError("Folder name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      if (name !== target.name) {
        const r = await renameFolder(target.id, name);
        if (r.error) {
          setError(r.error);
          return;
        }
      }
      if (editColor !== asColorKey(target.accentColor)) {
        const r = await setFolderColor(target.id, editColor);
        if (r.error) {
          setError(r.error);
          return;
        }
      }
      setEditTarget(null);
      setNotice("Folder updated");
    });
  }

  function handleDeleteFolder() {
    const target = deleteFolderTarget;
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteFolder(target.id);
      if (r.error) setError(r.error);
      else {
        if (selectedFolderId === target.id) setSelectedFolderId(null);
        setDeleteFolderTarget(null);
        setNotice("Folder deleted — its files are now unfiled");
      }
    });
  }

  function handleReorder(index: number, dir: -1 | 1) {
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= folders.length) return;
    const ids = folders.map((f) => f.id);
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
    clearMessages();
    startTransition(async () => {
      const r = await reorderFolders(ids);
      if (r.error) setError(r.error);
    });
  }

  // ── Asset actions ───────────────────────────────────────
  function openMove(asset: Asset) {
    clearMessages();
    setMoveChoice(asset.folderId);
    setMoveTarget(asset);
  }

  function handleMove() {
    const target = moveTarget;
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const r = await moveAssets([target.id], moveChoice);
      if (r.error) setError(r.error);
      else {
        setMoveTarget(null);
        setNotice("File moved");
      }
    });
  }

  function handleDeleteAsset() {
    const target = deleteAssetTarget;
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteMedia(target.id);
      if (r.error) setError(r.error);
      else {
        setDeleteAssetTarget(null);
        setNotice("File deleted");
      }
    });
  }

  // ── Table ───────────────────────────────────────────────
  const columns: TableColumn<AssetRow>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (row) => {
        const badge = fileBadge(row.mimeType, row.originalName);
        return (
          <div className="media-file-name">
            {isPreviewableImage(row.mimeType, row.originalName) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="media-thumb" src={thumbHref(row.filename)} alt="" loading="lazy" />
            ) : (
              <span className={`media-type-chip tone-${badge.tone}`}>{badge.label}</span>
            )}
            <span className="media-file-name-text" title={row.originalName}>
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
      render: (row) => <span className="media-type-label">{row.type || "—"}</span>,
    },
    {
      key: "createdAt",
      label: "Uploaded",
      sortable: true,
      render: (row) => <span className="media-uploaded">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="media-row-actions">
          <a
            className="btn btn-ghost btn-sm"
            href={downloadHref(row.filename)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </a>
          <Button type="button" variant="ghost" size="sm" onClick={() => openMove(row)}>
            Move
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              clearMessages();
              setDeleteAssetTarget(row);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      {error && <div className="status-message status-error">{error}</div>}
      {notice && <div className="status-message status-success">{notice}</div>}

      <div className="media-layout">
        {/* ── Folder sidebar ── */}
        <aside className="media-sidebar">
          <div className="media-sidebar-heading">Folders</div>
          <div className="media-folder-list">
            <button
              type="button"
              className={`media-folder-item ${selectedFolderId === null ? "is-active" : ""}`}
              onClick={() => setSelectedFolderId(null)}
            >
              <svg className="media-folder-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h16v2H4z" />
              </svg>
              <span className="media-folder-name">All Files</span>
              <span className="media-folder-count">{assets.length}</span>
            </button>

            {folders.map((folder, index) => (
              <div className="media-folder-row" key={folder.id}>
                <button
                  type="button"
                  className={`media-folder-item ${selectedFolderId === folder.id ? "is-active" : ""}`}
                  onClick={() => setSelectedFolderId(folder.id)}
                >
                  <FolderGlyph color={folderColorHex(folder.accentColor)} />
                  <span className="media-folder-name" title={folder.name}>
                    {folder.name}
                  </span>
                  <span className="media-folder-count">{folder.fileCount}</span>
                </button>
                <div className="media-folder-controls">
                  <button
                    type="button"
                    className="media-icon-btn"
                    aria-label={`Move ${folder.name} up`}
                    disabled={index === 0 || isPending}
                    onClick={() => handleReorder(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="media-icon-btn"
                    aria-label={`Move ${folder.name} down`}
                    disabled={index === folders.length - 1 || isPending}
                    onClick={() => handleReorder(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="media-icon-btn"
                    aria-label={`Edit ${folder.name}`}
                    onClick={() => {
                      clearMessages();
                      setEditColor(asColorKey(folder.accentColor));
                      setEditTarget(folder);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="media-icon-btn"
                    aria-label={`Delete ${folder.name}`}
                    onClick={() => {
                      clearMessages();
                      setDeleteFolderTarget(folder);
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Button
            className="media-sidebar-newbtn"
            variant="secondary"
            size="sm"
            onClick={() => {
              clearMessages();
              setNewColor(DEFAULT_FOLDER_COLOR);
              setShowNew(true);
            }}
          >
            + New Folder
          </Button>
        </aside>

        {/* ── Main file area ── */}
        <section className="media-main">
          <div className="media-toolbar">
            <div className="media-upload-area">
              <input
                ref={fileRef}
                type="file"
                aria-label="Choose file to upload"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.svg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.dwg,.dxf,.step,.stp,.iges,.igs,.mp4,.mov,.webm"
              />
              <Button size="sm" onClick={handleUpload} loading={uploading || isPending}>
                {selectedFolder ? `Upload to ${selectedFolder.name}` : "Upload File"}
              </Button>
            </div>
            <div className="media-toolbar-actions">
              <span className="media-count">
                {visibleAssets.length} file{visibleAssets.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  clearMessages();
                  setNewColor(DEFAULT_FOLDER_COLOR);
                  setShowNew(true);
                }}
              >
                + New Folder
              </Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="media-empty">
              <p>No files {selectedFolder ? `in “${selectedFolder.name}”` : "yet"}.</p>
              <p>Upload files and organize them into folders for your dealers.</p>
            </div>
          ) : (
            <Table columns={columns} data={rows} emptyMessage="No files found." />
          )}
        </section>
      </div>

      {/* ── New Folder modal ── */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Folder">
        <form onSubmit={handleCreateFolder}>
          <Input label="Folder name" name="name" required placeholder="e.g. Brochures" />
          <ColorPicker value={newColor} onChange={setNewColor} />
          {error && <div className="status-message status-error">{error}</div>}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Create folder
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Folder modal (rename + recolor) ── */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Folder">
        {editTarget && (
          <form onSubmit={handleEditFolder} key={editTarget.id}>
            <Input label="Folder name" name="name" required defaultValue={editTarget.name} />
            <ColorPicker value={editColor} onChange={setEditColor} />
            {error && <div className="status-message status-error">{error}</div>}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={isPending}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Delete Folder modal ── */}
      <Modal
        open={!!deleteFolderTarget}
        onClose={() => setDeleteFolderTarget(null)}
        title="Delete Folder"
      >
        <p>
          Delete <strong>{deleteFolderTarget?.name}</strong>?
        </p>
        <p className="modal-note">
          The files inside are <strong>not</strong> deleted — they become unfiled and stay
          available under “All Files.”
        </p>
        {error && <div className="status-message status-error">{error}</div>}
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteFolderTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={isPending} onClick={handleDeleteFolder}>
            Delete folder
          </Button>
        </div>
      </Modal>

      {/* ── Move file modal ── */}
      <Modal open={!!moveTarget} onClose={() => setMoveTarget(null)} title="Move to Folder">
        {moveTarget && (
          <>
            <p className="modal-note">
              Moving <strong>{moveTarget.originalName}</strong>
            </p>
            <div className="media-move-list">
              <label className="media-move-option">
                <input
                  type="radio"
                  name="move-folder"
                  checked={moveChoice === null}
                  onChange={() => setMoveChoice(null)}
                />
                <span>No folder (unfiled)</span>
              </label>
              {folders.map((folder) => (
                <label className="media-move-option" key={folder.id}>
                  <input
                    type="radio"
                    name="move-folder"
                    checked={moveChoice === folder.id}
                    onChange={() => setMoveChoice(folder.id)}
                  />
                  <FolderGlyph color={folderColorHex(folder.accentColor)} />
                  <span>{folder.name}</span>
                </label>
              ))}
            </div>
            {error && <div className="status-message status-error">{error}</div>}
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setMoveTarget(null)}>
                Cancel
              </Button>
              <Button loading={isPending} onClick={handleMove}>
                Move
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Delete file modal ── */}
      <Modal
        open={!!deleteAssetTarget}
        onClose={() => setDeleteAssetTarget(null)}
        title="Delete File"
      >
        <p>
          Delete <strong>{deleteAssetTarget?.originalName}</strong>? This cannot be undone.
        </p>
        {error && <div className="status-message status-error">{error}</div>}
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteAssetTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={isPending} onClick={handleDeleteAsset}>
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
