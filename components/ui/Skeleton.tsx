export function Skeleton({ width, height, className }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`skeleton ${className || ""}`}
      style={{
        width: width || "100%",
        height: height || "20px",
        background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        borderRadius: "6px",
      }}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ padding: "20px", background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
      <Skeleton height="24px" width="60%" />
      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} height="16px" width={i === lines - 1 ? "40%" : "100%"} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "1px", background: "#e2e8f0" }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`h-${i}`} style={{ padding: "12px 16px", background: "#f8fafc" }}>
            <Skeleton height="14px" width="70%" />
          </div>
        ))}
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={`c-${i}`} style={{ padding: "12px 16px", background: "#fff" }}>
            <Skeleton height="14px" width={`${60 + (i % 3) * 15}%`} />
          </div>
        ))}
      </div>
    </div>
  );
}
