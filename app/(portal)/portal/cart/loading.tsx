import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function CartLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <Skeleton height="32px" width="140px" />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}
