import { prisma } from "@/lib/prisma";
import { getCollectionKeys } from "@/lib/content-config";
import { Button } from "@/components/ui/Button";
import "@/app/admin/pages/pages.css";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  const collectionKeys = getCollectionKeys();

  const counts = await prisma.collectionItem.groupBy({
    by: ["collectionKey"],
    _count: true,
  });

  const countMap = new Map(counts.map((c) => [c.collectionKey, c._count]));

  return (
    <div>
      <h1>Collections</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Manage blog posts and other content collections.
      </p>

      <div className="pages-list">
        {collectionKeys.map((col) => (
          <div key={col.key} className="page-card">
            <div className="page-card-info">
              <h3>{col.label}</h3>
              <p>{countMap.get(col.key) ?? 0} items</p>
            </div>
            <Button variant="secondary" size="sm" href={`/admin/collections/${col.key}`}>
              Manage
            </Button>
          </div>
        ))}

        {collectionKeys.length === 0 && (
          <p style={{ color: "var(--color-text-muted)" }}>
            No collections defined in content.config.yaml.
          </p>
        )}
      </div>
    </div>
  );
}
