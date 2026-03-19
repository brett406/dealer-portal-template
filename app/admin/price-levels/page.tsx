import { prisma } from "@/lib/prisma";
import { PriceLevelList } from "./price-level-list";

export const dynamic = "force-dynamic";

export default async function PriceLevelsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const priceLevels = await prisma.priceLevel.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { companies: true } } },
  });

  const data = priceLevels.map((pl) => ({
    id: pl.id,
    name: pl.name,
    discountPercent: Number(pl.discountPercent),
    description: pl.description,
    isDefault: pl.isDefault,
    sortOrder: pl.sortOrder,
    companyCount: pl._count.companies,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Price Levels</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            Manage discount tiers for your companies.
          </p>
        </div>
      </div>

      {status === "created" && (
        <div className="status-message status-success">Price level created successfully.</div>
      )}
      {status === "updated" && (
        <div className="status-message status-success">Price level updated successfully.</div>
      )}

      <PriceLevelList data={data} />
    </div>
  );
}
