import { prisma } from "@/lib/prisma";
import { escapeLike, getPageParam, pageSlice, PER_PAGE } from "@/lib/pagination";
import { OrderList } from "./order-list";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    company?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}) {
  const { status, company, q, dateFrom, dateTo, page } = await searchParams;

  const pageNum = getPageParam(page);
  const perPage = PER_PAGE.admin;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (company) where.companyId = company;
  if (q) where.orderNumber = { contains: escapeLike(q), mode: "insensitive" };
  if (dateFrom || dateTo) {
    const submittedAt: Record<string, Date> = {};
    if (dateFrom) submittedAt.gte = new Date(dateFrom);
    if (dateTo) submittedAt.lte = new Date(dateTo + "T23:59:59");
    where.submittedAt = submittedAt;
  }

  const [totalCount, companies] = await Promise.all([
    prisma.order.count({ where }),
    prisma.company.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const { meta: pageMeta, skip, take } = pageSlice(totalCount, pageNum, perPage);

  const orders = await prisma.order.findMany({
    where,
    // submittedAt can tie; id tiebreaker keeps paging stable.
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    skip,
    take,
    include: {
      company: { select: { name: true } },
      customer: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  const data = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    companyName: o.company.name,
    customerName: o.customer.name,
    itemCount: o._count.items,
    subtotal: Number(o.subtotal),
    total: Number(o.total),
    currency: o.currency,
    status: o.status,
    poNumber: o.poNumber,
    submittedAt: o.submittedAt.toISOString(),
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Orders</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            {totalCount} total orders
          </p>
        </div>
      </div>

      <OrderList
        data={data}
        companies={companies}
        filters={{ status, company, q, dateFrom, dateTo }}
        currentPage={pageMeta.currentPage}
        totalPages={pageMeta.totalPages}
      />
    </div>
  );
}
