import { prisma } from "@/lib/prisma";

export type ShippingSettings = {
  shippingMethod: string;
  flatShippingRate: number;
  freeShippingThreshold: number | null;
};

/**
 * Read shipping settings from the dealer-settings PageContent entry.
 */
export async function getShippingSettings(): Promise<ShippingSettings> {
  const page = await prisma.pageContent.findUnique({
    where: { pageKey: "dealer-settings" },
  });

  if (!page) {
    return { shippingMethod: "flat", flatShippingRate: 0, freeShippingThreshold: null };
  }

  const payload = page.payload as Record<string, string>;

  return {
    shippingMethod: payload.shippingMethod ?? "flat",
    flatShippingRate: parseFloat(payload.flatShippingRate ?? "0") || 0,
    freeShippingThreshold: payload.freeShippingThreshold
      ? parseFloat(payload.freeShippingThreshold)
      : null,
  };
}

/**
 * Calculate shipping cost for a given subtotal.
 * Pure function when settings are provided.
 */
export function calculateShippingFromSettings(
  subtotal: number,
  settings: ShippingSettings,
): number {
  if (settings.shippingMethod !== "flat") {
    return 0;
  }

  // Free shipping above threshold
  if (
    settings.freeShippingThreshold !== null &&
    subtotal >= settings.freeShippingThreshold
  ) {
    return 0;
  }

  return Math.round(settings.flatShippingRate * 100) / 100;
}

/**
 * Calculate shipping by reading settings from DB.
 */
export async function calculateShipping(subtotal: number): Promise<number> {
  const settings = await getShippingSettings();
  return calculateShippingFromSettings(subtotal, settings);
}
