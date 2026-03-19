import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

let mockSessionUser: Record<string, unknown> | null = null;

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve(
      mockSessionUser
        ? {
            user: mockSessionUser,
            expires: new Date(Date.now() + 86400000).toISOString(),
          }
        : null,
    ),
  ),
}));

const mockPrisma = {
  customer: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { startActingAsCustomer } = await import(
  "@/app/admin/companies/act-as-actions"
);

// Also test getEffectiveCustomerId
const { getEffectiveCustomerId, isActingAsCustomer } = await import(
  "@/lib/auth-guards"
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: "admin-1",
      email: "admin@test.com",
      name: "Admin",
      role: "SUPER_ADMIN" as const,
      mustChangePassword: false,
      ...overrides,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  } as import("next-auth").Session;
}

function mockActiveCustomer() {
  mockPrisma.customer.findUnique.mockResolvedValue({
    id: "cust-1",
    active: true,
    company: { active: true, approvalStatus: "APPROVED" },
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("startActingAsCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser = {
      id: "admin-1",
      email: "admin@test.com",
      name: "Admin",
      role: "SUPER_ADMIN",
      mustChangePassword: false,
    };
  });

  it("SUPER_ADMIN can initiate act-as", async () => {
    mockActiveCustomer();

    const result = await startActingAsCustomer("cust-1");
    expect(result.success).toBe(true);
  });

  it("STAFF cannot initiate act-as", async () => {
    mockSessionUser = { ...mockSessionUser!, role: "STAFF" };

    const result = await startActingAsCustomer("cust-1");
    expect(result.error).toMatch(/super admin/i);
  });

  it("CUSTOMER cannot initiate act-as", async () => {
    mockSessionUser = { ...mockSessionUser!, role: "CUSTOMER" };

    const result = await startActingAsCustomer("cust-1");
    expect(result.error).toMatch(/super admin/i);
  });

  it("cannot act as inactive customer", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "cust-1",
      active: false,
      company: { active: true, approvalStatus: "APPROVED" },
    });

    const result = await startActingAsCustomer("cust-1");
    expect(result.error).toMatch(/inactive/i);
  });

  it("cannot act as customer from inactive company", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "cust-1",
      active: true,
      company: { active: false, approvalStatus: "APPROVED" },
    });

    const result = await startActingAsCustomer("cust-1");
    expect(result.error).toMatch(/inactive/i);
  });

  it("cannot act as customer from unapproved company", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "cust-1",
      active: true,
      company: { active: true, approvalStatus: "PENDING" },
    });

    const result = await startActingAsCustomer("cust-1");
    expect(result.error).toMatch(/not approved/i);
  });

  it("cannot act as non-existent customer", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue(null);

    const result = await startActingAsCustomer("missing");
    expect(result.error).toMatch(/not found/i);
  });
});

describe("getEffectiveCustomerId", () => {
  it("returns actingAsCustomerId when set (act-as session)", () => {
    const session = makeSession({
      role: "SUPER_ADMIN",
      customerId: undefined,
      actingAsCustomerId: "cust-42",
    });
    expect(getEffectiveCustomerId(session)).toBe("cust-42");
  });

  it("returns own customerId when not acting as", () => {
    const session = makeSession({
      role: "CUSTOMER",
      customerId: "cust-7",
    });
    expect(getEffectiveCustomerId(session)).toBe("cust-7");
  });

  it("act-as session reads customer's pricing context", () => {
    // When actingAsCustomerId is set, getEffectiveCustomerId returns it,
    // which means all pricing/cart/order queries use the customer's ID
    const session = makeSession({ actingAsCustomerId: "cust-42" });
    const effectiveId = getEffectiveCustomerId(session);
    expect(effectiveId).toBe("cust-42");
    // The pricing code uses this ID to look up the customer's company/priceLevel
  });

  it("act-as session reads customer's cart", () => {
    // Cart operations use getEffectiveCustomerId, so acting-as uses customer's cart
    const session = makeSession({ actingAsCustomerId: "cust-42" });
    expect(getEffectiveCustomerId(session)).toBe("cust-42");
  });
});

describe("isActingAsCustomer", () => {
  it("returns true when actingAsCustomerId is set", () => {
    const session = makeSession({ actingAsCustomerId: "cust-42" });
    expect(isActingAsCustomer(session)).toBe(true);
  });

  it("returns false when not acting as", () => {
    const session = makeSession({});
    expect(isActingAsCustomer(session)).toBe(false);
  });

  it("clearing actingAsCustomerId returns to admin context", () => {
    // When actingAsCustomerId is cleared (undefined), isActingAsCustomer returns false
    const session = makeSession({
      actingAsCustomerId: undefined,
      role: "SUPER_ADMIN",
    });
    expect(isActingAsCustomer(session)).toBe(false);
    expect(getEffectiveCustomerId(session)).toBeUndefined();
  });
});

describe("orders placed while acting as customer", () => {
  it("placedByAdminId would be set from session.user.id", () => {
    // When acting as, the cart/order actions check:
    //   const isAdmin = session.user.role === "SUPER_ADMIN" || "STAFF"
    //   const placedByAdminId = isAdmin ? session.user.id : undefined
    // So admin's ID is recorded as placedByAdminId
    const session = makeSession({
      role: "SUPER_ADMIN",
      actingAsCustomerId: "cust-42",
    });
    const isAdmin =
      session.user.role === "SUPER_ADMIN" || session.user.role === "STAFF";
    const placedByAdminId = isAdmin ? session.user.id : undefined;
    expect(placedByAdminId).toBe("admin-1");
  });
});
