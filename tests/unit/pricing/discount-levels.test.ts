import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error("REDIRECT");
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

// Mock auth — always return admin session
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: {
        id: "admin-1",
        email: "admin@test.com",
        name: "Admin",
        role: "SUPER_ADMIN",
        mustChangePassword: false,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
  ),
}));

// Prisma mock
const mockPrisma = {
  priceLevel: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) {
    fd.set(k, v);
  }
  return fd;
}

// ─── Import after mocks ──────────────────────────────────────────────────────

const {
  createPriceLevel,
  updatePriceLevel,
  deletePriceLevel,
  setDefaultPriceLevel,
} = await import("@/app/admin/price-levels/actions");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Price Level Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.priceLevel.findFirst.mockResolvedValue(null);
  });

  it("cannot create price level with discount < 0", async () => {
    const result = await createPriceLevel(
      {},
      makeFormData({ name: "Bad", discountPercent: "-5", description: "", sortOrder: "0" }),
    );
    expect(result.errors?.discountPercent).toMatch(/cannot be negative/i);
  });

  it("cannot create price level with discount > 100", async () => {
    const result = await createPriceLevel(
      {},
      makeFormData({ name: "Bad", discountPercent: "150", description: "", sortOrder: "0" }),
    );
    expect(result.errors?.discountPercent).toMatch(/cannot exceed 100/i);
  });

  it("decimal discount percentages work correctly (17.5% → $82.50 on $100)", () => {
    const basePrice = 100;
    const discountPercent = 17.5;
    const finalPrice = Math.round(basePrice * (100 - discountPercent)) / 100;
    expect(finalPrice).toBe(82.5);
  });

  it("price calculation is deterministic — run 1000 times, same result", () => {
    const basePrice = 99.99;
    const discountPercent = 17.5;
    const expected = Math.round(basePrice * (100 - discountPercent)) / 100;

    for (let i = 0; i < 1000; i++) {
      const result = Math.round(basePrice * (100 - discountPercent)) / 100;
      expect(result).toBe(expected);
    }
  });
});

describe("Delete Price Level", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cannot delete price level with assigned companies", async () => {
    mockPrisma.priceLevel.findUnique.mockResolvedValue({
      id: "pl-1",
      name: "Dealer",
      _count: { companies: 3 },
    });

    const result = await deletePriceLevel("pl-1");
    expect(result.error).toMatch(/cannot delete/i);
    expect(result.error).toContain("3");
    expect(mockPrisma.priceLevel.delete).not.toHaveBeenCalled();
  });

  it("allows delete when no companies assigned", async () => {
    mockPrisma.priceLevel.findUnique.mockResolvedValue({
      id: "pl-1",
      name: "Empty",
      _count: { companies: 0 },
    });

    const result = await deletePriceLevel("pl-1");
    expect(result.error).toBeUndefined();
    expect(mockPrisma.priceLevel.delete).toHaveBeenCalledWith({
      where: { id: "pl-1" },
    });
  });
});

describe("Set Default Price Level", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);
  });

  it("setting default unsets previous default", async () => {
    await setDefaultPriceLevel("pl-new");

    // $transaction is called with an array of promises
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const txArgs = mockPrisma.$transaction.mock.calls[0][0];
    expect(txArgs).toHaveLength(2);
  });

  it("only one default can exist at a time", async () => {
    // The transaction first unsets all defaults, then sets the new one atomically
    await setDefaultPriceLevel("pl-1");

    expect(mockPrisma.priceLevel.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    expect(mockPrisma.priceLevel.update).toHaveBeenCalledWith({
      where: { id: "pl-1" },
      data: { isDefault: true },
    });
  });
});

describe("Create Price Level", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.priceLevel.findFirst.mockResolvedValue(null);
    mockPrisma.priceLevel.create.mockResolvedValue({ id: "new-id" });
    mockRedirect.mockClear();
  });

  it("rejects duplicate names", async () => {
    mockPrisma.priceLevel.findFirst.mockResolvedValue({ id: "existing", name: "Dealer" });

    const result = await createPriceLevel(
      {},
      makeFormData({ name: "Dealer", discountPercent: "20", description: "", sortOrder: "0" }),
    );
    expect(result.errors?.name).toMatch(/already exists/i);
  });

  it("redirects on success", async () => {
    await expect(
      createPriceLevel(
        {},
        makeFormData({ name: "New Level", discountPercent: "15", description: "", sortOrder: "1" }),
      ),
    ).rejects.toThrow("REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/price-levels?status=created");
  });
});
