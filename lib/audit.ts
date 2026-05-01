import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

type AuditAction =
  | "ACT_AS_CUSTOMER"
  | "EXIT_ACT_AS"
  | "UPDATE_SITE_SETTINGS"
  | "UPDATE_FEATURE_TOGGLE"
  | "UPDATE_SHIPPING_SETTINGS"
  | "UPDATE_DEFAULT_TAX_RATE"
  | "UPDATE_ANNOUNCEMENT_BANNER"
  | "UPDATE_NOTIFICATION_EMAILS"
  | "CREATE_ADMIN_USER"
  | "UPDATE_ADMIN_USER"
  | "TOGGLE_ADMIN_USER_ACTIVE"
  | "APPROVE_COMPANY"
  | "REJECT_COMPANY"
  | "DELETE_PRODUCT"
  | "DELETE_CATEGORY"
  | "CREATE_LOCATOR_DEALER"
  | "UPDATE_LOCATOR_DEALER"
  | "DELETE_LOCATOR_DEALER";

export async function logAudit(params: {
  action: AuditAction;
  userId: string;
  targetId?: string;
  targetType?: string;
  details?: Record<string, unknown>;
}) {
  let ipAddress: string | null = null;
  try {
    const h = await headers();
    ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    // headers() may not be available in all contexts
  }

  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId,
        targetId: params.targetId,
        targetType: params.targetType,
        details: (params.details as Record<string, string>) ?? undefined,
        ipAddress,
      },
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error("[Audit] Failed to log:", params.action, err);
  }
}
