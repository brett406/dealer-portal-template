import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/cms";
import { Pagination } from "@/components/ui/Pagination";
import { escapeLike, getPageParam, pageSlice, PER_PAGE } from "@/lib/pagination";
import { MaterialsList } from "./materials-list";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; kind?: string; q?: string; page?: string }>;
}) {
  // §6: the whole BOM admin UI is hidden while the module is disabled.
  const settings = await getSiteSettings();
  if (!settings?.bomCostingEnabled) notFound();

  const { category, kind, q, page } = await searchParams;

  const pageNum = getPageParam(page);
  const perPage = PER_PAGE.admin;

  const where: Record<string, unknown> = {};
  if (category) where.categoryId = category;
  if (kind === "raw" || kind === "subassembly") where.kind = kind;
  if (q) {
    const safe = escapeLike(q);
    where.OR = [
      { name: { contains: safe, mode: "insensitive" } },
      { sku: { contains: safe, mode: "insensitive" } },
    ];
  }

  const [categories, totalCount] = await Promise.all([
    prisma.productCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.material.count({ where }),
  ]);

  const { meta: pageMeta, skip, take } = pageSlice(totalCount, pageNum, perPage);

  const materials = await prisma.material.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip,
    take,
    include: {
      category: { select: { name: true } },
      _count: { select: { usedIn: true } },
    },
  });

  const data = materials.map((m) => ({
    id: m.id,
    name: m.name,
    sku: m.sku,
    kind: m.kind,
    unit: m.unit,
    // raw shows its entered unitCost; sub-assembly its rolled computedCost (§3)
    cost:
      m.kind === "raw"
        ? m.unitCost !== null
          ? Number(m.unitCost)
          : null
        : m.computedCost !== null
          ? Number(m.computedCost)
          : null,
    // §13.7 — raw materials without a cost are flagged on the list
    uncosted: m.kind === "raw" && m.unitCost === null,
    archived: m.archivedAt !== null,
    categoryName: m.category?.name ?? null,
    usedInCount: m._count.usedIn,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Materials</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            Raw materials and sub-assemblies for BOM costing.
          </p>
        </div>
      </div>

      <MaterialsList
        data={data}
        categories={categories}
        filters={{ category, kind, q }}
      />

      <Pagination
        meta={{ ...pageMeta }}
        basePath="/admin/materials"
        filters={{ category, kind, q }}
        label="materials"
      />
    </div>
  );
}
