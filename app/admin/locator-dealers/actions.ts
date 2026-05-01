"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { logAudit } from "@/lib/audit";
import { geocodeAddress } from "@/lib/geocode";
import { generateSlug } from "@/lib/slug";

export type LocatorDealerFormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
};

const dealerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  slug: z.string().max(200).optional().default(""),
  dealerType: z.string().max(100).optional().default(""),
  industries: z.string().max(500).optional().default(""),
  line1: z.string().max(200).optional().default(""),
  line2: z.string().max(200).optional().default(""),
  city: z.string().max(100).optional().default(""),
  region: z.string().max(100).optional().default(""),
  postalCode: z.string().max(20).optional().default(""),
  country: z.string().max(2).optional().default("CA"),
  phone: z.string().max(50).optional().default(""),
  email: z.string().max(200).optional().default(""),
  website: z.string().max(500).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
  active: z.string().optional(),
  sortOrder: z.string().optional().default("0"),
  geocode: z.string().optional(),
});

function parsedToData(parsed: z.infer<typeof dealerSchema>) {
  return {
    name: parsed.name,
    slug: parsed.slug || generateSlug(parsed.name),
    dealerType: parsed.dealerType || null,
    industries: parsed.industries
      ? parsed.industries.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    line1: parsed.line1 || null,
    line2: parsed.line2 || null,
    city: parsed.city || null,
    region: parsed.region || null,
    postalCode: parsed.postalCode || null,
    country: parsed.country || "CA",
    phone: parsed.phone || null,
    email: parsed.email || null,
    website: parsed.website || null,
    notes: parsed.notes || null,
    active: parsed.active === "on",
    sortOrder: Number.parseInt(parsed.sortOrder || "0", 10) || 0,
  };
}

export async function createLocatorDealer(
  _prev: LocatorDealerFormState,
  formData: FormData,
): Promise<LocatorDealerFormState> {
  const user = await requireAdmin();

  const parsed = dealerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  const data = parsedToData(parsed.data);

  const slugConflict = await prisma.locatorDealer.findUnique({ where: { slug: data.slug } });
  if (slugConflict) return { errors: { slug: "Slug already in use" } };

  // Geocode if requested or if lat/lng aren't manually provided
  let lat: number | null = null;
  let lng: number | null = null;
  if (parsed.data.geocode === "on" && (data.line1 || data.city || data.postalCode)) {
    const geo = await geocodeAddress(data);
    if (geo) {
      lat = geo.latitude;
      lng = geo.longitude;
    }
  }

  const dealer = await prisma.locatorDealer.create({
    data: {
      ...data,
      latitude: lat,
      longitude: lng,
    },
  });

  await logAudit({
    action: "CREATE_LOCATOR_DEALER",
    userId: user.id,
    targetId: dealer.id,
    targetType: "LocatorDealer",
    details: { name: dealer.name },
  });

  revalidatePath("/admin/locator-dealers");
  revalidatePath("/find-a-dealer");
  redirect(`/admin/locator-dealers/${dealer.id}`);
}

export async function updateLocatorDealer(
  id: string,
  _prev: LocatorDealerFormState,
  formData: FormData,
): Promise<LocatorDealerFormState> {
  const user = await requireAdmin();

  const parsed = dealerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  const data = parsedToData(parsed.data);

  const slugConflict = await prisma.locatorDealer.findFirst({
    where: { slug: data.slug, NOT: { id } },
  });
  if (slugConflict) return { errors: { slug: "Slug already in use" } };

  // Geocode if requested
  const update: Record<string, unknown> = { ...data };
  if (parsed.data.geocode === "on" && (data.line1 || data.city || data.postalCode)) {
    const geo = await geocodeAddress(data);
    if (geo) {
      update.latitude = geo.latitude;
      update.longitude = geo.longitude;
    }
  }

  await prisma.locatorDealer.update({ where: { id }, data: update });

  await logAudit({
    action: "UPDATE_LOCATOR_DEALER",
    userId: user.id,
    targetId: id,
    targetType: "LocatorDealer",
    details: { name: data.name },
  });

  revalidatePath("/admin/locator-dealers");
  revalidatePath(`/admin/locator-dealers/${id}`);
  revalidatePath("/find-a-dealer");
  return { success: true };
}

export async function deleteLocatorDealer(id: string) {
  const user = await requireAdmin();

  const dealer = await prisma.locatorDealer.findUnique({ where: { id } });
  if (!dealer) return;

  await prisma.locatorDealer.delete({ where: { id } });

  await logAudit({
    action: "DELETE_LOCATOR_DEALER",
    userId: user.id,
    targetId: id,
    targetType: "LocatorDealer",
    details: { name: dealer.name },
  });

  revalidatePath("/admin/locator-dealers");
  revalidatePath("/find-a-dealer");
  redirect("/admin/locator-dealers");
}
