"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { getEffectiveCustomerId } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";

type FormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
};

// ─── Profile ─────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z
    .union([z.string().max(30), z.null()])
    .optional()
    .transform((v) => v || undefined),
  title: z
    .union([z.string().max(100), z.null()])
    .optional()
    .transform((v) => v || undefined),
});

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const customerId = getEffectiveCustomerId(session);
  if (!customerId) return { error: "No customer context" };

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { error: "Customer not found" };

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      title: parsed.data.title,
    },
  });

  await prisma.user.update({
    where: { id: customer.userId },
    data: { name: parsed.data.name },
  });

  revalidatePath("/portal/account");
  return { success: true };
}

// ─── Password ────────────────────────────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(12, "Password must be at least 12 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function changePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  if (!user) return { error: "User not found" };

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!valid) return { errors: { currentPassword: "Incorrect password" } };

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed, mustChangePassword: false },
  });

  return { success: true };
}

// ─── Addresses ───────────────────────────────────────────────────────────────

const addressSchema = z.object({
  label: z.string().min(1, "Label is required").max(100),
  line1: z.string().min(1, "Address is required").max(200),
  line2: z
    .union([z.string().max(200), z.null()])
    .optional()
    .transform((v) => v || undefined),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().optional().default("US"),
  isDefault: z.boolean().optional().default(false),
});

async function getCompanyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;
  const customerId = getEffectiveCustomerId(session);
  if (!customerId) return null;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { companyId: true },
  });
  return customer?.companyId ?? null;
}

export async function addAccountAddress(formData: FormData): Promise<FormState> {
  const companyId = await getCompanyId();
  if (!companyId) return { error: "Not authorized" };

  const parsed = addressSchema.safeParse({
    label: formData.get("label"),
    line1: formData.get("line1"),
    line2: formData.get("line2"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country") || "US",
    isDefault: formData.get("isDefault") === "on",
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path[0] as string] = issue.message;
    return { errors };
  }

  if (parsed.data.isDefault) {
    await prisma.address.updateMany({
      where: { companyId, isDefault: true },
      data: { isDefault: false },
    });
  }

  await prisma.address.create({
    data: { companyId, ...parsed.data },
  });

  revalidatePath("/portal/account");
  return { success: true };
}

export async function deleteAccountAddress(addressId: string): Promise<FormState> {
  const companyId = await getCompanyId();
  if (!companyId) return { error: "Not authorized" };

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.companyId !== companyId) return { error: "Address not found" };

  await prisma.address.delete({ where: { id: addressId } });

  if (address.isDefault) {
    const next = await prisma.address.findFirst({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  revalidatePath("/portal/account");
  return {};
}

export async function setDefaultAccountAddress(addressId: string): Promise<FormState> {
  const companyId = await getCompanyId();
  if (!companyId) return { error: "Not authorized" };

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.companyId !== companyId) return { error: "Address not found" };

  await prisma.$transaction([
    prisma.address.updateMany({
      where: { companyId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath("/portal/account");
  return {};
}
