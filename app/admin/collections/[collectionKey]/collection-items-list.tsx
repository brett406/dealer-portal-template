"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { toggleCollectionItemPublished } from "../actions";
import "@/app/admin/pages/pages.css";

type Item = {
  id: string;
  slug: string;
  published: boolean;
  sortOrder: number;
  payload: Record<string, string>;
  createdAt: string;
};

export function CollectionItemsList({
  items,
  collectionKey,
}: {
  items: Item[];
  collectionKey: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(itemId: string) {
    startTransition(async () => {
      await toggleCollectionItemPublished(itemId, collectionKey);
    });
  }

  if (items.length === 0) {
    return (
      <p style={{ color: "var(--color-text-muted)", marginTop: "1.5rem" }}>
        No items yet. Click "Add Post" to create one.
      </p>
    );
  }

  return (
    <div className="pages-list" style={{ marginTop: "1.5rem" }}>
      {items.map((item) => (
        <div key={item.id} className="page-card">
          <div className="page-card-info">
            <h3>
              <Link
                href={`/admin/collections/${collectionKey}/${item.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {item.payload.title || "(Untitled)"}
              </Link>
            </h3>
            <p>
              /{item.slug}
              {item.payload.date && ` · ${item.payload.date}`}
              {" · "}
              <span style={{ color: item.published ? "var(--color-success)" : "var(--color-text-muted)" }}>
                {item.published ? "Published" : "Draft"}
              </span>
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggle(item.id)}
              disabled={isPending}
            >
              {item.published ? "Unpublish" : "Publish"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              href={`/admin/collections/${collectionKey}/${item.id}`}
            >
              Edit
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
