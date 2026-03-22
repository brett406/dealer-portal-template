"use client";

import { useState, useCallback, useEffect } from "react";
import NextImage from "next/image";
import "@/app/(portal)/portal/catalog/catalog.css";

type Image = { id: string; url: string; altText: string | null; isPrimary: boolean };

export function ImageGallery({ images, productName }: { images: Image[]; productName: string }) {
  const primary = images.find((img) => img.isPrimary) ?? images[0];
  const [activeId, setActiveId] = useState(primary?.id ?? "");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeImage = images.find((img) => img.id === activeId) ?? primary;
  const activeIndex = images.findIndex((img) => img.id === activeId);

  const navigate = useCallback((dir: 1 | -1) => {
    const next = (activeIndex + dir + images.length) % images.length;
    setActiveId(images[next].id);
  }, [activeIndex, images]);

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

  if (images.length === 0) {
    return (
      <div className="product-gallery">
        <div className="product-card-placeholder" style={{ aspectRatio: "4/3", height: "auto", borderRadius: "8px" }}>
          No Image Available
        </div>
      </div>
    );
  }

  return (
    <div className="product-gallery">
      <NextImage
        src={activeImage?.url ?? ""}
        alt={activeImage?.altText ?? productName}
        width={600}
        height={450}
        className="product-gallery-main"
        style={{ cursor: "zoom-in" }}
        onClick={() => setLightboxOpen(true)}
        priority
      />
      {images.length > 1 && (
        <div className="product-gallery-thumbs">
          {images.map((img) => (
            <NextImage
              key={img.id}
              src={img.url}
              alt={img.altText ?? ""}
              width={80}
              height={80}
              className={`product-gallery-thumb ${img.id === activeId ? "active" : ""}`}
              onClick={() => setActiveId(img.id)}
              loading="lazy"
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
            src={activeImage?.url ?? ""}
            alt={activeImage?.altText ?? productName}
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
