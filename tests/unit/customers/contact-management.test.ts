import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: "admin-1", email: "admin@test.com", name: "Admin", role: "SUPER_ADMIN", mustChangePassword: false },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
  ),
}));

const mockSendWelcome = vi.fn().mockResolvedValue(undefined);
const mockSendReset = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcome(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendReset(...args),
  sendRegistrationApprovedEmail: vi.fn(),
  sendRegistrationRejectedEmail: vi.fn(),
}));

const mockPrisma = {
  user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  customer: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  company: { findUnique: vi.fn(), update: vi.fn() },
  cart: { deleteMany: vi.fn() },
  address: { deleteMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

// ─── Import after mocks ──────────────────────────────────────────────────────

const { addCustomerContact, resetCustomerPassword } = await import(
  "@/app/admin/companies/actions"
);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("addCustomerContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: "user-new" });
    mockPrisma.customer.create.mockResolvedValue({ id: "cust-new" });
  });

  it("creates user and customer with auto-generated password", async () => {
    const result = await addCustomerContact(
      "co-1",
      makeFormData({ name: "Jane", email: "jane@test.com", phone: "", title: "" }),
    );

    expect(result.success).toBe(true);
    expect(result.tempPassword).toBeDefined();
    expect(result.tempPassword!.length).toBeGreaterThanOrEqual(12);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "jane@test.com",
        name: "Jane",
        role: "CUSTOMER",
        mustChangePassword: true,
      }),
    });
  });

  it("uses custom password when valid one is provided", async () => {
    const result = await addCustomerContact(
      "co-1",
      makeFormData({ name: "Jane", email: "jane@test.com", phone: "", title: "", password: "MyCustomPass1" }),
    );

    expect(result.success).toBe(true);
    expect(result.tempPassword).toBe("MyCustomPass1");
  });

  it("rejects custom password shorter than 8 characters", async () => {
    const result = await addCustomerContact(
      "co-1",
      makeFormData({ name: "Jane", email: "jane@test.com", phone: "", title: "", password: "short" }),
    );

    expect(result.errors?.password).toMatch(/8 characters/i);
  });

  it("rejects duplicate email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" });

    const result = await addCustomerContact(
      "co-1",
      makeFormData({ name: "Jane", email: "jane@test.com", phone: "", title: "" }),
    );

    expect(result.errors?.email).toMatch(/already exists/i);
  });

  it("sends welcome email on success", async () => {
    await addCustomerContact(
      "co-1",
      makeFormData({ name: "Jane", email: "jane@test.com", phone: "", title: "" }),
    );

    // Wait for fire-and-forget
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendWelcome).toHaveBeenCalledWith(
      "jane@test.com",
      "Jane",
      expect.any(String),
    );
  });

  it("requires name and email", async () => {
    const result = await addCustomerContact("co-1", makeFormData({ name: "", email: "" }));
    expect(result.errors?.name).toBeDefined();
    expect(result.errors?.email).toBeDefined();
  });
});

describe("resetCustomerPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "cust-1",
      companyId: "co-1",
      userId: "user-1",
      name: "Jane",
      email: "jane@test.com",
      user: { id: "user-1", email: "jane@test.com" },
    });
    mockPrisma.user.update.mockResolvedValue({});
  });

  it("generates temp password when no custom password given", async () => {
    const result = await resetCustomerPassword("cust-1");

    expect(result.success).toBe(true);
    expect(result.tempPassword).toBeDefined();
    expect(result.tempPassword!.length).toBeGreaterThanOrEqual(12);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({ mustChangePassword: true }),
    });
  });

  it("accepts valid custom password", async () => {
    const result = await resetCustomerPassword("cust-1", "NewPassword1");

    expect(result.success).toBe(true);
    expect(result.tempPassword).toBe("NewPassword1");
  });

  it("rejects custom password shorter than 8 characters", async () => {
    const result = await resetCustomerPassword("cust-1", "short");
    expect(result.error).toMatch(/8 characters/i);
  });

  it("sends password reset email", async () => {
    await resetCustomerPassword("cust-1");
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendReset).toHaveBeenCalledWith(
      "jane@test.com",
      "Jane",
      expect.any(String),
    );
  });

  it("returns error for non-existent customer", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue(null);
    const result = await resetCustomerPassword("missing");
    expect(result.error).toMatch(/not found/i);
  });
});
