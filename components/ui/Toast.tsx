"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import "./toast.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  autoDismiss: boolean;
};

type ToastContextValue = {
  addToast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = String(++nextId);
    const autoDismiss = variant !== "error";
    setToasts((prev) => [...prev, { id, message, variant, autoDismiss }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ctx: ToastContextValue = {
    addToast,
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error"),
    warning: (msg) => addToast(msg, "warning"),
    info: (msg) => addToast(msg, "info"),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Toast Item ──────────────────────────────────────────────────────────────

const ICONS: Record<ToastVariant, string> = {
  success: "\u2713",
  error: "\u2717",
  warning: "\u26A0",
  info: "\u2139",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (toast.autoDismiss) {
      timerRef.current = setTimeout(() => {
        setExiting(true);
        setTimeout(onDismiss, 150);
      }, 4000);
    }
    return () => clearTimeout(timerRef.current);
  }, [toast.autoDismiss, onDismiss]);

  function handleDismiss() {
    setExiting(true);
    setTimeout(onDismiss, 150);
  }

  return (
    <div className={`toast toast-${toast.variant} ${exiting ? "toast-exiting" : ""}`}>
      <span className="toast-icon">{ICONS[toast.variant]}</span>
      <span className="toast-body">{toast.message}</span>
      <button type="button" className="toast-dismiss" onClick={handleDismiss} aria-label="Dismiss notification">
        &times;
      </button>
    </div>
  );
}
