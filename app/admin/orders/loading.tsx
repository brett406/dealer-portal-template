import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function OrdersLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <Skeleton height="32px" width="160px" />
      <div style={{ display: "flex", gap: "12px" }}>
        <Skeleton height="38px" width="200px" />
        <Skeleton height="38px" width="150px" />
        <Skeleton height="38px" width="150px" />
      </div>
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}
