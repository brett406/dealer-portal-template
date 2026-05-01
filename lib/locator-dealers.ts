import { prisma } from "@/lib/prisma";

export type PublicLocatorDealer = {
  id: string;
  name: string;
  slug: string;
  dealerType: string | null;
  industries: string[];
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
};

/**
 * Fetch all active locator dealers in display order.
 * Decimal fields are converted to plain numbers for client-component use.
 */
export async function getActiveLocatorDealers(): Promise<PublicLocatorDealer[]> {
  const dealers = await prisma.locatorDealer.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return dealers.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    dealerType: d.dealerType,
    industries: d.industries,
    line1: d.line1,
    line2: d.line2,
    city: d.city,
    region: d.region,
    postalCode: d.postalCode,
    country: d.country,
    latitude: d.latitude !== null ? Number(d.latitude) : null,
    longitude: d.longitude !== null ? Number(d.longitude) : null,
    phone: d.phone,
    email: d.email,
    website: d.website,
    notes: d.notes,
  }));
}

/**
 * Aggregate filter options — distinct values for region, dealerType, industries
 * across active dealers. Returned in alphabetical order.
 */
export async function getLocatorFilterOptions(): Promise<{
  regions: string[];
  dealerTypes: string[];
  industries: string[];
}> {
  const dealers = await prisma.locatorDealer.findMany({
    where: { active: true },
    select: { region: true, dealerType: true, industries: true },
  });

  const regionSet = new Set<string>();
  const typeSet = new Set<string>();
  const industrySet = new Set<string>();

  for (const d of dealers) {
    if (d.region) regionSet.add(d.region);
    if (d.dealerType) typeSet.add(d.dealerType);
    for (const ind of d.industries) industrySet.add(ind);
  }

  return {
    regions: [...regionSet].sort(),
    dealerTypes: [...typeSet].sort(),
    industries: [...industrySet].sort(),
  };
}
