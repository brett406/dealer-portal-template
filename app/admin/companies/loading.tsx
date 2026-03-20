import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function CompaniesLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton height="32px" width="180px" />
        <Skeleton height="38px" width="140px" />
      </div>
      <Skeleton height="38px" width="250px" />
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
