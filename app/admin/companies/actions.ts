"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
} from "@/lib/email";
import type { ApprovalStatus } from "@prisma/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function companyPath(id: string) {
  return `/admin/companies/${id}`;
}

function extractErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 12; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type FormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
  tempPassword?: string;
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

const companySchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or less"),
  priceLevelId: z.string().min(1, "Price level is required"),
  phone: z
    .union([z.string().max(30), z.null()])
    .optional()
    .transform((v) => v || undefined),
  notes: z
    .union([z.string().max(2000, "Notes must be 2000 characters or less"), z.null()])
    .optional()
    .transform((v) => v || undefined),
  active: z.boolean().optional().default(true),
});

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  phone: z
    .union([z.string().max(30), z.null()])
    .optional()
    .transform((v) => v || undefined),
  title: z
    .union([z.string().max(100), z.null()])
    .optional()
    .transform((v) => v || undefined),
});

const addressSchema = z.object({
  label: z.string().min(1, "Label is required").max(100),
  line1: z.string().min(1, "Address line 1 is required").max(200),
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

// ═══════════════════════════════════════════════════════════════════════════════
// Company CRUD
// ═══════════════════════════════════════════════════════════════════════════════

export async function createCompany(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    priceLevelId: formData.get("priceLevelId"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const company = await prisma.company.create({
    data: {
      name: parsed.data.name,
      priceLevelId: parsed.data.priceLevelId,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
      active: parsed.data.active,
    },
  });

  redirect(companyPath(company.id));
}

export async function updateCompany(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    priceLevelId: formData.get("priceLevelId"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  await prisma.company.update({
    where: { id },
    data: {
      name: parsed.data.name,
      priceLevelId: parsed.data.priceLevelId,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
      active: parsed.data.active,
    },
  });

  revalidatePath(companyPath(id));
  return { success: true };
}

export async function toggleCompanyActive(id: string): Promise<FormState> {
  await requireAdmin();
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return { error: "Company not found" };

  await prisma.company.update({
    where: { id },
    data: { active: !company.active },
  });

  revalidatePath("/admin/companies");
  return {};
}

export async function updateCompanyApproval(
  id: string,
  status: ApprovalStatus,
): Promise<FormState> {
  await requireAdmin();

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      customers: { select: { name: true, email: true } },
    },
  });
  if (!company) return { error: "Company not found" };

  await prisma.company.update({
    where: { id },
    data: { approvalStatus: status },
  });

  // Send approval/rejection emails to all contacts
  for (const contact of company.customers) {
    if (status === "APPROVED") {
      sendRegistrationApprovedEmail(contact.email, contact.name, company.name).catch(
        (err) => console.error("Failed to send approval email:", err),
      );
    } else if (status === "REJECTED") {
      sendRegistrationRejectedEmail(contact.email, contact.name, company.name).catch(
        (err) => console.error("Failed to send rejection email:", err),
      );
    }
  }

  revalidatePath(companyPath(id));
  revalidatePath("/admin/companies");
  return {};
}

export async function deleteCompany(id: string): Promise<FormState> {
  await requireAdmin();

  const company = await prisma.company.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });

  if (!company) return { error: "Company not found" };

  if (company._count.orders > 0) {
    return { error: "Cannot delete — this company has order history. Deactivate it instead." };
  }

  // Delete children in order
  const customers = await prisma.customer.findMany({
    where: { companyId: id },
    select: { id: true, userId: true },
  });
  for (const c of customers) {
    await prisma.cart.deleteMany({ where: { customerId: c.id } });
    await prisma.customer.delete({ where: { id: c.id } });
    await prisma.user.delete({ where: { id: c.userId } });
  }
  await prisma.address.deleteMany({ where: { companyId: id } });
  await prisma.company.delete({ where: { id } });

  redirect("/admin/companies?status=deleted");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Customer Contacts
// ═══════════════════════════════════════════════════════════════════════════════

export async function addCustomerContact(
  companyId: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    title: formData.get("title"),
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  // Check if email already in use
  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existingUser) {
    return { errors: { email: "A user with this email already exists" } };
  }

  // Use custom password if provided, otherwise auto-generate
  const customPassword = (formData.get("password") as string)?.trim();
  if (customPassword && customPassword.length > 0 && customPassword.length < 8) {
    return { errors: { password: "Password must be at least 8 characters" } };
  }
  const tempPassword = customPassword && customPassword.length >= 8 ? customPassword : generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      password: hashedPassword,
      name: parsed.data.name,
      role: "CUSTOMER",
      mustChangePassword: true,
    },
  });

  await prisma.customer.create({
    data: {
      companyId,
      userId: user.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      title: parsed.data.title,
    },
  });

  // Send welcome email (fire-and-forget)
  sendWelcomeEmail(parsed.data.email, parsed.data.name, tempPassword).catch((err) =>
    console.error("Failed to send welcome email:", err),
  );

  revalidatePath(companyPath(companyId));
  return { success: true, tempPassword };
}

