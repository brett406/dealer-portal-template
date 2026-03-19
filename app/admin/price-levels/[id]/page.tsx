import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updatePriceLevel } from "../actions";
import { PriceLevelForm } from "../price-level-form";

export const dynamic = "force-dynamic";

export default async function EditPriceLevelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const priceLevel = await prisma.priceLevel.findUnique({ where: { id } });
  if (!priceLevel) notFound();

  const boundUpdate = updatePriceLevel.bind(null, id);

  return (
    <div>
      <h1>Edit Price Level</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Update the &ldquo;{priceLevel.name}&rdquo; pricing tier.
      </p>
      <PriceLevelForm
        action={boundUpdate}
        defaultValues={{
          name: priceLevel.name,
          discountPercent: Number(priceLevel.discountPercent),
          description: priceLevel.description ?? undefined,
          sortOrder: priceLevel.sortOrder,
        }}
        submitLabel="Save Changes"
      />
    </div>
  );
}
