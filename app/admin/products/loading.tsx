import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function ProductsLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton height="32px" width="160px" />
        <Skeleton height="38px" width="120px" />
      </div>
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}
