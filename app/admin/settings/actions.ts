"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { sendWelcomeEmail, sendTestEmailTo } from "@/lib/email";
import { logAudit } from "@/lib/audit";

export type FormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Site Settings
// ═══════════════════════════════════════════════════════════════════════════════

export async function updateSiteSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSuperAdmin();

  const data = {
    siteTitle: (formData.get("siteTitle") as string) || "Dealer Portal",
    siteDescription: (formData.get("siteDescription") as string) || null,
    contactEmail: (formData.get("contactEmail") as string) || null,
    contactPhone: (formData.get("contactPhone") as string) || null,
    contactAddress: (formData.get("contactAddress") as string) || null,
    notificationEmail: (formData.get("notificationEmail") as string) || null,
    googleAnalyticsId: (formData.get("googleAnalyticsId") as string) || null,
  };

  const existing = await prisma.siteSetting.findFirst();

  if (existing) {
    await prisma.siteSetting.update({ where: { id: existing.id }, data });
  } else {
    await prisma.siteSetting.create({ data });
  }

  await logAudit({ action: "UPDATE_SITE_SETTINGS", userId: user.id, targetType: "Settings" });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Feature Toggles (dealer-settings PageContent)
// ═══════════════════════════════════════════════════════════════════════════════

async function getDealerPayload(): Promise<Record<string, string>> {
  const page = await prisma.pageContent.findUnique({
    where: { pageKey: "dealer-settings" },
  });
  return (page?.payload as Record<string, string>) ?? {};
}

async function saveDealerPayload(payload: Record<string, string>) {
  await prisma.pageContent.upsert({
    where: { pageKey: "dealer-settings" },
    update: { payload },
    create: { pageKey: "dealer-settings", payload, seo: {} },
  });
}

