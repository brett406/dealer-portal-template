import { prisma } from "@/lib/prisma";
import { createCompany } from "../actions";
import { CompanyInfoForm } from "../company-info-form";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  const [priceLevels, taxRates] = await Promise.all([
    prisma.priceLevel.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.taxRate.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, percent: true },
    }),
  ]);

  return (
    <div>
      <h1>New Company</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Create the company first, then add contacts and addresses.
      </p>

      <div className="co-edit-section">
        <h2>Company Information</h2>
        <CompanyInfoForm
          action={createCompany}
          priceLevels={priceLevels}
          taxRates={taxRates.map((tr) => ({ id: tr.id, label: tr.label, percent: Number(tr.percent) }))}
          submitLabel="Create Company"
          cancelHref="/admin/companies"
        />
      </div>
    </div>
  );
}
