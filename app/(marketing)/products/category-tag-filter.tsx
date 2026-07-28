"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type CategoryCard = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  tags: string[];
  imageUrl?: string | null;
  imageAlt?: string | null;
};

export function CategoryTagFilter({
  categories,
  availableTags,
}: {
  categories: CategoryCard[];
  availableTags: string[];
}) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const visible = useMemo(
    () => (activeTag ? categories.filter((c) => c.tags.includes(activeTag)) : categories),
    [categories, activeTag],
  );

  return (
    <>
      {availableTags.length > 0 && (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "1rem 0 1.5rem" }}>
          <Chip active={activeTag === null} onClick={() => setActiveTag(null)}>All</Chip>
          {availableTags.map((tag) => (
            <Chip key={tag} active={activeTag === tag} onClick={() => setActiveTag(tag)}>
              {tag}
            </Chip>
          ))}
        </div>
      )}

      <div className="public-catalog-grid">
        {visible.map((cat) => (
          <Link
            key={cat.id}
            href={`/products/${cat.slug}`}
            className="public-category-card"
          >
            <CategoryMedia cat={cat} />

            <div className="category-card-footer">
              <div className="category-card-body">
                <div className="category-card-name">{cat.name}</div>
                <div className="category-card-count">
                  {cat.productCount} {cat.productCount === 1 ? "product" : "products"}
                </div>
              </div>
              <div className="category-card-arrow">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7 4L13 10L7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {visible.length === 0 && (
        <p style={{ color: "var(--color-text-muted)", marginTop: "1rem" }}>
          No categories match that filter.
        </p>
      )}
    </>
  );
}

/* A missing or corrupt image file must never render as a broken-image icon —
   it reads as a broken site. Fall back to the placeholder on load failure. */
function CategoryMedia({ cat }: { cat: CategoryCard }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(cat.imageUrl) && !failed;

  return (
    <div className="category-card-media">
      {showImage ? (
        <Image
          src={cat.imageUrl as string}
          alt={cat.imageAlt || cat.name}
          width={480}
          height={320}
          className="category-card-img"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="category-card-placeholder" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "0.3rem 0.75rem",
        borderRadius: "999px",
        border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
        background: active ? "var(--color-primary)" : "var(--color-bg)",
        color: active ? "#ffffff" : "var(--color-text)",
        fontSize: "0.85rem",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
