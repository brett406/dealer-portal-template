"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";

export type FormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
};

const taxRateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  label: z.string().min(1, "Label is required").max(50),
  percent: z.coerce.number().min(0, "Rate must be 0 or greater").max(100, "Rate cannot exceed 100"),
  description: z.string().max(200).optional().transform((v) => v || undefined),
});

export async function createTaxRate(formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = taxRateSchema.safeParse({
    name: formData.get("name"),
    label: formData.get("label"),
    percent: formData.get("percent"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  const existing = await prisma.taxRate.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { errors: { name: "A tax rate with this name already exists" } };

  const lastItem = await prisma.taxRate.findFirst({ orderBy: { sortOrder: "desc" } });
  const sortOrder = (lastItem?.sortOrder ?? -1) + 1;

  await prisma.taxRate.create({
    data: {
      name: parsed.data.name,
      label: parsed.data.label,
      percent: parsed.data.percent,
      description: parsed.data.description,
      sortOrder,
    },
  });

  revalidatePath("/admin/tax-rates");
  return { success: true };
}

export async function updateTaxRate(
  id: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = taxRateSchema.safeParse({
    name: formData.get("name"),
    label: formData.get("label"),
    percent: formData.get("percent"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  const existing = await prisma.taxRate.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  });
  if (existing) return { errors: { name: "A tax rate with this name already exists" } };

  await prisma.taxRate.update({
    where: { id },
    data: {
      name: parsed.data.name,
      label: parsed.data.label,
      percent: parsed.data.percent,
      description: parsed.data.description,
    },
  });

  revalidatePath("/admin/tax-rates");
  return { success: true };
}

export async function toggleTaxRateActive(id: string): Promise<FormState> {
  await requireAdmin();

  const rate = await prisma.taxRate.findUnique({ where: { id } });
  if (!rate) return { error: "Tax rate not found" };

  await prisma.taxRate.update({
    where: { id },
    data: { active: !rate.active },
  });

  revalidatePath("/admin/tax-rates");
  return {};
}
