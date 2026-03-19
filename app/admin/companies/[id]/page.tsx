import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateCompany } from "../actions";
import { CompanyEditTabs } from "../company-edit-tabs";

export const dynamic = "force-dynamic";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  const canActAs = session?.user?.role === "SUPER_ADMIN";

  const [company, priceLevels] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
        priceLevel: { select: { name: true } },
        customers: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { createdAt: true } } },
        },
        addresses: { orderBy: { createdAt: "asc" } },
        orders: {
          orderBy: { submittedAt: "desc" },
          take: 50,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            submittedAt: true,
            customer: { select: { name: true } },
            placedByAdmin: { select: { name: true } },
          },
        },
      },
    }),
    prisma.priceLevel.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!company) notFound();

  const boundUpdate = updateCompany.bind(null, id);

  const contactData = company.customers.map((c) => ({
    id: c.id,
    userId: c.userId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    title: c.title,
    active: c.active,
    createdAt: c.user.createdAt.toISOString(),
  }));

  const addressData = company.addresses.map((a) => ({
    id: a.id,
    label: a.label,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
    isDefault: a.isDefault,
  }));

  const orderData = company.orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: Number(o.total),
    submittedAt: o.submittedAt.toISOString(),
    customerName: o.customer.name,
    placedByAdmin: o.placedByAdmin?.name ?? null,
  }));

  return (
    <div>
      <h1>Edit Company</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        {company.name}
      </p>

      <CompanyEditTabs
        companyId={id}
        companyName={company.name}
        approvalStatus={company.approvalStatus}
        formAction={boundUpdate}
        priceLevels={priceLevels}
        defaultValues={{
          name: company.name,
          priceLevelId: company.priceLevelId,
          phone: company.phone ?? undefined,
          notes: company.notes ?? undefined,
          active: company.active,
        }}
        contacts={contactData}
        addresses={addressData}
        orders={orderData}
        canActAs={canActAs}
      />
    </div>
  );
}
