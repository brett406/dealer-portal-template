"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { logAudit } from "@/lib/audit";
import { repriceAll } from "@/lib/bom/reprice";

export type FormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
};

// §15: name 1–100 unique; ratePerHour ≥ 0, ≤ 99,999,999.99, 2dp.
const laborRateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  ratePerHour: z.coerce
    .number()
    .min(0, "Rate must be 0 or greater")
    .max(99_999_999.99, "Rate cannot exceed 99,999,999.99"),
});

function extractErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}

export async function createLaborRate(formData: FormData): Promise<FormState> {
  const user = await requireAdmin();

  const parsed = laborRateSchema.safeParse({
    name: formData.get("name"),
    ratePerHour: formData.get("ratePerHour"),
  });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const existing = await prisma.laborRate.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { errors: { name: "A labor rate with this name already exists" } };

  const rate = await prisma.laborRate.create({
    data: {
      name: parsed.data.name,
      // Write as a 2dp string so the stored Decimal(10,2) is scale-exact (§15).
      ratePerHour: parsed.data.ratePerHour.toFixed(2),
    },
  });

  await logAudit({
    action: "LABOR_RATE_CREATE",
    userId: user.id,
    targetId: rate.id,
    targetType: "LaborRate",
    details: { name: rate.name, ratePerHour: rate.ratePerHour.toFixed(2) },
  });

  revalidatePath("/admin/labor-rates");
  return { success: true };
}

export async function updateLaborRate(id: string, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();

  const parsed = laborRateSchema.safeParse({
    name: formData.get("name"),
    ratePerHour: formData.get("ratePerHour"),
  });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const rate = await prisma.laborRate.findUnique({ where: { id } });
  if (!rate) return { error: "Labor rate not found" };

  const duplicate = await prisma.laborRate.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  });
  if (duplicate) return { errors: { name: "A labor rate with this name already exists" } };

  const nextRate = parsed.data.ratePerHour.toFixed(2);
  const rateChanged = rate.ratePerHour.toFixed(2) !== nextRate;

  await prisma.laborRate.update({
    where: { id },
    data: { name: parsed.data.name, ratePerHour: nextRate },
  });

  await logAudit({
    action: "LABOR_RATE_UPDATE",
    userId: user.id,
    targetId: id,
    targetType: "LaborRate",
    details: {
      name: parsed.data.name,
      ratePerHourBefore: rate.ratePerHour.toFixed(2),
      ratePerHourAfter: nextRate,
    },
  });

  // A ratePerHour change is cost-affecting (§5) — reprice only when it actually changed.
  if (rateChanged) {
    await repriceAll({ trigger: "LABOR_RATE_UPDATE", userId: user.id });
  }

  revalidatePath("/admin/labor-rates");
  return { success: true };
}

/**
 * Archive/unarchive (§13.2): an archived rate still costs normally in existing
 * BOMs — it is only excluded from the add-labor pickers.
 */
export async function toggleLaborRateArchived(id: string): Promise<FormState> {
  const user = await requireAdmin();

  const rate = await prisma.laborRate.findUnique({ where: { id } });
  if (!rate) return { error: "Labor rate not found" };

  const archiving = rate.archivedAt === null;
  await prisma.laborRate.update({
    where: { id },
    data: { archivedAt: archiving ? new Date() : null },
  });

  await logAudit({
    action: "LABOR_RATE_ARCHIVE",
    userId: user.id,
    targetId: id,
    targetType: "LaborRate",
    details: { name: rate.name, archived: archiving },
  });

  revalidatePath("/admin/labor-rates");
  return {};
}

export async function deleteLaborRate(id: string): Promise<FormState> {
  await requireAdmin();

  const rate = await prisma.laborRate.findUnique({
    where: { id },
    include: { _count: { select: { laborLines: true } } },
  });
  if (!rate) return { error: "Labor rate not found" };

  if (rate._count.laborLines > 0) {
    return {
      error: `Cannot delete — in use by ${rate._count.laborLines} BOM line${rate._count.laborLines === 1 ? "" : "s"} — archive instead.`,
    };
  }

  try {
    await prisma.laborRate.delete({ where: { id } });
  } catch (err) {
    // Race fallback: a line was added between the count and the delete (Restrict).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      const count = await prisma.bomLaborLine.count({ where: { laborRateId: id } });
      return {
        error: `Cannot delete — in use by ${count} BOM line${count === 1 ? "" : "s"} — archive instead.`,
      };
    }
    throw err;
  }

  revalidatePath("/admin/labor-rates");
  return {};
}
