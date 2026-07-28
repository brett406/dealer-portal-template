import { describe, it, expect, afterEach } from "vitest";
import { resolveClientIp, clientIpFromRequest, clientIpFromHeaders } from "@/lib/client-ip";
import { extractClientIp } from "@/lib/auth-security";

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/auth/callback/credentials", { headers });
}

/** Stands in for next/headers' ReadonlyHeaders, which server actions receive. */
function headerStore(headers: Record<string, string>) {
  return { get: (name: string) => headers[name.toLowerCase()] ?? null };
}

const ORIGINAL_HOPS = process.env.TRUSTED_PROXY_HOPS;

afterEach(() => {
  if (ORIGINAL_HOPS === undefined) delete process.env.TRUSTED_PROXY_HOPS;
  else process.env.TRUSTED_PROXY_HOPS = ORIGINAL_HOPS;
});

describe("resolveClientIp", () => {
  // Proxies APPEND the peer they saw, so the left-most entry is whatever the
  // caller typed. Reading it let an attacker mint a fresh rate-limit bucket per
  // request — defeating login, registration, password-reset and public-form limits.
  it("ignores a client-supplied entry to the left of the proxy chain", () => {
    expect(resolveClientIp("1.2.3.4, 203.0.113.9", null)).toBe("203.0.113.9");
  });

  it("returns the same bucket no matter what the attacker prepends", () => {
    const a = resolveClientIp("9.9.9.9, 203.0.113.9", null);
    const b = resolveClientIp("8.8.8.8, 203.0.113.9", null);
    const c = resolveClientIp("1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.9", null);
    expect(new Set([a, b, c]).size).toBe(1);
    expect(a).toBe("203.0.113.9");
  });

  it("uses the only entry when there is a single hop", () => {
    expect(resolveClientIp("203.0.113.9", null)).toBe("203.0.113.9");
  });

  it("trims whitespace and skips empty entries", () => {
    expect(resolveClientIp("1.1.1.1,  203.0.113.9  ,", null)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip", () => {
    expect(resolveClientIp(null, "203.0.113.5")).toBe("203.0.113.5");
    expect(resolveClientIp("", " 203.0.113.5 ")).toBe("203.0.113.5");
  });

  it("reports unknown when nothing identifies the caller", () => {
    expect(resolveClientIp(null, null)).toBe("unknown");
    expect(resolveClientIp("   ", undefined)).toBe("unknown");
  });

  // Behind a CDN there are two appending proxies, so the client sits one
  // further left. Getting this wrong collapses every visitor into one bucket.
  it("honours TRUSTED_PROXY_HOPS for a CDN in front of the platform edge", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(resolveClientIp("1.2.3.4, 203.0.113.9, 10.0.0.1", null)).toBe("203.0.113.9");
  });

  it("never reads past the start of a short chain", () => {
    process.env.TRUSTED_PROXY_HOPS = "5";
    expect(resolveClientIp("203.0.113.9", null)).toBe("203.0.113.9");
  });

  it("ignores a nonsensical hop count rather than failing open", () => {
    for (const bad of ["0", "-3", "abc", ""]) {
      process.env.TRUSTED_PROXY_HOPS = bad;
      expect(resolveClientIp("1.2.3.4, 203.0.113.9", null)).toBe("203.0.113.9");
    }
  });
});

describe("call-site wrappers", () => {
  // Six call sites each had their own copy of the vulnerable parsing, so both
  // shapes must resolve identically or the fix leaks somewhere.
  it("agree between Request and headers() callers", () => {
    const forwarded = "1.2.3.4, 203.0.113.9";
    expect(clientIpFromRequest(reqWith({ "x-forwarded-for": forwarded }))).toBe("203.0.113.9");
    expect(clientIpFromHeaders(headerStore({ "x-forwarded-for": forwarded }))).toBe("203.0.113.9");
  });

  it("keeps extractClientIp working for existing login callers", () => {
    expect(extractClientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(extractClientIp(reqWith({ "x-real-ip": "203.0.113.5" }))).toBe("203.0.113.5");
    expect(extractClientIp(reqWith({}))).toBe("unknown");
  });
});
