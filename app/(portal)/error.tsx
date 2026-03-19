"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Portal error:", error);
  }, [error]);

  const isAuthError =
    error.message?.includes("session") ||
    error.message?.includes("auth") ||
    error.message?.includes("REDIRECT");

  if (isAuthError) {
    return (
      <div className="container" style={{ padding: "3rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Session Expired</h1>
        <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          Your session has expired. Please log in again.
        </p>
        <Button href="/auth/login">Log In</Button>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "3rem 1rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Something went wrong</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        An error occurred. Please try again.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
        <Button onClick={reset}>Try Again</Button>
        <Button variant="secondary" href="/portal/dashboard">Dashboard</Button>
      </div>
    </div>
  );
}
