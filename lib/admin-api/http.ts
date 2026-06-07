import { NextResponse } from "next/server";

/**
 * JSON response helpers for the admin API. Every response is shaped
 * `{ ok: boolean, ... }` so callers can branch on one field.
 */
export function apiOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiError(
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}
