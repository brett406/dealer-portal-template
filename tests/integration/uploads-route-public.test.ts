import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { getUploadsDir } from "@/lib/uploads";

// Logged out — the case that drew broken images on the storefront.
vi.mock("@/lib/auth", () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

const isPubliclyReferenced = vi.fn();
vi.mock("@/lib/public-media", () => ({ isPubliclyReferenced }));

vi.mock("@/lib/prisma", () => ({
  prisma: { asset: { findFirst: vi.fn(() => Promise.resolve(null)) } },
}));

const { GET } = await import("@/app/api/uploads/[filename]/route");

const PHOTO = "1791209456234-product-photo.jpg";
const SHEET = "2026-price-sheet.pdf";

function get(filename: string) {
  return GET(new NextRequest(`http://localhost/api/uploads/${filename}`), {
    params: Promise.resolve({ filename }),
  });
}

beforeEach(async () => {
  isPubliclyReferenced.mockReset();
  const dir = getUploadsDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, PHOTO), "jpeg-bytes");
  await fs.writeFile(path.join(dir, SHEET), "secret prices");
});

afterAll(async () => {
  const dir = getUploadsDir();
  await fs.unlink(path.join(dir, PHOTO)).catch(() => {});
  await fs.unlink(path.join(dir, SHEET)).catch(() => {});
});

describe("GET /api/uploads/[filename] — published photos", () => {
  it("serves a product photo to a logged-out visitor", async () => {
    isPubliclyReferenced.mockResolvedValue(true);
    const res = await get(PHOTO);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("content-disposition")).toContain("inline");
  });

  it("marks a published photo shared-cacheable", async () => {
    isPubliclyReferenced.mockResolvedValue(true);
    const res = await get(PHOTO);
    expect(res.headers.get("cache-control")).toContain("public");
  });

  it("still refuses dealer media to a logged-out visitor", async () => {
    isPubliclyReferenced.mockResolvedValue(false);
    const res = await get(SHEET);
    expect(res.status).toBe(401);
  });

  // The gate must not be reachable with a crafted name, published or not.
  it("rejects path traversal before consulting the gate", async () => {
    isPubliclyReferenced.mockResolvedValue(true);
    const res = await get("..%2f..%2fetc%2fpasswd");
    expect(res.status).toBe(400);
    expect(isPubliclyReferenced).not.toHaveBeenCalled();
  });
});
