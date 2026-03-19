import { prisma } from "@/lib/prisma";

export type DealerSettings = {
  showProductsToPublic: boolean;
  showPricesToPublic: boolean;
  allowSelfRegistration: boolean;
  requireApprovalForRegistration: boolean;
  requirePONumber: boolean;
  adminNotificationEmail: string;
  shippingMethod: string;
  flatShippingRate: number;
  freeShippingThreshold: number | null;
};

const DEFAULTS: DealerSettings = {
  showProductsToPublic: false,
  showPricesToPublic: false,
  allowSelfRegistration: false,
  requireApprovalForRegistration: true,
  requirePONumber: false,
  adminNotificationEmail: "",
  shippingMethod: "flat",
  flatShippingRate: 0,
  freeShippingThreshold: null,
};

export async function getDealerSettings(): Promise<DealerSettings> {
  const page = await prisma.pageContent.findUnique({
    where: { pageKey: "dealer-settings" },
  });

  if (!page) return DEFAULTS;

  const p = page.payload as Record<string, string>;

  return {
    showProductsToPublic: p.showProductsToPublic === "true",
    showPricesToPublic: p.showPricesToPublic === "true",
    allowSelfRegistration: p.allowSelfRegistration === "true",
    requireApprovalForRegistration: p.requireApprovalForRegistration !== "false",
    requirePONumber: p.requirePONumber === "true",
    adminNotificationEmail: p.adminNotificationEmail ?? "",
    shippingMethod: p.shippingMethod ?? "flat",
    flatShippingRate: parseFloat(p.flatShippingRate ?? "0") || 0,
    freeShippingThreshold: p.freeShippingThreshold
      ? parseFloat(p.freeShippingThreshold)
      : null,
  };
}
