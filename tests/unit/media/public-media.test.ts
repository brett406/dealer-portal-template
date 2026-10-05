import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  productImage: { findFirst: vi.fn() },
  productCategory: { findFirst: vi.fn() },
  $queryRaw: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { isPubliclyReferenced, clearPublicMediaCache } = await import("@/lib/public-media");

const FILE = "1791209456234-product-photo.jpg";

beforeEach(() => {
  clearPublicMediaCache();
  mockPrisma.productImage.findFirst.mockReset().mockResolvedValue(null);
  mockPrisma.productCategory.findFirst.mockReset().mockResolvedValue(null);
  mockPrisma.$queryRaw.mockReset().mockResolvedValue([]);
});

describe("isPubliclyReferenced", () => {
  it("publishes a file used as a product photo", async () => {
    mockPrisma.productImage.findFirst.mockResolvedValue({ id: "img1" });
    expect(await isPubliclyReferenced(FILE)).toBe(true);
  });

  it("publishes a file used as a category photo", async () => {
    mockPrisma.productCategory.findFirst.mockResolvedValue({ id: "cat1" });
    expect(await isPubliclyReferenced(FILE)).toBe(true);
  });

  it("publishes a file placed in published CMS content", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ found: 1 }]);
    expect(await isPubliclyReferenced(FILE)).toBe(true);
  });

  // The whole point of the gate: dealer media stays locked.
  it("keeps an unreferenced file private", async () => {
    expect(await isPubliclyReferenced("2026-price-sheet.pdf")).toBe(false);
  });

  it("fails closed when the database errors, and does not cache the failure", async () => {
    mockPrisma.productImage.findFirst.mockRejectedValue(new Error("connection lost"));
    expect(await isPubliclyReferenced(FILE)).toBe(false);

    mockPrisma.productImage.findFirst.mockResolvedValue({ id: "img1" });
    expect(await isPubliclyReferenced(FILE)).toBe(true);
  });

  it("looks the file up under both its raw and percent-encoded spelling", async () => {
    await isPubliclyReferenced("product photo.jpg");
    const where = mockPrisma.productImage.findFirst.mock.calls[0][0].where;
    expect(where.url.in).toContain("/api/uploads/product photo.jpg");
    expect(where.url.in).toContain("/api/uploads/product%20photo.jpg");
  });

  it("caches a hit instead of querying on every image request", async () => {
    mockPrisma.productImage.findFirst.mockResolvedValue({ id: "img1" });
    await isPubliclyReferenced(FILE);
    await isPubliclyReferenced(FILE);
    expect(mockPrisma.productImage.findFirst).toHaveBeenCalledTimes(1);
  });
});
