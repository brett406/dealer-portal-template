import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";
import { getEffectiveCustomerId, isActingAsCustomer } from "@/lib/auth-guards";

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error("REDIRECT");
  },
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
  }),
}));

// Mock auth — we control what session is returned
let mockSession: Session | null = null;
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(mockSession)),
}));

// Mock prisma for requireCustomer
const mockFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

function makeSession(overrides: Partial<Session["user"]> = {}): Session {
  return {
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      role: "CUSTOMER",
      mustChangePassword: false,
      ...overrides,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

// Import after mocks are set up
const { requireUser, requireAdmin, requireSuperAdmin, requireCustomer } = await import(
  "@/lib/auth-guards"
);

describe("requireUser", () => {
  beforeEach(() => {
    mockSession = null;
    mockRedirect.mockClear();
    mockFindUnique.mockReset();
  });

  it("returns user for valid session", async () => {
    mockSession = makeSession({ role: "CUSTOMER", customerId: "cust-1" });
    const user = await requireUser();
    expect(user.id).toBe("user-1");
    expect(user.role).toBe("CUSTOMER");
  });

  it("redirects for no session", async () => {
    mockSession = null;
    await expect(requireUser()).rejects.toThrow("REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login?reason=auth-required"),
    );
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    mockSession = null;
    mockRedirect.mockClear();
  });

  it("allows SUPER_ADMIN", async () => {
    mockSession = makeSession({ role: "SUPER_ADMIN" });
    const user = await requireAdmin();
    expect(user.role).toBe("SUPER_ADMIN");
  });

  it("allows STAFF", async () => {
    mockSession = makeSession({ role: "STAFF" });
    const user = await requireAdmin();
    expect(user.role).toBe("STAFF");
  });

  it("rejects CUSTOMER", async () => {
    mockSession = makeSession({ role: "CUSTOMER" });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("reason=forbidden"),
    );
  });
});

describe("requireSuperAdmin", () => {
  beforeEach(() => {
    mockSession = null;
    mockRedirect.mockClear();
  });

  it("allows SUPER_ADMIN", async () => {
    mockSession = makeSession({ role: "SUPER_ADMIN" });
    const user = await requireSuperAdmin();
    expect(user.role).toBe("SUPER_ADMIN");
  });

  it("rejects STAFF", async () => {
    mockSession = makeSession({ role: "STAFF" });
    await expect(requireSuperAdmin()).rejects.toThrow("REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("reason=forbidden"),
    );
  });
});

describe("requireCustomer", () => {
  beforeEach(() => {
    mockSession = null;
    mockRedirect.mockClear();
    mockFindUnique.mockReset();
  });

  it("allows CUSTOMER with APPROVED company", async () => {
    mockSession = makeSession({ role: "CUSTOMER", customerId: "cust-1" });
    mockFindUnique.mockResolvedValue({
      id: "cust-1",
      company: { approvalStatus: "APPROVED" },
    });

    const user = await requireCustomer();
    expect(user.role).toBe("CUSTOMER");
  });

  it("rejects CUSTOMER with PENDING company", async () => {
    mockSession = makeSession({ role: "CUSTOMER", customerId: "cust-1" });
    mockFindUnique.mockResolvedValue({
      id: "cust-1",
      company: { approvalStatus: "PENDING" },
    });

    await expect(requireCustomer()).rejects.toThrow("REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("reason=forbidden"),
    );
  });

  it("rejects SUPER_ADMIN (not a customer)", async () => {
    mockSession = makeSession({ role: "SUPER_ADMIN" });
    await expect(requireCustomer()).rejects.toThrow("REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("reason=forbidden"),
    );
  });
});

describe("getEffectiveCustomerId", () => {
  it("returns actingAsCustomerId when set", () => {
    const session = makeSession({
      role: "SUPER_ADMIN",
      customerId: undefined,
      actingAsCustomerId: "cust-42",
    });
    expect(getEffectiveCustomerId(session)).toBe("cust-42");
  });

  it("returns session customerId when not acting as", () => {
    const session = makeSession({
      role: "CUSTOMER",
      customerId: "cust-7",
    });
    expect(getEffectiveCustomerId(session)).toBe("cust-7");
  });

  it("returns undefined when neither is set", () => {
    const session = makeSession({
      role: "SUPER_ADMIN",
      customerId: undefined,
      actingAsCustomerId: undefined,
    });
    expect(getEffectiveCustomerId(session)).toBeUndefined();
  });
});

describe("isActingAsCustomer", () => {
  it("returns true when actingAsCustomerId is set", () => {
    const session = makeSession({ actingAsCustomerId: "cust-42" });
    expect(isActingAsCustomer(session)).toBe(true);
  });

  it("returns false when actingAsCustomerId is not set", () => {
    const session = makeSession({});
    expect(isActingAsCustomer(session)).toBe(false);
  });
});
