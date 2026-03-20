"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { createMediaAsset, deleteMedia } from "./actions";
import "./media.css";

type Asset = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  createdAt: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaClient({ assets }: { assets: Asset[] }) {
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      // Upload file via API route (avoids server action body size limits)
      const fd = new FormData();
      fd.set("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Upload failed");
        setUploading(false);
        return;
      }

      // Create Asset record via server action (lightweight, metadata only)
      startTransition(async () => {
        const result = await createMediaAsset({
          url: json.url,
          filename: json.filename,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
        });
        if (result.error) setError(result.error);
        if (fileRef.current) fileRef.current.value = "";
        setUploading(false);
      });
    } catch {
      setError("Upload failed — check your connection and try again");
      setUploading(false);
    }
  }

  function handleDelete(asset: Asset) {
    setError(null);
    startTransition(async () => {
      const result = await deleteMedia(asset.id);
      if (result.error) setError(result.error);
      setDeleteTarget(null);
    });
  }

  function handleCopyUrl(asset: Asset) {
    const url = `${window.location.origin}${asset.storagePath}`;
    navigator.clipboard.writeText(url);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <>
      <div className="media-toolbar">
        <div className="media-upload-area">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
            aria-label="Choose file to upload"
          />
          <Button size="sm" onClick={handleUpload} loading={uploading || isPending}>
            Upload
          </Button>
        </div>
        <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
          {assets.length} file{assets.length !== 1 ? "s" : ""}
        </span>
      </div>

      {error && <div className="status-message status-error">{error}</div>}

      {assets.length === 0 ? (
        <div className="media-empty">
          <p>No media uploaded yet.</p>
          <p>Upload images to use in products, pages, and settings.</p>
        </div>
      ) : (
        <div className="media-grid">
          {assets.map((asset) => (
            <div key={asset.id} className="media-card">
              {asset.mimeType.startsWith("image/") ? (
                <img src={asset.storagePath} alt={asset.originalName} />
              ) : (
                <div style={{ height: "140px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                  {asset.mimeType}
                </div>
              )}
              <div className="media-card-body">
                <div className="media-card-name" title={asset.originalName}>
                  {asset.originalName}
                </div>
                <div className="media-card-meta">
                  {formatSize(asset.size)} · {new Date(asset.createdAt).toLocaleDateString()}
                </div>
                <div className="media-card-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyUrl(asset)}
                  >
                    {copiedId === asset.id ? <span className="media-copied">Copied!</span> : "Copy URL"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => { setError(null); setDeleteTarget(asset); }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete File">
        <p>Delete <strong>{deleteTarget?.originalName}</strong>? This cannot be undone.</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </div>
      </Modal>
    </>
  );
}