export async function updateCustomerContact(
  customerId: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    title: formData.get("title"),
  });

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { error: "Contact not found" };

  // Check email uniqueness (excluding this user)
  const existingUser = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: customer.userId } },
  });
  if (existingUser) {
    return { errors: { email: "A user with this email already exists" } };
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      title: parsed.data.title,
    },
  });

  await prisma.user.update({
    where: { id: customer.userId },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
    },
  });

  revalidatePath(companyPath(customer.companyId));
  return { success: true };
}

export async function toggleCustomerActive(customerId: string): Promise<FormState> {
  await requireAdmin();
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { error: "Contact not found" };

  const newActive = !customer.active;
  await prisma.customer.update({
    where: { id: customerId },
    data: { active: newActive },
  });
  await prisma.user.update({
    where: { id: customer.userId },
    data: { active: newActive },
  });

  revalidatePath(companyPath(customer.companyId));
  return {};
}

export async function resetCustomerPassword(customerId: string, customPassword?: string): Promise<FormState> {
  await requireAdmin();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!customer) return { error: "Contact not found" };

  if (customPassword && customPassword.length > 0 && customPassword.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const tempPassword = customPassword && customPassword.length >= 8 ? customPassword : generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  await prisma.user.update({
    where: { id: customer.userId },
    data: { password: hashedPassword, mustChangePassword: true },
  });

  sendPasswordResetEmail(customer.email, customer.name, tempPassword).catch((err) =>
    console.error("Failed to send password reset email:", err),
  );

  revalidatePath(companyPath(customer.companyId));
  return { success: true, tempPassword };
}

export async function deleteCustomerContact(customerId: string): Promise<FormState> {
  await requireAdmin();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      _count: { select: { orders: true } },
    },
  });

  if (!customer) return { error: "Contact not found" };

  if (customer._count.orders > 0) {
    return { error: "Cannot delete — this contact has order history. Deactivate instead." };
  }

  await prisma.cart.deleteMany({ where: { customerId } });
  await prisma.customer.delete({ where: { id: customerId } });
  await prisma.user.delete({ where: { id: customer.userId } });

  revalidatePath(companyPath(customer.companyId));
  return {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Addresses
// ═══════════════════════════════════════════════════════════════════════════════

export async function addAddress(
  companyId: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

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

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  // If setting as default, unset existing default
  if (parsed.data.isDefault) {
    await prisma.address.updateMany({
      where: { companyId, isDefault: true },
      data: { isDefault: false },
    });
  }

  await prisma.address.create({
    data: {
      companyId,
      label: parsed.data.label,
      line1: parsed.data.line1,
      line2: parsed.data.line2,
      city: parsed.data.city,
      state: parsed.data.state,
      postalCode: parsed.data.postalCode,
      country: parsed.data.country,
      isDefault: parsed.data.isDefault,
    },
  });

  revalidatePath(companyPath(companyId));
  return { success: true };
}

export async function updateAddress(
  addressId: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

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

  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address) return { error: "Address not found" };

  if (parsed.data.isDefault && !address.isDefault) {
    await prisma.address.updateMany({
      where: { companyId: address.companyId, isDefault: true },
      data: { isDefault: false },
    });
  }

  await prisma.address.update({
    where: { id: addressId },
    data: {
      label: parsed.data.label,
      line1: parsed.data.line1,
      line2: parsed.data.line2,
      city: parsed.data.city,
      state: parsed.data.state,
      postalCode: parsed.data.postalCode,
      country: parsed.data.country,
      isDefault: parsed.data.isDefault,
    },
  });

  revalidatePath(companyPath(address.companyId));
  return { success: true };
}

export async function deleteAddress(addressId: string): Promise<FormState> {
  await requireAdmin();

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address) return { error: "Address not found" };

  await prisma.address.delete({ where: { id: addressId } });

  // If it was the default, promote the next one
  if (address.isDefault) {
    const next = await prisma.address.findFirst({
      where: { companyId: address.companyId },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  revalidatePath(companyPath(address.companyId));
  return {};
}

export async function setDefaultAddress(addressId: string): Promise<FormState> {
  await requireAdmin();

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address) return { error: "Address not found" };

  await prisma.$transaction([
    prisma.address.updateMany({
      where: { companyId: address.companyId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath(companyPath(address.companyId));
  return {};
}
