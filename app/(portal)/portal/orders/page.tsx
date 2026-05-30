import Link from "next/link";
import { auth } from "@/lib/auth";
import { getEffectiveCustomerId } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { getPageParam, pageSlice, PER_PAGE } from "@/lib/pagination";
import { OrderListClient } from "@/components/portal/OrderListClient";
import "./orders.css";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page } = await searchParams;

  const session = await auth();
  const customerId = session?.user ? getEffectiveCustomerId(session) : null;
  if (!customerId) return <p>Not authorized.</p>;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { companyId: true },
  });
  if (!customer) return <p>Not found.</p>;

  const pageNum = getPageParam(page);
  const perPage = PER_PAGE.portal;

  const where: Record<string, unknown> = { companyId: customer.companyId };
  if (status) where.status = status;

  const totalCount = await prisma.order.count({ where });
  const { meta: pageMeta, skip, take } = pageSlice(totalCount, pageNum, perPage);

  const orders = await prisma.order.findMany({
    where,
    // submittedAt can tie; id tiebreaker keeps paging stable.
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    skip,
    take,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      poNumber: true,
      submittedAt: true,
      _count: { select: { items: true } },
    },
  });

  const data = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: Number(o.total),
    poNumber: o.poNumber,
    submittedAt: o.submittedAt.toISOString(),
    itemCount: o._count.items,
  }));

  return (
    <div>
      <h1>Order History</h1>
      <OrderListClient
        orders={data}
        currentPage={pageMeta.currentPage}
        totalPages={pageMeta.totalPages}
        filters={{ status }}
      />
    </div>
  );
}
