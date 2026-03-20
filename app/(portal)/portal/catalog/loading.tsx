import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function CatalogLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <Skeleton height="32px" width="160px" />
      <div style={{ display: "flex", gap: "12px" }}>
        <Skeleton height="40px" />
        <Skeleton height="40px" width="150px" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px" }}>
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
      </div>
    </div>
  );
}
