import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";

export default function AdminDashboardLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Skeleton height="32px" width="200px" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={1} />)}
      </div>
      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}
