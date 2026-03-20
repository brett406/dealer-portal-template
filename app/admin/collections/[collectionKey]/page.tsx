import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCollectionDef } from "@/lib/content-config";
import { Button } from "@/components/ui/Button";
import { CollectionItemsList } from "./collection-items-list";
import "@/app/admin/pages/pages.css";

export const dynamic = "force-dynamic";

export default async function CollectionItemsPage({
  params,
}: {
  params: Promise<{ collectionKey: string }>;
}) {
  const { collectionKey } = await params;

  const def = getCollectionDef(collectionKey);
  if (!def) notFound();

  const items = await prisma.collectionItem.findMany({
    where: { collectionKey },
    orderBy: { sortOrder: "asc" },
  });

  const data = items.map((item) => ({
    id: item.id,
    slug: item.slug ?? "",
    published: item.published,
    sortOrder: item.sortOrder,
    payload: item.payload as Record<string, string>,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <div>
      <Link href="/admin/collections" style={{ fontSize: "0.85rem", color: "var(--color-primary)", textDecoration: "none" }}>
        &larr; Collections
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem" }}>
        <div>
          <h1>{def.label}</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            {data.length} item{data.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button href={`/admin/collections/${collectionKey}/new`}>
          Add Post
        </Button>
      </div>

      <CollectionItemsList items={data} collectionKey={collectionKey} />
    </div>
  );
}
