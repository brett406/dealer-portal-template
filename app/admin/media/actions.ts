"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { deleteUpload } from "@/lib/uploads";

export type FormState = {
  error?: string;
  success?: boolean;
};

export async function createMediaAsset(data: {
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}): Promise<FormState> {
  const user = await requireAdmin();

  try {
    await prisma.asset.create({
      data: {
        filename: data.filename,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        storagePath: data.url,
        updatedByEmail: user.email,
      },
    });

    revalidatePath("/admin/media");
    return { success: true };
  } catch (err) {
    console.error("Media asset creation failed:", err);
    return { error: "Failed to save asset record" };
  }
}

export async function deleteMedia(assetId: string): Promise<FormState> {
  await requireAdmin();

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return { error: "Asset not found" };

  // Delete file from disk/S3
  const filename = asset.storagePath.split("/").pop();
  if (filename) {
    await deleteUpload(filename);
  }

  await prisma.asset.delete({ where: { id: assetId } });

  revalidatePath("/admin/media");
  return {};
}
