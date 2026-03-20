import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function PortalOrdersLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <Skeleton height="32px" width="160px" />
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}
