import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

/**
 * Company (dealer) service for the admin API. A Company is the dealer org that
 * orders are attached to; it must reference a PriceLevel. Resolves PriceLevel /
 * TaxRate by NAME so callers don't need ids. Additive — create + update only.
 */

export const createCompanySchema = z.object({
  name: z.string().trim().min(1),
  priceLevel: z.string().trim().min(1), // PriceLevel NAME, resolved to an id
  taxRate: z.string().trim().min(1).optional().nullable(), // TaxRate NAME (optional)
  phone: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  active: z.boolean().default(true),
});

export type CreateCompanyResult =
  | { status: "created"; companyId: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

export async function listPriceLevels() {
  return prisma.priceLevel.findMany({
    select: { id: true, name: true, discountPercent: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createCompany(raw: unknown, actorUserId: string): Promise<CreateCompanyResult> {
  const parsed = createCompanySchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const input = parsed.data;

  // PriceLevel.name is not unique — detect ambiguity rather than binding to an arbitrary tier.
  const priceLevels = await prisma.priceLevel.findMany({ where: { name: input.priceLevel }, select: { id: true }, take: 2 });
  if (priceLevels.length === 0) return { status: "skipped", reason: `price-level-not-found:${input.priceLevel}` };
  if (priceLevels.length > 1) return { status: "skipped", reason: `price-level-ambiguous:${input.priceLevel}` };
  const priceLevel = priceLevels[0];

  let taxRateId: string | null = null;
  if (input.taxRate) {
    const taxRate = await prisma.taxRate.findFirst({ where: { name: input.taxRate }, select: { id: true } });
    if (!taxRate) return { status: "skipped", reason: `tax-rate-not-found:${input.taxRate}` };
    taxRateId = taxRate.id;
  }

  // NOTE: Company.name has no unique constraint, so this de-dup is best-effort
  // (two truly-concurrent identical POSTs could both create). Acceptable for a
  // single serialized automation caller; companies are not order-snapshotted.
  const existing = await prisma.company.findFirst({ where: { name: input.name }, select: { id: true } });
  if (existing) return { status: "skipped", reason: "company-name-exists" };

  const company = await prisma.company.create({
    data: {
      name: input.name,
      priceLevelId: priceLevel.id,
      taxRateId,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      active: input.active,
    },
  });

  await logAudit({
    action: "COMPANY_CREATE",
    userId: actorUserId,
    targetId: company.id,
    targetType: "Company",
    details: { via: "admin-api", name: input.name, priceLevel: input.priceLevel },
  });

  return { status: "created", companyId: company.id };
}
