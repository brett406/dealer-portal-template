"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget for public forms.
 *
 * - Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so forms work
 *   unchanged on deployments without keys (verification is fail-open too — see
 *   lib/turnstile.ts).
 * - Uses explicit JS-API rendering (not implicit `.cf-turnstile` scanning) so it
 *   works reliably on client-side navigations, not just full page loads.
 * - Injects a hidden `cf-turnstile-response` input into the enclosing <form>;
 *   the server action reads it via formData.get("cf-turnstile-response").
 * - Tokens are single-use. Pass the form's action state as `resetSignal`; when
 *   its identity changes (i.e. after a submit) the widget resets to issue a
 *   fresh token, so a retry after a validation error isn't blocked by a spent
 *   token.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

function loadScript(): Promise<void> {
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(s);
  });
}

export function TurnstileWidget({ resetSignal }: { resetSignal?: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    const container = containerRef.current;

    loadScript()
      .then(() => {
        if (cancelled || !container || !window.turnstile || widgetIdRef.current) return;
        widgetIdRef.current = window.turnstile.render(container, { sitekey: SITE_KEY });
      })
      .catch(() => {
        // Fail open: no widget renders. The server verifier also fails open, so
        // the form still submits (rate limiting remains in force).
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget already gone */
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  // Reset the spent token after each submission so retries get a fresh one.
  useEffect(() => {
    if (resetSignal && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className="turnstile-widget" style={{ marginBottom: "1rem" }} />;
}
