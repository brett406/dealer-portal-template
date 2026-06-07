"use client";

import { useEffect, useState } from "react";
import { listImageAssets, type PickerAsset } from "./media-picker-actions";
import "./cms-edit.css";

/**
 * Modal that lets an editor pick an image from the media library. Used by the
 * inline image editor (EditableFieldClient) so `image` fields choose from
 * uploaded media instead of pasting a raw URL.
 */
export function MediaPicker({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listImageAssets()
      .then((a) => setAssets(a))
      .catch(() => setError("Could not load media library"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="cms-picker-overlay" onClick={onClose} role="presentation">
      <div className="cms-picker" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Media library">
        <div className="cms-picker-head">
          <strong>Media library</strong>
          <button type="button" className="cms-btn" onClick={onClose}>✕</button>
        </div>
        {loading && <p className="cms-picker-msg">Loading…</p>}
        {error && <p className="cms-picker-msg cms-editing-error">{error}</p>}
        {!loading && !error && assets.length === 0 && (
          <p className="cms-picker-msg">No images yet. Upload some in Admin → Media.</p>
        )}
        {!loading && !error && assets.length > 0 && (
          <div className="cms-picker-grid">
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                className="cms-picker-item"
                title={a.name}
                onClick={() => onSelect(a.url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
