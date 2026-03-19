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

const mockPrisma = {
  productUOM: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

// ─── Import after mocks ──────────────────────────────────────────────────────

const { addUOM, deleteUOM } = await import("@/app/admin/products/actions");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("addUOM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.productUOM.create.mockResolvedValue({ id: "uom-new" });
  });

  it("creates UOM with valid conversion factor", async () => {
    const result = await addUOM(
      "prod-1",
      makeFormData({ name: "Box", conversionFactor: "12", priceOverride: "", sortOrder: "1" }),
    );

    expect(result.error).toBeUndefined();
    expect(mockPrisma.productUOM.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: "prod-1",
        name: "Box",
        conversionFactor: 12,
        priceOverride: null,
      }),
    });
  });

  it("conversion factor must be a positive integer", async () => {
    const result = await addUOM(
      "prod-1",
      makeFormData({ name: "Bad", conversionFactor: "0", priceOverride: "", sortOrder: "0" }),
    );
    expect(result.errors?.conversionFactor).toBeDefined();

    const result2 = await addUOM(
      "prod-1",
      makeFormData({ name: "Bad", conversionFactor: "-5", priceOverride: "", sortOrder: "0" }),
    );
    expect(result2.errors?.conversionFactor).toBeDefined();
  });

  it("price override is optional (null = use calculation)", async () => {
    const result = await addUOM(
      "prod-1",
      makeFormData({ name: "Each", conversionFactor: "1", priceOverride: "", sortOrder: "0" }),
    );

    expect(result.error).toBeUndefined();
    expect(mockPrisma.productUOM.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ priceOverride: null }),
    });
  });

  it("price override of 0 is valid (free)", async () => {
    const result = await addUOM(
      "prod-1",
      makeFormData({ name: "Free Box", conversionFactor: "12", priceOverride: "0", sortOrder: "1" }),
    );

    expect(result.error).toBeUndefined();
    expect(mockPrisma.productUOM.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ priceOverride: 0 }),
    });
  });
});

describe("deleteUOM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cannot delete UOM that is in active carts", async () => {
    mockPrisma.productUOM.findUnique.mockResolvedValue({
      id: "uom-1",
      productId: "prod-1",
      cartItems: [{ id: "ci-1" }],
    });

    const result = await deleteUOM("uom-1");
    expect(result.error).toMatch(/cart/i);
    expect(mockPrisma.productUOM.delete).not.toHaveBeenCalled();
  });

  it("allows delete when not in any carts", async () => {
    mockPrisma.productUOM.findUnique.mockResolvedValue({
      id: "uom-1",
      productId: "prod-1",
      cartItems: [],
    });
    mockPrisma.productUOM.delete.mockResolvedValue({});

    const result = await deleteUOM("uom-1");
    expect(result.error).toBeUndefined();
    expect(mockPrisma.productUOM.delete).toHaveBeenCalledWith({
      where: { id: "uom-1" },
    });
  });
});
