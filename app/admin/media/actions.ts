"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { saveUpload, deleteUpload } from "@/lib/uploads";

export type FormState = {
  error?: string;
  success?: boolean;
};

export async function uploadMedia(formData: FormData): Promise<FormState> {
  const user = await requireAdmin();

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { error: "No file provided" };
  }

  try {
    const result = await saveUpload(file);

    await prisma.asset.create({
      data: {
        filename: result.filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        storagePath: result.url,
        updatedByEmail: user.email,
      },
    });

    revalidatePath("/admin/media");
    return { success: true };
  } catch (err) {
    console.error("Media upload failed:", err);
    return { error: "Upload failed" };
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
