import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/tests/helpers/db";
import { escapeLike, pageSlice } from "@/lib/pagination";

// Real-database proof for the pagination hardening: that escapeLike makes search
// terms literal against Postgres ILIKE, and that the id-tiebreaker + clamp-skip
// give complete, non-overlapping pages even when the primary sort key ties.

function asset(i: number, originalName: string, createdAt: Date) {
  return {
    filename: `file-${i}.pdf`,
    originalName,
    mimeType: "application/pdf",
    size: 1000 + i,
    storagePath: `/uploads/file-${i}-${Math.random().toString(36).slice(2)}.pdf`,
    createdAt,
  };
}

describe("escapeLike against real Postgres ILIKE", () => {
  beforeEach(async () => {
    await resetDatabase();
    const t = new Date("2026-01-01T00:00:00.000Z");
    await prisma.asset.createMany({
      data: [
        asset(1, "Spec 50% off sheet", t),
        asset(2, "Spec 5000 off sheet", t),
        asset(3, "plain_name brochure", t),
        asset(4, "plainXname brochure", t),
      ],
    });
  });

  it("proves Prisma `contains` leaks % as a wildcard WITHOUT escaping (the bug)", async () => {
    const raw = await prisma.asset.findMany({
      where: { originalName: { contains: "50%", mode: "insensitive" } },
      select: { originalName: true },
    });
    // % is a wildcard, so "5000" matches too -> both rows. This is exactly the
    // behavior escapeLike() exists to prevent.
    expect(raw.length).toBe(2);
  });

  it("matches % literally WITH escapeLike", async () => {
    const safe = await prisma.asset.findMany({
      where: { originalName: { contains: escapeLike("50%"), mode: "insensitive" } },
      select: { originalName: true },
    });
    expect(safe.map((a) => a.originalName)).toEqual(["Spec 50% off sheet"]);
  });

  it("matches _ literally WITH escapeLike (raw _ would match any char)", async () => {
    const raw = await prisma.asset.findMany({
      where: { originalName: { contains: "_", mode: "insensitive" } },
    });
    expect(raw.length).toBe(4); // _ is "any single char" -> everything

    const safe = await prisma.asset.findMany({
      where: { originalName: { contains: escapeLike("_"), mode: "insensitive" } },
      select: { originalName: true },
    });
    expect(safe.map((a) => a.originalName)).toEqual(["plain_name brochure"]);
  });

  it("handles a literal backslash + percent without breaking the query", async () => {
    await prisma.asset.create({
      data: asset(5, "weird 100\\% value", new Date("2026-01-01T00:00:00.000Z")),
    });
    const safe = await prisma.asset.findMany({
      where: { originalName: { contains: escapeLike("100\\%"), mode: "insensitive" } },
      select: { originalName: true },
    });
    expect(safe.map((a) => a.originalName)).toEqual(["weird 100\\% value"]);
  });
});

describe("offset pagination is stable when the sort key ties", () => {
  const SAME_TIME = new Date("2026-02-02T00:00:00.000Z");
  const TOTAL = 25;
  const PER_PAGE = 10;

  beforeEach(async () => {
    await resetDatabase();
    // Every row shares the SAME createdAt, so ordering is decided entirely by the
    // id tiebreaker. Without it, page boundaries would be non-deterministic.
    await prisma.asset.createMany({
      data: Array.from({ length: TOTAL }, (_, i) => asset(i, `tie-${i}`, SAME_TIME)),
    });
  });

  async function pageIds(pageNum: number): Promise<string[]> {
    const totalCount = await prisma.asset.count();
    const { skip, take } = pageSlice(totalCount, pageNum, PER_PAGE);
    const rows = await prisma.asset.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  it("covers every row exactly once across all pages — no dupes, no gaps", async () => {
    const p1 = await pageIds(1);
    const p2 = await pageIds(2);
    const p3 = await pageIds(3);

    expect(p1.length).toBe(10);
    expect(p2.length).toBe(10);
    expect(p3.length).toBe(5);

    const all = [...p1, ...p2, ...p3];
    const unique = new Set(all);
    expect(unique.size).toBe(TOTAL); // no duplicates
    expect(all.length).toBe(TOTAL); // no overlaps

    const dbIds = new Set((await prisma.asset.findMany({ select: { id: true } })).map((r) => r.id));
    expect(unique).toEqual(dbIds); // exact same set -> nothing skipped
  });

  it("clamp-skip lands an overshoot page on the real last page (not empty)", async () => {
    const overshoot = await pageIds(99);
    const lastPage = await pageIds(3);
    expect(overshoot.length).toBe(5);
    expect(overshoot).toEqual(lastPage);
  });

  it("folder scoping is preserved consistently in count and page query", async () => {
    const folder = await prisma.assetFolder.create({
      data: { name: "Brochures", slug: "brochures" },
    });
    // Move 12 of the 25 into the folder.
    const moveIds = (await prisma.asset.findMany({ take: 12, select: { id: true } })).map((r) => r.id);
    await prisma.asset.updateMany({ where: { id: { in: moveIds } }, data: { folderId: folder.id } });

    const where = { folderId: folder.id };
    const totalCount = await prisma.asset.count({ where });
    expect(totalCount).toBe(12);

    const { meta, skip, take } = pageSlice(totalCount, 2, PER_PAGE);
    expect(meta.totalPages).toBe(2);
    const rows = await prisma.asset.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      select: { id: true, folderId: true },
    });
    expect(rows.length).toBe(2); // page 2 of 12 = remaining 2
    expect(rows.every((r) => r.folderId === folder.id)).toBe(true);
  });
});
