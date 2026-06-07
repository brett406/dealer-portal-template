"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";

export type PickerAsset = { id: string; name: string; url: string };

/**
 * List image assets from the media library for the inline MediaPicker.
 * Admin-gated; returns the served URL (Asset.storagePath) for each image.
 */
export async function listImageAssets(): Promise<PickerAsset[]> {
  await requireAdmin();
  const assets = await prisma.asset.findMany({
    where: { mimeType: { startsWith: "image/" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, originalName: true, title: true, storagePath: true },
  });
  return assets.map((a) => ({
    id: a.id,
    name: a.title || a.originalName,
    url: a.storagePath,
  }));
}
