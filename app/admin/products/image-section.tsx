"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  addProductImage,
  deleteProductImage,
  setPrimaryImage,
  reorderImages,
} from "./actions";
import "./products.css";

type ProductImage = {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export function ImageSection({
  productId,
  images,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductImage | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLInputElement>(null);

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const uploadFd = new FormData();
      uploadFd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: uploadFd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        setUploading(false);
        return;
      }

      const imgFd = new FormData();
      imgFd.set("url", data.url);
      imgFd.set("altText", altRef.current?.value?.trim() ?? "");

      startTransition(async () => {
        const result = await addProductImage(productId, imgFd);
        if (result.error) setError(result.error);
        else {
          if (fileRef.current) fileRef.current.value = "";
          if (altRef.current) altRef.current.value = "";
        }
      });
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(img: ProductImage) {
    setError(null);
    startTransition(async () => {
      const result = await deleteProductImage(img.id);
      if (result.error) setError(result.error);
      setDeleteTarget(null);
    });
  }

  function handleSetPrimary(img: ProductImage) {
    startTransition(async () => {
      const result = await setPrimaryImage(img.id);
      if (result.error) setError(result.error);
    });
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) return;

    const reordered = [...images];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    const newIds = reordered.map((img) => img.id);
    startTransition(async () => {
      await reorderImages(productId, newIds);
    });

    setDragIdx(null);
  }

  return (
    <div className="prod-edit-section">
      <h2>Images</h2>

      {error && <div className="status-message status-error">{error}</div>}

      {images.length > 0 && (
        <div className="prod-image-gallery">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className={`prod-image-card ${img.isPrimary ? "is-primary" : ""}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
            >
              {img.isPrimary && <span className="prod-image-primary-badge">Primary</span>}
              <img src={img.url} alt={img.altText ?? ""} />
              <div className="prod-image-actions">
                {!img.isPrimary && (
                  <button
                    onClick={() => handleSetPrimary(img)}
                    disabled={isPending}
                    title="Set as primary"
                  >
                    ★
                  </button>
                )}
                <button
                  onClick={() => { setError(null); setDeleteTarget(img); }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
          No images yet. Add one below.
        </p>
      )}

      <div className="prod-image-upload">
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-text-muted)", display: "block", marginBottom: "0.25rem" }}>
            Image File
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
            style={{ fontSize: "0.85rem" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-text-muted)", display: "block", marginBottom: "0.25rem" }}>
            Alt Text
          </label>
          <input ref={altRef} type="text" placeholder="Optional description" />
        </div>
        <Button size="sm" onClick={handleUpload} loading={uploading || isPending}>
          Upload
        </Button>
      </div>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Image">
        <p>Delete this image? This cannot be undone.</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
