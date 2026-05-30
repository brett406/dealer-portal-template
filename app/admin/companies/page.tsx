import { prisma } from "@/lib/prisma";
import { Pagination } from "@/components/ui/Pagination";
import { escapeLike, getPageParam, pageSlice, PER_PAGE } from "@/lib/pagination";
import { CompanyList } from "./company-list";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priceLevel?: string; approval?: string; active?: string; q?: string; page?: string }>;
}) {
  const { status, priceLevel, approval, active, q, page } = await searchParams;

  const pageNum = getPageParam(page);
  const perPage = PER_PAGE.admin;

  const where: Record<string, unknown> = {};
  if (priceLevel) where.priceLevelId = priceLevel;
  if (approval) where.approvalStatus = approval;
  if (active === "true") where.active = true;
  if (active === "false") where.active = false;
  if (q) where.name = { contains: escapeLike(q), mode: "insensitive" };

  const [priceLevels, totalCount] = await Promise.all([
    prisma.priceLevel.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.company.count({ where }),
  ]);

  const { meta: pageMeta, skip, take } = pageSlice(totalCount, pageNum, perPage);

  const companies = await prisma.company.findMany({
    where,
    // name is not unique; id tiebreaker keeps ordering stable across pages.
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip,
    take,
    include: {
      priceLevel: { select: { name: true } },
      _count: { select: { customers: true, orders: true } },
    },
  });

  const data = companies.map((c) => ({
    id: c.id,
    name: c.name,
    priceLevelName: c.priceLevel.name,
    contactCount: c._count.customers,
    orderCount: c._count.orders,
    approvalStatus: c.approvalStatus,
    active: c.active,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Companies</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            Manage dealer companies, contacts, and addresses.
          </p>
        </div>
      </div>

      {status === "deleted" && (
        <div className="status-message status-success">Company deleted successfully.</div>
      )}

      <CompanyList
        data={data}
        priceLevels={priceLevels}
        filters={{ priceLevel, approval, active, q }}
      />

      <Pagination
        meta={{ ...pageMeta }}
        basePath="/admin/companies"
        filters={{ priceLevel, approval, active, q }}
        label="companies"
      />
    </div>
  );
}
