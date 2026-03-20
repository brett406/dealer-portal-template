import { prisma } from "@/lib/prisma";
import { TaxRatesClient } from "./tax-rates-client";

export const dynamic = "force-dynamic";

export default async function TaxRatesPage() {
  const taxRates = await prisma.taxRate.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const data = taxRates.map((tr) => ({
    id: tr.id,
    name: tr.name,
    label: tr.label,
    percent: Number(tr.percent),
    description: tr.description,
    active: tr.active,
    companyCount: 0,
  }));

  // Get company counts
  const counts = await prisma.company.groupBy({
    by: ["taxRateId"],
    _count: true,
    where: { taxRateId: { not: null } },
  });
  const countMap = new Map(counts.map((c) => [c.taxRateId, c._count]));
  for (const rate of data) {
    rate.companyCount = countMap.get(rate.id) ?? 0;
  }

  return (
    <div>
      <h1>Tax Rates</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Canadian province/territory tax rates. Assign to companies — leave unassigned for tax-exempt.
      </p>
      <TaxRatesClient taxRates={data} />
    </div>
  );
}
