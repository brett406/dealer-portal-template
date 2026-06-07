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
  | "UPDATE_PRICE_LEVEL"
  | "DELETE_PRICE_LEVEL"
  | "UPDATE_TAX_RATE"
  | "CREATE_LOCATOR_DEALER"
  | "UPDATE_LOCATOR_DEALER"
  | "DELETE_LOCATOR_DEALER"
  | "CREATE_ASSET_FOLDER"
  | "RENAME_ASSET_FOLDER"
  | "RECOLOR_ASSET_FOLDER"
  | "DELETE_ASSET_FOLDER"
  | "REORDER_ASSET_FOLDERS"
  | "MOVE_ASSETS"
  // Admin API (server-to-server automation)
  | "PRODUCT_CREATE"
  | "PRODUCT_UPDATE"
  | "CATEGORY_CREATE"
  | "ASSET_UPLOAD"
  | "COLLECTION_ITEM_CREATE"
  | "COLLECTION_ITEM_UPDATE"
  | "COMPANY_CREATE"
  | "COMPANY_UPDATE";

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
