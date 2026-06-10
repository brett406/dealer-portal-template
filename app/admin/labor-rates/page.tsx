import { prisma } from "@/lib/prisma";
import { LaborRatesClient } from "./labor-rates-client";

export const dynamic = "force-dynamic";

export default async function LaborRatesPage() {
  const laborRates = await prisma.laborRate.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { laborLines: true } } },
  });

  const data = laborRates.map((rate) => ({
    id: rate.id,
    name: rate.name,
    ratePerHour: Number(rate.ratePerHour),
    archived: rate.archivedAt !== null,
    lineCount: rate._count.laborLines,
  }));

  return (
    <div>
      <h1>Labor Rates</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Hourly labor rates used in BOM costing. Archived rates still cost normally in existing
        BOMs — they are only hidden from the add-labor pickers.
      </p>
      <LaborRatesClient laborRates={data} />
    </div>
  );
}
