"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { getCollectionDef } from "@/lib/content-config";
import { generateSlug } from "@/lib/slug";

export type FormState = {
  error?: string;
  success?: boolean;
};

export async function createCollectionItem(
  collectionKey: string,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();

  const def = getCollectionDef(collectionKey);
  if (!def) return { error: "Collection not found in config" };

  const payload: Record<string, string> = {};
  for (const [fieldKey] of Object.entries(def.fields)) {
    payload[fieldKey] = (formData.get(`field_${fieldKey}`) as string) ?? "";
  }

  let slug = (formData.get("slug") as string)?.trim() || "";
  if (!slug && payload.title) {
    slug = generateSlug(payload.title);
  }
  if (!slug) return { error: "Slug is required" };

  // Check slug uniqueness within collection
  const existing = await prisma.collectionItem.findUnique({
    where: { collectionKey_slug: { collectionKey, slug } },
  });
  if (existing) return { error: `Slug "${slug}" already exists in this collection` };

  const published = formData.get("published") === "on";

  // Get next sort order
  const lastItem = await prisma.collectionItem.findFirst({
    where: { collectionKey },
    orderBy: { sortOrder: "desc" },
  });
  const sortOrder = (lastItem?.sortOrder ?? -1) + 1;

  const item = await prisma.collectionItem.create({
    data: {
      collectionKey,
      slug,
      published,
      sortOrder,
      payload,
      updatedByEmail: user.email,
    },
  });

  revalidatePath(`/admin/collections/${collectionKey}`);
  revalidatePath("/blog");
  redirect(`/admin/collections/${collectionKey}/${item.id}`);
}

export async function updateCollectionItem(
  itemId: string,
  collectionKey: string,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();

  const def = getCollectionDef(collectionKey);
  if (!def) return { error: "Collection not found in config" };

  const payload: Record<string, string> = {};
  for (const [fieldKey] of Object.entries(def.fields)) {
    payload[fieldKey] = (formData.get(`field_${fieldKey}`) as string) ?? "";
  }

  let slug = (formData.get("slug") as string)?.trim() || "";
  if (!slug && payload.title) {
    slug = generateSlug(payload.title);
  }
  if (!slug) return { error: "Slug is required" };

  // Check slug uniqueness (excluding self)
  const existing = await prisma.collectionItem.findFirst({
    where: { collectionKey, slug, NOT: { id: itemId } },
  });
  if (existing) return { error: `Slug "${slug}" already exists in this collection` };

  const published = formData.get("published") === "on";

  await prisma.collectionItem.update({
    where: { id: itemId },
    data: { slug, published, payload, updatedByEmail: user.email },
  });

  revalidatePath(`/admin/collections/${collectionKey}`);
  revalidatePath(`/admin/collections/${collectionKey}/${itemId}`);
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  return { success: true };
}

export async function deleteCollectionItem(
  itemId: string,
  collectionKey: string,
): Promise<FormState> {
  await requireAdmin();

  await prisma.collectionItem.delete({ where: { id: itemId } });

  revalidatePath(`/admin/collections/${collectionKey}`);
  revalidatePath("/blog");
  redirect(`/admin/collections/${collectionKey}`);
}

export async function toggleCollectionItemPublished(
  itemId: string,
  collectionKey: string,
): Promise<FormState> {
  await requireAdmin();

  const item = await prisma.collectionItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Item not found" };

  await prisma.collectionItem.update({
    where: { id: itemId },
    data: { published: !item.published },
  });

  revalidatePath(`/admin/collections/${collectionKey}`);
  revalidatePath("/blog");
  return { success: true };
}
