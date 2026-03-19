import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error("REDIRECT");
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
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
  productCategory: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
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
  generateSlug,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
} = await import("@/app/admin/categories/actions");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("generateSlug", () => {
  it("converts name to lowercase hyphenated slug", () => {
    expect(generateSlug("Power Tools")).toBe("power-tools");
  });

  it("handles multiple spaces and special characters", () => {
    expect(generateSlug("Safety & Protection Equipment!")).toBe("safety-protection-equipment");
  });

  it("strips leading and trailing hyphens", () => {
    expect(generateSlug("  --Test Category--  ")).toBe("test-category");
  });

  it("handles numbers", () => {
    expect(generateSlug("Grade 5 Fasteners")).toBe("grade-5-fasteners");
  });

  it("collapses consecutive special characters to single hyphen", () => {
    expect(generateSlug("Nuts & Bolts --- Washers")).toBe("nuts-bolts-washers");
  });

  it("returns empty string for empty input", () => {
    expect(generateSlug("")).toBe("");
  });
});

describe("createCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.productCategory.findUnique.mockResolvedValue(null);
    mockPrisma.productCategory.create.mockResolvedValue({ id: "new-id" });
    mockRedirect.mockClear();
  });

  it("requires a name", async () => {
    const result = await createCategory(
      {},
      makeFormData({ name: "", slug: "test", description: "", sortOrder: "0" }),
    );
    expect(result.errors?.name).toMatch(/required/i);
  });

  it("rejects names over 100 characters", async () => {
    const result = await createCategory(
      {},
      makeFormData({ name: "x".repeat(101), slug: "test", description: "", sortOrder: "0" }),
    );
    expect(result.errors?.name).toMatch(/100 characters/i);
  });

  it("validates slug format — rejects uppercase", async () => {
    const result = await createCategory(
      {},
      makeFormData({ name: "Test", slug: "Power-Tools", description: "", sortOrder: "0" }),
    );
    expect(result.errors?.slug).toMatch(/lowercase/i);
  });

  it("validates slug format — rejects spaces", async () => {
    const result = await createCategory(
      {},
      makeFormData({ name: "Test", slug: "power tools", description: "", sortOrder: "0" }),
    );
    expect(result.errors?.slug).toBeDefined();
  });

  it("rejects duplicate slugs", async () => {
    mockPrisma.productCategory.findUnique.mockResolvedValue({ id: "existing", slug: "power-tools" });

    const result = await createCategory(
      {},
      makeFormData({ name: "Power Tools", slug: "power-tools", description: "", sortOrder: "0" }),
    );
    expect(result.errors?.slug).toMatch(/already exists/i);
  });

  it("rejects descriptions over 500 characters", async () => {
    const result = await createCategory(
      {},
      makeFormData({ name: "Test", slug: "test", description: "x".repeat(501), sortOrder: "0" }),
    );
    expect(result.errors?.description).toMatch(/500 characters/i);
  });

  it("redirects on successful creation", async () => {
    await expect(
      createCategory(
        {},
        makeFormData({ name: "Hand Tools", slug: "hand-tools", description: "", sortOrder: "1" }),
      ),
    ).rejects.toThrow("REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/categories?status=created");
    expect(mockPrisma.productCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Hand Tools",
        slug: "hand-tools",
        sortOrder: 1,
        active: false,
      }),
    });
  });

  it("defaults active to false when checkbox not sent", async () => {
    await expect(
      createCategory(
        {},
        makeFormData({ name: "Test", slug: "test", description: "", sortOrder: "0" }),
      ),
    ).rejects.toThrow("REDIRECT");

    expect(mockPrisma.productCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ active: false }),
    });
  });
});

describe("updateCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.productCategory.findFirst.mockResolvedValue(null);
    mockPrisma.productCategory.update.mockResolvedValue({ id: "cat-1" });
    mockRedirect.mockClear();
  });

  it("rejects duplicate slug (excluding self)", async () => {
    mockPrisma.productCategory.findFirst.mockResolvedValue({ id: "other-cat", slug: "taken" });

    const result = await updateCategory(
      "cat-1",
      {},
      makeFormData({ name: "Test", slug: "taken", description: "", sortOrder: "0" }),
    );
    expect(result.errors?.slug).toMatch(/already exists/i);
  });

  it("redirects on success", async () => {
    await expect(
      updateCategory(
        "cat-1",
        {},
        makeFormData({ name: "Updated", slug: "updated", description: "", sortOrder: "0" }),
      ),
    ).rejects.toThrow("REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/categories?status=updated");
  });
});

describe("deleteCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cannot delete category with assigned products", async () => {
    mockPrisma.productCategory.findUnique.mockResolvedValue({
      id: "cat-1",
      name: "Power Tools",
      _count: { products: 5 },
    });

    const result = await deleteCategory("cat-1");
    expect(result.error).toMatch(/cannot delete/i);
    expect(result.error).toContain("5");
    expect(mockPrisma.productCategory.delete).not.toHaveBeenCalled();
  });

  it("allows delete when no products assigned", async () => {
    mockPrisma.productCategory.findUnique.mockResolvedValue({
      id: "cat-1",
      name: "Empty",
      _count: { products: 0 },
    });

    const result = await deleteCategory("cat-1");
    expect(result.error).toBeUndefined();
    expect(mockPrisma.productCategory.delete).toHaveBeenCalledWith({
      where: { id: "cat-1" },
    });
  });

  it("returns error for non-existent category", async () => {
    mockPrisma.productCategory.findUnique.mockResolvedValue(null);

    const result = await deleteCategory("non-existent");
    expect(result.error).toMatch(/not found/i);
  });
});

describe("toggleCategoryActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.productCategory.update.mockResolvedValue({});
  });

  it("toggles active to inactive", async () => {
    mockPrisma.productCategory.findUnique.mockResolvedValue({
      id: "cat-1",
      active: true,
    });

    const result = await toggleCategoryActive("cat-1");
    expect(result.error).toBeUndefined();
    expect(mockPrisma.productCategory.update).toHaveBeenCalledWith({
      where: { id: "cat-1" },
      data: { active: false },
    });
  });

  it("toggles inactive to active", async () => {
    mockPrisma.productCategory.findUnique.mockResolvedValue({
      id: "cat-1",
      active: false,
    });

    const result = await toggleCategoryActive("cat-1");
    expect(result.error).toBeUndefined();
    expect(mockPrisma.productCategory.update).toHaveBeenCalledWith({
      where: { id: "cat-1" },
      data: { active: true },
    });
  });

  it("returns error for non-existent category", async () => {
    mockPrisma.productCategory.findUnique.mockResolvedValue(null);

    const result = await toggleCategoryActive("non-existent");
    expect(result.error).toMatch(/not found/i);
  });
});
