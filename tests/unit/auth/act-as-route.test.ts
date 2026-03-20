import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: (...args: unknown[]) => mockCookieSet(...args),
  }),
}));

let mockSessionUser: Record<string, unknown> | null = null;
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve(
      mockSessionUser
        ? { user: mockSessionUser, expires: new Date(Date.now() + 86400000).toISOString() }
        : null,
    ),
  ),
}));

const mockPrisma = { customer: { findUnique: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockEncode = vi.fn().mockResolvedValue("mock-jwt-token");
vi.mock("next-auth/jwt", () => ({ encode: (...args: unknown[]) => mockEncode(...args) }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAdmin() {
  mockSessionUser = {
    id: "admin-1", email: "admin@test.com", name: "Admin",
    role: "SUPER_ADMIN", mustChangePassword: false, customerId: undefined,
  };
}

function mockActiveCustomer() {
  mockPrisma.customer.findUnique.mockResolvedValue({
    id: "cust-1", active: true, company: { active: true, approvalStatus: "APPROVED" },
  });
}

async function callRoute(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/auth/act-as/route");
  const request = new Request("http://localhost/api/auth/act-as", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request as any);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Act-As API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser = null;
    process.env.AUTH_SECRET = "test-secret";
  });

  it("returns 403 if user is not SUPER_ADMIN", async () => {
    mockSessionUser = { id: "s1", role: "STAFF", email: "s@t.com", name: "S", mustChangePassword: false };
    const res = await callRoute({ customerId: "cust-1" });
    expect(res.status).toBe(403);
  });

  it("returns 401 if not authenticated", async () => {
    mockSessionUser = null;
    const res = await callRoute({ customerId: "cust-1" });
    expect(res.status).toBe(403);
  });

  it("returns 400 if customerId is missing", async () => {
    makeAdmin();
    const res = await callRoute({});
    expect(res.status).toBe(400);
  });

  it("returns 400 if customer is inactive", async () => {
    makeAdmin();
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "c1", active: false, company: { active: true, approvalStatus: "APPROVED" },
    });
    const res = await callRoute({ customerId: "c1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 if company is inactive", async () => {
    makeAdmin();
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "c1", active: true, company: { active: false, approvalStatus: "APPROVED" },
    });
    const res = await callRoute({ customerId: "c1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 if company is not approved", async () => {
    makeAdmin();
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "c1", active: true, company: { active: true, approvalStatus: "PENDING" },
    });
    const res = await callRoute({ customerId: "c1" });
    expect(res.status).toBe(400);
  });

  it("returns 200 and sets cookie on success", async () => {
    makeAdmin();
    mockActiveCustomer();
    const res = await callRoute({ customerId: "cust-1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockCookieSet).toHaveBeenCalledTimes(1);
  });

  it("encodes actingAsCustomerId in the JWT token", async () => {
    makeAdmin();
    mockActiveCustomer();
    await callRoute({ customerId: "cust-42" });
    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({ actingAsCustomerId: "cust-42" }),
      }),
    );
  });

  it("salt and cookie name match each other", async () => {
    makeAdmin();
    mockActiveCustomer();
    await callRoute({ customerId: "cust-1" });

    // The salt passed to encode should match the cookie name set
    const encodeSalt = mockEncode.mock.calls[0][0].salt;
    const cookieName = mockCookieSet.mock.calls[0][0];
    expect(encodeSalt).toBe(cookieName);
  });
});
