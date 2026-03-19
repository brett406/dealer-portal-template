import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error("REDIRECT");
  },
}));
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

vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = {
  company: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
  },
  customer: {
    findMany: vi.fn(),
    delete: vi.fn(),
  },
  cart: { deleteMany: vi.fn() },
  address: { deleteMany: vi.fn() },
  user: { delete: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

// ─── Import after mocks ──────────────────────────────────────────────────────

const {
  createCompany,
  toggleCompanyActive,
  deleteCompany,
} = await import("@/app/admin/companies/actions");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createCompany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.company.create.mockResolvedValue({ id: "co-new" });
    mockRedirect.mockClear();
  });

  it("creates company with valid data and redirects", async () => {
    await expect(
      createCompany(
        {},
        makeFormData({
          name: "Test Hardware",
          priceLevelId: "pl-1",
          phone: "(555) 111-2222",
          notes: "",
        }),
      ),
    ).rejects.toThrow("REDIRECT");

    expect(mockPrisma.company.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Test Hardware",
        priceLevelId: "pl-1",
      }),
    });
    expect(mockRedirect).toHaveBeenCalledWith("/admin/companies/co-new");
  });

  it("requires a price level", async () => {
    const result = await createCompany(
      {},
      makeFormData({ name: "No Level", priceLevelId: "", phone: "", notes: "" }),
    );
    expect(result.errors?.priceLevelId).toBeDefined();
  });

  it("requires a name", async () => {
    const result = await createCompany(
      {},
      makeFormData({ name: "", priceLevelId: "pl-1", phone: "", notes: "" }),
    );
    expect(result.errors?.name).toBeDefined();
  });
});

describe("toggleCompanyActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.company.update.mockResolvedValue({});
  });

  it("toggles active to inactive", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ id: "co-1", active: true });

    const result = await toggleCompanyActive("co-1");
    expect(result.error).toBeUndefined();
    expect(mockPrisma.company.update).toHaveBeenCalledWith({
      where: { id: "co-1" },
      data: { active: false },
    });
  });

  it("toggles inactive to active", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ id: "co-1", active: false });

    const result = await toggleCompanyActive("co-1");
    expect(result.error).toBeUndefined();
    expect(mockPrisma.company.update).toHaveBeenCalledWith({
      where: { id: "co-1" },
      data: { active: true },
    });
  });
});

describe("deleteCompany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockClear();
  });

  it("cannot delete company with order history", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({
      id: "co-1",
      _count: { orders: 5 },
    });

    const result = await deleteCompany("co-1");
    expect(result.error).toMatch(/order history/i);
    expect(mockPrisma.company.delete).not.toHaveBeenCalled();
  });

  it("deletes company with no orders", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({
      id: "co-1",
      _count: { orders: 0 },
    });
    mockPrisma.customer.findMany.mockResolvedValue([]);

    await expect(deleteCompany("co-1")).rejects.toThrow("REDIRECT");
    expect(mockPrisma.company.delete).toHaveBeenCalledWith({ where: { id: "co-1" } });
  });
});
