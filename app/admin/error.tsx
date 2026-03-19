"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div style={{ padding: "3rem 2rem", maxWidth: "560px" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Something went wrong</h1>
      <p style={{ color: "var(--color-text-muted, #64748b)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        An error occurred while processing your request. Your data has not been changed.
      </p>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <Button onClick={reset}>Try Again</Button>
        <Button variant="secondary" href="/admin">Back to Dashboard</Button>
      </div>
    </div>
  );
}
