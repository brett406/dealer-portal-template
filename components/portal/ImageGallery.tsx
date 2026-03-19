"use client";

import { useState } from "react";
import NextImage from "next/image";
import "@/app/(portal)/portal/catalog/catalog.css";

type Image = { id: string; url: string; altText: string | null; isPrimary: boolean };

export function ImageGallery({ images, productName }: { images: Image[]; productName: string }) {
  const primary = images.find((img) => img.isPrimary) ?? images[0];
  const [activeId, setActiveId] = useState(primary?.id ?? "");

  const activeImage = images.find((img) => img.id === activeId) ?? primary;

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
    </div>
  );
}
