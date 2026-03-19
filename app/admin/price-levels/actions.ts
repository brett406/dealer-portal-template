"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { invalidateCache } from "@/lib/cache";

function invalidatePricingCaches() {
  invalidateCache("pricing:");
  invalidateCache("customer-pricing");
}

// ─── Validation ──────────────────────────────────────────────────────────────

const priceLevelSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  discountPercent: z
    .coerce.number()
    .min(0, "Discount cannot be negative")
    .max(100, "Discount cannot exceed 100%"),
  description: z
    .union([z.string().max(500, "Description must be 500 characters or less"), z.null()])
    .optional()
    .transform((v) => v || undefined),
  sortOrder: z
    .coerce.number()
    .int("Sort order must be a whole number")
    .optional()
    .default(0),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type PriceLevelFormState = {
  errors?: Record<string, string>;
  success?: boolean;
};

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createPriceLevel(
  _prev: PriceLevelFormState,
  formData: FormData,
): Promise<PriceLevelFormState> {
  await requireAdmin();

  const parsed = priceLevelSchema.safeParse({
    name: formData.get("name"),
    discountPercent: formData.get("discountPercent"),
    description: formData.get("description"),
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  // Check unique name
  const existing = await prisma.priceLevel.findFirst({
    where: { name: parsed.data.name },
  });
  if (existing) {
    return { errors: { name: "A price level with this name already exists" } };
  }

  await prisma.priceLevel.create({
    data: {
      name: parsed.data.name,
      discountPercent: parsed.data.discountPercent,
      description: parsed.data.description,
      sortOrder: parsed.data.sortOrder,
    },
  });

  invalidatePricingCaches();
  redirect("/admin/price-levels?status=created");
}

export async function updatePriceLevel(
  id: string,
  _prev: PriceLevelFormState,
  formData: FormData,
): Promise<PriceLevelFormState> {
  await requireAdmin();

  const parsed = priceLevelSchema.safeParse({
    name: formData.get("name"),
    discountPercent: formData.get("discountPercent"),
    description: formData.get("description"),
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  // Check unique name (excluding self)
  const existing = await prisma.priceLevel.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  });
  if (existing) {
    return { errors: { name: "A price level with this name already exists" } };
  }

  await prisma.priceLevel.update({
    where: { id },
    data: {
      name: parsed.data.name,
      discountPercent: parsed.data.discountPercent,
      description: parsed.data.description,
      sortOrder: parsed.data.sortOrder,
    },
  });

  invalidatePricingCaches();
  redirect("/admin/price-levels?status=updated");
}

export async function deletePriceLevel(id: string): Promise<{ error?: string }> {
  await requireAdmin();

  const level = await prisma.priceLevel.findUnique({
    where: { id },
    include: { _count: { select: { companies: true } } },
  });

  if (!level) {
    return { error: "Price level not found" };
  }

  if (level._count.companies > 0) {
    return {
      error: `Cannot delete — ${level._count.companies} company(ies) are assigned to this price level`,
    };
  }

  await prisma.priceLevel.delete({ where: { id } });
  revalidatePath("/admin/price-levels");
  return {};
}

export async function setDefaultPriceLevel(id: string): Promise<{ error?: string }> {
  await requireAdmin();

  await prisma.$transaction([
    prisma.priceLevel.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    prisma.priceLevel.update({ where: { id }, data: { isDefault: true } }),
  ]);

  revalidatePath("/admin/price-levels");
  return {};
}
