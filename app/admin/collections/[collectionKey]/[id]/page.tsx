import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCollectionDef } from "@/lib/content-config";
import { CollectionEditorClient } from "../../collection-editor-client";

export const dynamic = "force-dynamic";

export default async function EditCollectionItemPage({
  params,
}: {
  params: Promise<{ collectionKey: string; id: string }>;
}) {
  const { collectionKey, id } = await params;

  const def = getCollectionDef(collectionKey);
  if (!def) notFound();

  const item = await prisma.collectionItem.findUnique({ where: { id } });
  if (!item || item.collectionKey !== collectionKey) notFound();

  const fields = Object.entries(def.fields).map(([key, f]) => ({
    key,
    type: f.type,
    label: f.label,
    default: f.default,
  }));

  return (
    <div>
      <Link
        href={`/admin/collections/${collectionKey}`}
        style={{ fontSize: "0.85rem", color: "var(--color-primary)", textDecoration: "none" }}
      >
        &larr; Back to {def.label}
      </Link>

      <h1 style={{ marginTop: "0.75rem", marginBottom: "1.5rem" }}>
        Edit {def.label.replace(/s$/, "")}
      </h1>

      <CollectionEditorClient
        collectionKey={collectionKey}
        fields={fields}
        defaultValues={item.payload as Record<string, unknown>}
        defaultSlug={item.slug ?? ""}
        defaultPublished={item.published}
        itemId={item.id}
      />
    </div>
  );
}