export async function updateFeatureToggle(
  key: string,
  value: boolean,
): Promise<FormState> {
  const user = await requireSuperAdmin();

  const payload = await getDealerPayload();
  const oldValue = payload[key];
  payload[key] = String(value);
  await saveDealerPayload(payload);

  await logAudit({ action: "UPDATE_FEATURE_TOGGLE", userId: user.id, targetType: "Settings", details: { key, oldValue, newValue: value } });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shipping Settings
// ═══════════════════════════════════════════════════════════════════════════════

export async function updateShippingSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSuperAdmin();

  const shippingMethod = (formData.get("shippingMethod") as string) || "flat";
  const flatShippingRate = formData.get("flatShippingRate") as string;
  const freeShippingThreshold = formData.get("freeShippingThreshold") as string;

  const payload = await getDealerPayload();
  payload.shippingMethod = shippingMethod;
  payload.flatShippingRate = flatShippingRate || "0";

  if (freeShippingThreshold) {
    payload.freeShippingThreshold = freeShippingThreshold;
  } else {
    delete payload.freeShippingThreshold;
  }

  await saveDealerPayload(payload);

  await logAudit({ action: "UPDATE_SHIPPING_SETTINGS", userId: user.id, targetType: "Settings", details: { shippingMethod } });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Tax Rate
// ═══════════════════════════════════════════════════════════════════════════════

export async function updateDefaultTaxRate(taxRateId: string): Promise<FormState> {
  const user = await requireSuperAdmin();

  const payload = await getDealerPayload();
  payload.defaultTaxRateId = taxRateId || "";
  await saveDealerPayload(payload);

  await logAudit({ action: "UPDATE_DEFAULT_TAX_RATE", userId: user.id, targetType: "Settings", details: { taxRateId } });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Announcement Banner
// ═══════════════════════════════════════════════════════════════════════════════

export async function updateAnnouncementBanner(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSuperAdmin();

  const payload = await getDealerPayload();
  payload.announcementBannerEnabled = formData.get("enabled") === "on" ? "true" : "false";
  payload.announcementBannerText = (formData.get("text") as string) || "";
  payload.announcementBannerBgColor = (formData.get("bgColor") as string) || "#1e40af";
  payload.announcementBannerTextColor = (formData.get("textColor") as string) || "#ffffff";

  await saveDealerPayload(payload);

  await logAudit({ action: "UPDATE_ANNOUNCEMENT_BANNER", userId: user.id, targetType: "Settings", details: { enabled: payload.announcementBannerEnabled } });

  revalidatePath("/admin/settings");
  revalidatePath("/portal");
  revalidatePath("/");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Email Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export async function updateAdminNotificationEmails(
  emails: string,
): Promise<FormState> {
  const user = await requireSuperAdmin();

  const payload = await getDealerPayload();
  payload.adminNotificationEmails = emails;
  delete payload.adminNotificationEmail;
  await saveDealerPayload(payload);

  await logAudit({ action: "UPDATE_NOTIFICATION_EMAILS", userId: user.id, targetType: "Settings", details: { emails } });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function sendTestEmail(): Promise<FormState> {
  await requireSuperAdmin();

  if (!process.env.RESEND_API_KEY) {
    return { error: "RESEND_API_KEY is not configured. Set it in your hosting environment variables." };
  }

  const payload = await getDealerPayload();
  const emailsStr = payload.adminNotificationEmails ?? payload.adminNotificationEmail ?? "";
  const firstEmail = emailsStr.split(",").map((e: string) => e.trim()).filter(Boolean)[0];
  if (!firstEmail) {
    return { error: "No admin notification email configured" };
  }

  try {
    await sendTestEmailTo(firstEmail);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { error: `Failed to send test email: ${msg}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin/Staff User Management
// ═══════════════════════════════════════════════════════════════════════════════

const adminUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  role: z.enum(["SUPER_ADMIN", "STAFF"]),
});

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 12; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

export async function createAdminUser(
  formData: FormData,
): Promise<FormState & { tempPassword?: string }> {
  const currentUser = await requireSuperAdmin();

  const parsed = adminUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    return { errors: { email: "A user with this email already exists" } };
  }

  const tempPassword = generateTempPassword();
  const hashed = await bcrypt.hash(tempPassword, 12);

  await prisma.user.create({
    data: {
      email: parsed.data.email,
      password: hashed,
      name: parsed.data.name,
      role: parsed.data.role,
      mustChangePassword: true,
    },
  });

  sendWelcomeEmail(parsed.data.email, parsed.data.name, tempPassword).catch(
    (err) => console.error("Failed to send welcome email:", err),
  );

  await logAudit({ action: "CREATE_ADMIN_USER", userId: currentUser.id, targetType: "User", details: { email: parsed.data.email, role: parsed.data.role } });

  revalidatePath("/admin/settings");
  return { success: true, tempPassword };
}

export async function updateAdminUser(
  userId: string,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireSuperAdmin();

  const parsed = adminUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  const existing = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: userId } },
  });
  if (existing) {
    return { errors: { email: "A user with this email already exists" } };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
    },
  });

  await logAudit({ action: "UPDATE_ADMIN_USER", userId: currentUser.id, targetId: userId, targetType: "User", details: { email: parsed.data.email, role: parsed.data.role } });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function toggleAdminUserActive(
  userId: string,
  currentUserId: string,
): Promise<FormState> {
  const currentUser = await requireSuperAdmin();

  if (userId === currentUserId) {
    return { error: "You cannot deactivate your own account" };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "User not found" };

  // If deactivating, check not the last SUPER_ADMIN
  if (user.active && user.role === "SUPER_ADMIN") {
    const superAdminCount = await prisma.user.count({
      where: { role: "SUPER_ADMIN", active: true },
    });
    if (superAdminCount <= 1) {
      return { error: "Cannot deactivate the last Super Admin" };
    }
  }

  const newActive = !user.active;
  await prisma.user.update({
    where: { id: userId },
    data: { active: newActive },
  });

  await logAudit({ action: "TOGGLE_ADMIN_USER_ACTIVE", userId: currentUser.id, targetId: userId, targetType: "User", details: { email: user.email, active: newActive } });

  revalidatePath("/admin/settings");
  return {};
}
