import Link from "next/link";
import { auth } from "@/lib/auth";
import { getEffectiveCustomerId } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { OrderListClient } from "@/components/portal/OrderListClient";
import "./orders.css";

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

  const pageNum = Math.max(1, parseInt(page ?? "1") || 1);
  const perPage = 15;

  const where: Record<string, unknown> = { companyId: customer.companyId };
  if (status) where.status = status;

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (pageNum - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        poNumber: true,
        submittedAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const data = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: Number(o.total),
    poNumber: o.poNumber,
    submittedAt: o.submittedAt.toISOString(),
    itemCount: o._count.items,
  }));

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div>
      <h1>Order History</h1>
      <OrderListClient
        orders={data}
        currentPage={pageNum}
        totalPages={totalPages}
        filters={{ status }}
      />
    </div>
  );
}
