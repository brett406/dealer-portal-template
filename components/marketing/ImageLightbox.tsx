"use client";

import { useState, useEffect, useCallback } from "react";
import "@/app/(portal)/portal/catalog/catalog.css";

type ImageData = { url: string; alt: string };

export function ImageLightbox({ images }: { images: ImageData[] }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const navigate = useCallback((dir: 1 | -1) => {
    setActiveIndex((prev) => (prev + dir + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "ArrowLeft") navigate(-1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen, navigate]);

  if (images.length === 0) return null;

  return (
    <>
      <img
        src={images[0].url}
        alt={images[0].alt}
        style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: "var(--radius-lg)", background: "var(--color-surface)", cursor: "zoom-in" }}
        onClick={() => { setActiveIndex(0); setLightboxOpen(true); }}
      />
      {images.length > 1 && (
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
          {images.slice(1).map((img, idx) => (
            <img
              key={idx}
              src={img.url}
              alt={img.alt}
              style={{ width: "64px", height: "64px", objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", cursor: "zoom-in" }}
              onClick={() => { setActiveIndex(idx + 1); setLightboxOpen(true); }}
            />
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div className="lightbox-overlay" onClick={() => setLightboxOpen(false)}>
          <button className="lightbox-close" onClick={() => setLightboxOpen(false)}>&times;</button>
          {images.length > 1 && (
            <>
              <button className="lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); navigate(-1); }}>&lsaquo;</button>
              <button className="lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); navigate(1); }}>&rsaquo;</button>
            </>
          )}
          <img
            src={images[activeIndex].url}
            alt={images[activeIndex].alt}
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
