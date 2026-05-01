import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { LocatorDealerForm } from "../locator-dealer-form";
import { updateLocatorDealer, deleteLocatorDealer } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditLocatorDealerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const dealer = await prisma.locatorDealer.findUnique({ where: { id } });
  if (!dealer) notFound();

  const boundUpdate = updateLocatorDealer.bind(null, id);
  const boundDelete = async () => {
    "use server";
    await deleteLocatorDealer(id);
  };

  return (
    <div>
      <h1>Edit Locator Dealer</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>{dealer.name}</p>
      <LocatorDealerForm
        action={boundUpdate}
        defaults={{
          name: dealer.name,
          slug: dealer.slug,
          dealerType: dealer.dealerType ?? "",
          industries: dealer.industries.join(", "),
          line1: dealer.line1 ?? "",
          line2: dealer.line2 ?? "",
          city: dealer.city ?? "",
          region: dealer.region ?? "",
          postalCode: dealer.postalCode ?? "",
          country: dealer.country,
          phone: dealer.phone ?? "",
          email: dealer.email ?? "",
          website: dealer.website ?? "",
          notes: dealer.notes ?? "",
          active: dealer.active,
          sortOrder: dealer.sortOrder,
          latitude: dealer.latitude !== null ? Number(dealer.latitude) : null,
          longitude: dealer.longitude !== null ? Number(dealer.longitude) : null,
        }}
        submitLabel="Save Changes"
        onDelete={boundDelete}
      />
    </div>
  );
}
