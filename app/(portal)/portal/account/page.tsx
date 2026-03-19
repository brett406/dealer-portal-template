import { auth } from "@/lib/auth";
import { getEffectiveCustomerId } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { AccountClient } from "@/components/portal/AccountClient";
import "./account.css";

export default async function AccountPage() {
  const session = await auth();
  const customerId = session?.user ? getEffectiveCustomerId(session) : null;
  if (!customerId) return <p>Not authorized.</p>;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      user: { select: { email: true } },
      company: {
        include: {
          priceLevel: { select: { name: true } },
          addresses: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!customer) return <p>Not found.</p>;

  const profile = {
    name: customer.name,
    email: customer.user.email,
    phone: customer.phone,
    title: customer.title,
    companyName: customer.company.name,
    priceLevelName: customer.company.priceLevel.name,
  };

  const addresses = customer.company.addresses.map((a) => ({
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

  return (
    <div>
      <h1>My Account</h1>
      <AccountClient profile={profile} addresses={addresses} />
    </div>
  );
}
