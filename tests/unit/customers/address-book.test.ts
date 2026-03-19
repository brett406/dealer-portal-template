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

vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = {
  address: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

function validAddressData(overrides: Record<string, string> = {}) {
  return makeFormData({
    label: "Main Office",
    line1: "123 Main St",
    line2: "",
    city: "Portland",
    state: "OR",
    postalCode: "97201",
    country: "US",
    ...overrides,
  });
}

// ─── Import after mocks ──────────────────────────────────────────────────────

const {
  addAddress,
  setDefaultAddress,
  deleteAddress,
} = await import("@/app/admin/companies/actions");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("addAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.address.create.mockResolvedValue({ id: "addr-new" });
    mockPrisma.address.updateMany.mockResolvedValue({});
  });

  it("adds address to company with valid data", async () => {
    const result = await addAddress("co-1", validAddressData());
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(mockPrisma.address.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "co-1",
        label: "Main Office",
        line1: "123 Main St",
        city: "Portland",
        state: "OR",
        postalCode: "97201",
      }),
    });
  });

  it("requires label", async () => {
    const result = await addAddress("co-1", validAddressData({ label: "" }));
    expect(result.errors?.label).toBeDefined();
  });

  it("requires line1", async () => {
    const result = await addAddress("co-1", validAddressData({ line1: "" }));
    expect(result.errors?.line1).toBeDefined();
  });

  it("requires city", async () => {
    const result = await addAddress("co-1", validAddressData({ city: "" }));
    expect(result.errors?.city).toBeDefined();
  });

  it("requires state", async () => {
    const result = await addAddress("co-1", validAddressData({ state: "" }));
    expect(result.errors?.state).toBeDefined();
  });

  it("requires postalCode", async () => {
    const result = await addAddress("co-1", validAddressData({ postalCode: "" }));
    expect(result.errors?.postalCode).toBeDefined();
  });
});

describe("setDefaultAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);
  });

  it("unsets previous default for same company", async () => {
    mockPrisma.address.findUnique.mockResolvedValue({ id: "addr-2", companyId: "co-1" });

    await setDefaultAddress("addr-2");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.address.updateMany).toHaveBeenCalledWith({
      where: { companyId: "co-1", isDefault: true },
      data: { isDefault: false },
    });
    expect(mockPrisma.address.update).toHaveBeenCalledWith({
      where: { id: "addr-2" },
      data: { isDefault: true },
    });
  });

  it("only one default per company (transaction has 2 operations)", async () => {
    mockPrisma.address.findUnique.mockResolvedValue({ id: "addr-1", companyId: "co-1" });

    await setDefaultAddress("addr-1");

    const txArgs = mockPrisma.$transaction.mock.calls[0][0];
    expect(txArgs).toHaveLength(2);
  });
});

describe("deleteAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.address.delete.mockResolvedValue({});
  });

  it("deletes non-default address", async () => {
    mockPrisma.address.findUnique.mockResolvedValue({
      id: "addr-1",
      companyId: "co-1",
      isDefault: false,
    });

    const result = await deleteAddress("addr-1");
    expect(result.error).toBeUndefined();
    expect(mockPrisma.address.delete).toHaveBeenCalledWith({ where: { id: "addr-1" } });
  });

  it("promotes next address when deleting default", async () => {
    mockPrisma.address.findUnique.mockResolvedValue({
      id: "addr-1",
      companyId: "co-1",
      isDefault: true,
    });
    mockPrisma.address.findFirst.mockResolvedValue({ id: "addr-2" });
    mockPrisma.address.update.mockResolvedValue({});

    await deleteAddress("addr-1");

    expect(mockPrisma.address.update).toHaveBeenCalledWith({
      where: { id: "addr-2" },
      data: { isDefault: true },
    });
  });

  it("returns error for non-existent address", async () => {
    mockPrisma.address.findUnique.mockResolvedValue(null);

    const result = await deleteAddress("non-existent");
    expect(result.error).toMatch(/not found/i);
  });
});
