"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { deleteUpload } from "@/lib/uploads";
import { generateSlug } from "@/lib/slug";
import { isFolderColorKey, DEFAULT_FOLDER_COLOR } from "@/lib/folder-colors";
import { logAudit } from "@/lib/audit";

export type FormState = {
  error?: string;
  success?: boolean;
};

/**
 * Generate a slug that is unique across AssetFolders. Appends -2, -3, … on
 * collision. `excludeId` lets a rename keep its own slug.
 */
async function uniqueFolderSlug(name: string, excludeId?: string): Promise<string> {
  const base = generateSlug(name) || "folder";
  let slug = base;
  let n = 1;
  // Bounded by the number of name collisions, which is tiny in practice.
  while (true) {
    const existing = await prisma.assetFolder.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

// ─── Folder CRUD ───────────────────────────────────────────────────────────

export async function createFolder(data: {
  name: string;
  accentColor?: string;
}): Promise<FormState> {
  const user = await requireAdmin();

  const name = data.name?.trim();
  if (!name) return { error: "Folder name is required" };

  const accentColor = isFolderColorKey(data.accentColor)
    ? data.accentColor
    : DEFAULT_FOLDER_COLOR;

  const existingName = await prisma.assetFolder.findUnique({ where: { name } });
  if (existingName) return { error: "A folder with that name already exists" };

  try {
    const slug = await uniqueFolderSlug(name);
    const agg = await prisma.assetFolder.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;

    const folder = await prisma.assetFolder.create({
      data: { name, slug, accentColor, sortOrder, updatedByEmail: user.email },
    });

    await logAudit({
      action: "CREATE_ASSET_FOLDER",
      userId: user.id,
      targetId: folder.id,
      targetType: "AssetFolder",
      details: { name, accentColor },
    });

    revalidatePath("/admin/media");
    return { success: true };
  } catch (err) {
    console.error("createFolder failed:", err);
    return { error: "Failed to create folder" };
  }
}

export async function renameFolder(id: string, name: string): Promise<FormState> {
  const user = await requireAdmin();

  const trimmed = name?.trim();
  if (!trimmed) return { error: "Folder name is required" };

  const folder = await prisma.assetFolder.findUnique({ where: { id } });
  if (!folder) return { error: "Folder not found" };

  const dupe = await prisma.assetFolder.findUnique({ where: { name: trimmed } });
  if (dupe && dupe.id !== id) {
    return { error: "A folder with that name already exists" };
  }

  try {
    const slug = await uniqueFolderSlug(trimmed, id);
    await prisma.assetFolder.update({
      where: { id },
      data: { name: trimmed, slug, updatedByEmail: user.email },
    });

    await logAudit({
      action: "RENAME_ASSET_FOLDER",
      userId: user.id,
      targetId: id,
      targetType: "AssetFolder",
      details: { name: trimmed },
    });

    revalidatePath("/admin/media");
    return { success: true };
  } catch (err) {
    console.error("renameFolder failed:", err);
    return { error: "Failed to rename folder" };
  }
}

export async function setFolderColor(id: string, accentColor: string): Promise<FormState> {
  const user = await requireAdmin();

  if (!isFolderColorKey(accentColor)) return { error: "Invalid color" };

  const folder = await prisma.assetFolder.findUnique({ where: { id } });
  if (!folder) return { error: "Folder not found" };

  try {
    await prisma.assetFolder.update({
      where: { id },
      data: { accentColor, updatedByEmail: user.email },
    });

    await logAudit({
      action: "RECOLOR_ASSET_FOLDER",
      userId: user.id,
      targetId: id,
      targetType: "AssetFolder",
      details: { accentColor },
    });

    revalidatePath("/admin/media");
    return { success: true };
  } catch (err) {
    console.error("setFolderColor failed:", err);
    return { error: "Failed to update folder color" };
  }
}

export async function deleteFolder(id: string): Promise<FormState> {
  const user = await requireAdmin();

  const folder = await prisma.assetFolder.findUnique({ where: { id } });
  if (!folder) return { error: "Folder not found" };

  try {
    // Assets in this folder are NOT deleted — Asset.folderId is set to null via
    // `onDelete: SetNull`, so the files become "unfiled" (visible in All Files).
    await prisma.assetFolder.delete({ where: { id } });

    await logAudit({
      action: "DELETE_ASSET_FOLDER",
      userId: user.id,
      targetId: id,
      targetType: "AssetFolder",
      details: { name: folder.name },
    });

    revalidatePath("/admin/media");
    return { success: true };
  } catch (err) {
    console.error("deleteFolder failed:", err);
    return { error: "Failed to delete folder" };
  }
}

export async function reorderFolders(orderedIds: string[]): Promise<FormState> {
  const user = await requireAdmin();

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { error: "No folders to reorder" };
  }

  try {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.assetFolder.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    await logAudit({
      action: "REORDER_ASSET_FOLDERS",
      userId: user.id,
      targetType: "AssetFolder",
      details: { count: orderedIds.length },
    });

    revalidatePath("/admin/media");
    return { success: true };
  } catch (err) {
    console.error("reorderFolders failed:", err);
    return { error: "Failed to reorder folders" };
  }
}

// ─── Asset organization ──────────────────────────────────────────────────────

export async function moveAssets(
  assetIds: string[],
  folderId: string | null,
): Promise<FormState> {
  const user = await requireAdmin();

  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    return { error: "No files selected" };
  }

  if (folderId) {
    const folder = await prisma.assetFolder.findUnique({ where: { id: folderId } });
    if (!folder) return { error: "Target folder not found" };
  }

  try {
    await prisma.asset.updateMany({
      where: { id: { in: assetIds } },
      data: { folderId },
    });

    await logAudit({
      action: "MOVE_ASSETS",
      userId: user.id,
      targetType: "Asset",
      details: { count: assetIds.length, folderId },
    });

    revalidatePath("/admin/media");
    return { success: true };
  } catch (err) {
    console.error("moveAssets failed:", err);
    return { error: "Failed to move files" };
  }
}

// ─── Asset create / delete ───────────────────────────────────────────────────

export async function createMediaAsset(data: {
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  folderId?: string | null;
}): Promise<FormState> {
  const user = await requireAdmin();

  try {
    // Only land in a folder that actually exists; otherwise leave unfiled.
    let folderId: string | null = null;
    if (data.folderId) {
      const folder = await prisma.assetFolder.findUnique({ where: { id: data.folderId } });
      if (folder) folderId = folder.id;
    }

    await prisma.asset.create({
      data: {
        filename: data.filename,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        storagePath: data.url,
        folderId,
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
