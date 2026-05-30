import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { checkDatabaseAvailable } from "@/tests/helpers/integration";
import { resetDatabase } from "@/tests/helpers/db";

// Real DB; only the request-context modules are mocked.
let mockSession: Session | null = null;
vi.mock("@/lib/auth", () => ({ auth: vi.fn(() => Promise.resolve(mockSession)) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
  headers: vi.fn().mockResolvedValue({ get: () => null }),
}));

const {
  createFolder,
  renameFolder,
  setFolderColor,
  deleteFolder,
  reorderFolders,
  moveAssets,
} = await import("@/app/admin/media/actions");

function adminSession(user: { id: string; email: string }): Session {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: "Admin",
      role: "SUPER_ADMIN",
      mustChangePassword: false,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

function customerSession(): Session {
  return {
    user: {
      id: "cust-user",
      email: "dealer@example.com",
      name: "Dealer",
      role: "CUSTOMER",
      mustChangePassword: false,
      customerId: "cust-1",
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

async function makeAsset(overrides: Record<string, unknown> = {}) {
  const n = Math.random().toString(36).slice(2, 8);
  return prisma.asset.create({
    data: {
      filename: `${n}.pdf`,
      originalName: `${n}.pdf`,
      mimeType: "application/pdf",
      size: 1234,
      storagePath: `/uploads/${n}.pdf`,
      ...overrides,
    },
  });
}

let dbAvailable = false;
beforeAll(async () => {
  dbAvailable = await checkDatabaseAvailable();
});

describe("admin media folder actions", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
    const admin = await prisma.user.create({
      data: { email: "admin@test.local", password: "x", name: "Admin", role: "SUPER_ADMIN" },
    });
    mockSession = adminSession({ id: admin.id, email: admin.email });
  });

  it("creates folders with a slug, default color, and incrementing sortOrder", async () => {
    const r1 = await createFolder({ name: "Brochures" });
    expect(r1.success).toBe(true);
    const r2 = await createFolder({ name: "Spec Sheets", accentColor: "blue" });
    expect(r2.success).toBe(true);

    const folders = await prisma.assetFolder.findMany({ orderBy: { sortOrder: "asc" } });
    expect(folders).toHaveLength(2);
    expect(folders[0]).toMatchObject({ name: "Brochures", slug: "brochures", accentColor: "slate", sortOrder: 0 });
    expect(folders[1]).toMatchObject({ name: "Spec Sheets", slug: "spec-sheets", accentColor: "blue", sortOrder: 1 });
  });

  it("rejects a duplicate folder name", async () => {
    await createFolder({ name: "Brochures" });
    const r = await createFolder({ name: "Brochures" });
    expect(r.error).toMatch(/already exists/i);
    expect(await prisma.assetFolder.count()).toBe(1);
  });

  it("generates unique slugs for names that collide", async () => {
    await createFolder({ name: "Brochures" });
    await createFolder({ name: "Brochures!" }); // distinct name, same base slug
    const slugs = (await prisma.assetFolder.findMany({ orderBy: { sortOrder: "asc" } })).map((f) => f.slug);
    expect(new Set(slugs).size).toBe(2);
    expect(slugs).toContain("brochures");
    expect(slugs).toContain("brochures-2");
  });

  it("renames a folder and regenerates its slug", async () => {
    await createFolder({ name: "Old Name" });
    const folder = await prisma.assetFolder.findFirstOrThrow();
    const r = await renameFolder(folder.id, "New Name");
    expect(r.success).toBe(true);
    const updated = await prisma.assetFolder.findUniqueOrThrow({ where: { id: folder.id } });
    expect(updated).toMatchObject({ name: "New Name", slug: "new-name" });
  });

  it("validates accent color on recolor", async () => {
    await createFolder({ name: "Folder" });
    const folder = await prisma.assetFolder.findFirstOrThrow();

    expect((await setFolderColor(folder.id, "purple")).success).toBe(true);
    expect((await prisma.assetFolder.findUniqueOrThrow({ where: { id: folder.id } })).accentColor).toBe("purple");

    const bad = await setFolderColor(folder.id, "chartreuse");
    expect(bad.error).toMatch(/invalid color/i);
  });

  it("deleting a folder unfiles its assets (files are NOT deleted)", async () => {
    await createFolder({ name: "Docs" });
    const folder = await prisma.assetFolder.findFirstOrThrow();
    const asset = await makeAsset({ folderId: folder.id });

    const r = await deleteFolder(folder.id);
    expect(r.success).toBe(true);

    expect(await prisma.assetFolder.count()).toBe(0);
    const stillThere = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(stillThere.folderId).toBeNull(); // unfiled, not deleted
  });

  it("reorders folders by writing sortOrder", async () => {
    await createFolder({ name: "A" });
    await createFolder({ name: "B" });
    await createFolder({ name: "C" });
    const before = await prisma.assetFolder.findMany({ orderBy: { sortOrder: "asc" } });
    const reversed = [before[2].id, before[1].id, before[0].id];

    const r = await reorderFolders(reversed);
    expect(r.success).toBe(true);

    const after = await prisma.assetFolder.findMany({ orderBy: { sortOrder: "asc" } });
    expect(after.map((f) => f.name)).toEqual(["C", "B", "A"]);
  });

  it("moves assets into a folder and back to unfiled", async () => {
    await createFolder({ name: "Target" });
    const folder = await prisma.assetFolder.findFirstOrThrow();
    const a1 = await makeAsset();
    const a2 = await makeAsset();

    expect((await moveAssets([a1.id, a2.id], folder.id)).success).toBe(true);
    let assets = await prisma.asset.findMany({ where: { id: { in: [a1.id, a2.id] } } });
    expect(assets.every((a) => a.folderId === folder.id)).toBe(true);

    expect((await moveAssets([a1.id], null)).success).toBe(true);
    expect((await prisma.asset.findUniqueOrThrow({ where: { id: a1.id } })).folderId).toBeNull();
  });

  it("rejects moving into a non-existent folder", async () => {
    const a = await makeAsset();
    const r = await moveAssets([a.id], "does-not-exist");
    expect(r.error).toMatch(/not found/i);
  });
});

describe("admin media actions reject non-admins", () => {
  beforeEach(async (ctx) => {
    if (!dbAvailable) ctx.skip();
    await resetDatabase();
    mockSession = customerSession();
  });

  it("a CUSTOMER cannot create a folder (requireAdmin redirects)", async () => {
    await expect(createFolder({ name: "Hax" })).rejects.toThrow(/REDIRECT/);
    expect(await prisma.assetFolder.count()).toBe(0);
  });

  it("a CUSTOMER cannot move assets (requireAdmin redirects)", async () => {
    await expect(moveAssets(["whatever"], null)).rejects.toThrow(/REDIRECT/);
  });
});
