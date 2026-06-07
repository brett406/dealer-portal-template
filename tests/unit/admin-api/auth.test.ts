import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the DB + rate limiter so the auth unit test stays pure.
const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 119 }),
}));

import { authenticateAdminApi } from "@/lib/admin-api/auth";

const TOKEN = "x".repeat(40); // >= 32 chars

function req(authHeader?: string) {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new NextRequest("http://localhost/api/admin/products", { headers });
}

describe("authenticateAdminApi", () => {
  beforeEach(() => {
    findFirst.mockReset();
    delete process.env.ADMIN_API_TOKEN;
  });

  it("503 when no token is configured", async () => {
    const r = await authenticateAdminApi(req(`Bearer ${TOKEN}`));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(503);
  });

  it("401 when the Authorization header is missing", async () => {
    process.env.ADMIN_API_TOKEN = TOKEN;
    const r = await authenticateAdminApi(req());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("401 when the bearer token is wrong", async () => {
    process.env.ADMIN_API_TOKEN = TOKEN;
    const r = await authenticateAdminApi(req(`Bearer ${"y".repeat(40)}`));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("401 when token length differs (no length-based bypass)", async () => {
    process.env.ADMIN_API_TOKEN = TOKEN;
    const r = await authenticateAdminApi(req("Bearer short"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("authenticates with the correct token and resolves a SUPER_ADMIN actor", async () => {
    process.env.ADMIN_API_TOKEN = TOKEN;
    findFirst.mockResolvedValue({ id: "admin-1" });
    const r = await authenticateAdminApi(req(`Bearer ${TOKEN}`));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.actorUserId).toBe("admin-1");
  });

  it("503 when no SUPER_ADMIN exists to attribute audit to", async () => {
    process.env.ADMIN_API_TOKEN = TOKEN;
    findFirst.mockResolvedValue(null);
    const r = await authenticateAdminApi(req(`Bearer ${TOKEN}`));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(503);
  });
});
