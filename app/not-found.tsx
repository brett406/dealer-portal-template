import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "2rem",
      background: "var(--color-surface, #f8fafc)",
    }}>
      <div style={{
        textAlign: "center",
        maxWidth: "480px",
      }}>
        <h1 style={{ fontSize: "4rem", fontWeight: 700, color: "var(--color-text-muted, #94a3b8)", marginBottom: "0.5rem" }}>
          404
        </h1>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Page Not Found</h2>
        <p style={{ color: "var(--color-text-muted, #64748b)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "0.6rem 1.5rem",
            background: "var(--color-primary, #2563eb)",
            color: "#fff",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
