import { describe, it, expect } from "vitest";
import { extractClientIp } from "@/lib/auth-security";

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/auth/callback/credentials", { headers });
}

describe("extractClientIp", () => {
  // Proxies APPEND the peer they saw, so the left-most entry is whatever the
  // caller typed. Reading it let an attacker mint a fresh rate-limit bucket per
  // request and brute-force a known dealer email without ever being throttled.
  it("ignores a client-supplied entry to the left of the proxy chain", () => {
    const ip = extractClientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }));
    expect(ip).toBe("203.0.113.9");
  });

  it("returns the same bucket no matter what the attacker prepends", () => {
    const a = extractClientIp(reqWith({ "x-forwarded-for": "9.9.9.9, 203.0.113.9" }));
    const b = extractClientIp(reqWith({ "x-forwarded-for": "8.8.8.8, 203.0.113.9" }));
    expect(a).toBe(b);
  });

  it("uses the only entry when there is a single hop", () => {
    expect(extractClientIp(reqWith({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("trims whitespace and skips empty entries", () => {
    expect(extractClientIp(reqWith({ "x-forwarded-for": "1.1.1.1,  203.0.113.9  ," }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip", () => {
    expect(extractClientIp(reqWith({ "x-real-ip": "203.0.113.5" }))).toBe("203.0.113.5");
  });

  it("reports unknown when no forwarding headers are present", () => {
    expect(extractClientIp(reqWith({}))).toBe("unknown");
  });
});
