"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

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
        background: "#fff",
        border: "1px solid var(--color-border, #e2e8f0)",
        borderRadius: "8px",
        padding: "2.5rem",
        maxWidth: "480px",
        width: "100%",
        textAlign: "center",
      }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Something went wrong</h1>
        <p style={{ color: "var(--color-text-muted, #64748b)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <Button onClick={reset}>Try Again</Button>
          <Button variant="secondary" href="/">Go Home</Button>
        </div>
      </div>
    </div>
  );
}
