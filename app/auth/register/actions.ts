"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getDealerSettings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  sendRegistrationPendingEmail,
  sendSelfRegistrationWelcomeEmail,
} from "@/lib/email";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RegisterFormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
  pending?: boolean;
};

// ─── Validation ──────────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    companyName: z.string().min(1, "Company name is required").max(200),
    name: z.string().min(1, "Name is required").max(100),
    email: z.string().min(1, "Email is required").email("Invalid email"),
    phone: z
      .union([z.string().max(30), z.null()])
      .optional()
      .transform((v) => v || undefined),
    password: z.string().min(12, "Password must be at least 12 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ─── Action ──────────────────────────────────────────────────────────────────

export async function registerCustomer(
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  // 0. Rate limit: 3 registrations per 15 minutes per IP
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`register:${ip}`, 3, 900);
  if (!rl.allowed) {
    return { error: `Too many attempts. Please try again in ${rl.retryAfterSeconds} seconds.` };
  }

  // 1. Check registration is enabled
  const settings = await getDealerSettings();
  if (!settings.allowSelfRegistration) {
    return { error: "Registration is not currently available" };
  }

  // 2. Validate form data
  const parsed = registerSchema.safeParse({
    companyName: formData.get("companyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  // 3. Check email not already in use
  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (existingUser) {
    return { errors: { email: "An account with this email already exists" } };
  }

  // 4. Get default price level
  const defaultPriceLevel = await prisma.priceLevel.findFirst({
    where: { isDefault: true },
  });
  if (!defaultPriceLevel) {
    return { error: "System configuration error: no default price level found" };
  }

  // 5. Determine approval status
  const approvalStatus = settings.requireApprovalForRegistration
    ? "PENDING"
    : "APPROVED";

  // 6. Create everything in a transaction
  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

  const { company, customer } = await prisma.$transaction(async (tx) => {
    // Create company
    const company = await tx.company.create({
      data: {
        name: parsed.data.companyName,
        priceLevelId: defaultPriceLevel.id,
        taxRateId: settings.defaultTaxRateId || null,
        approvalStatus: approvalStatus as "PENDING" | "APPROVED",
      },
    });

    // Create user
    const user = await tx.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        password: hashedPassword,
        name: parsed.data.name,
        role: "CUSTOMER",
        mustChangePassword: false,
      },
    });

    // Create customer
    const customer = await tx.customer.create({
      data: {
        companyId: company.id,
        userId: user.id,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        phone: parsed.data.phone,
      },
    });

    // Create default address placeholder
    await tx.address.create({
      data: {
        companyId: company.id,
        label: "Primary",
        line1: "",
        city: "",
        state: "",
        postalCode: "",
        isDefault: true,
      },
    });

    return { company, customer };
  });

  // 7. Send emails
  if (settings.requireApprovalForRegistration) {
    const regEmails = settings.adminNotificationEmails.split(",").map((e) => e.trim()).filter(Boolean);
    for (const adminEmail of regEmails) {
      sendRegistrationPendingEmail(
        adminEmail,
        parsed.data.companyName,
        parsed.data.name,
        parsed.data.email,
      ).catch((err) => console.error("Failed to send registration notification:", err));
    }

    return {
      success: true,
      pending: true,
    };
  } else {
    sendSelfRegistrationWelcomeEmail(
      parsed.data.email,
      parsed.data.name,
      parsed.data.companyName,
    ).catch((err) => console.error("Failed to send welcome email:", err));

    return { success: true };
  }
}
