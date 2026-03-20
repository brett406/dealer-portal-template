"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isSetupComplete, markSetupComplete } from "@/lib/setup";
import { createSampleData } from "@/lib/seed-data";
import { checkRateLimit } from "@/lib/rate-limit";

export type SetupFormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
};

const setupSchema = z
  .object({
    businessName: z.string().min(1, "Business name is required").max(200),
    name: z.string().min(1, "Your name is required").max(100),
    email: z.string().min(1, "Email is required").email("Invalid email"),
    password: z.string().min(12, "Password must be at least 12 characters"),
    confirmPassword: z.string(),
    loadSampleData: z.boolean().optional().default(false),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function completeSetup(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  // Prevent running setup if already complete
  const complete = await isSetupComplete();
  if (complete) {
    return { error: "Setup has already been completed" };
  }

  // Rate limit
  const rl = checkRateLimit("setup", 5, 300);
  if (!rl.allowed) {
    return { error: `Too many attempts. Try again in ${rl.retryAfterSeconds} seconds.` };
  }

  const parsed = setupSchema.safeParse({
    businessName: formData.get("businessName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    loadSampleData: formData.get("loadSampleData") === "on",
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  // Check email not already in use
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (existing) {
    return { errors: { email: "A user with this email already exists" } };
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      password: hashedPassword,
      name: parsed.data.name,
      role: "SUPER_ADMIN",
      mustChangePassword: false,
    },
  });

  // Create default Retail price level (if not from sample data)
  if (!parsed.data.loadSampleData) {
    await prisma.priceLevel.create({
      data: { name: "Retail", discountPercent: 0, isDefault: true, sortOrder: 0, description: "Standard retail pricing" },
    });
  }

  // Save business name to SiteSetting
  await prisma.siteSetting.create({
    data: {
      siteTitle: parsed.data.businessName,
      siteDescription: `${parsed.data.businessName} — Wholesale Farm, Stable & Landscape Tools`,
      contactEmail: parsed.data.email.toLowerCase(),
      notificationEmail: parsed.data.email.toLowerCase(),
    },
  });

  // Default dealer settings
  await prisma.pageContent.upsert({
    where: { pageKey: "dealer-settings" },
    update: {},
    create: {
      pageKey: "dealer-settings",
      payload: {
        showProductsToPublic: "false",
        showPricesToPublic: "false",
        allowSelfRegistration: "false",
        requireApprovalForRegistration: "true",
        requirePONumber: "false",
        adminNotificationEmail: parsed.data.email.toLowerCase(),
        shippingMethod: "flat",
        flatShippingRate: "0",
      },
      seo: {},
    },
  });

  // Load sample data if requested
  if (parsed.data.loadSampleData) {
    try {
      await createSampleData(adminUser.id);
    } catch (err) {
      console.error("Failed to load sample data:", err);
      // Don't fail setup — admin can add data manually
    }
  }

  markSetupComplete();

  return { success: true };
}
