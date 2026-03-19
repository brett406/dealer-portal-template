"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { getPageDef, type FieldDef } from "@/lib/content-config";

export type FormState = {
  error?: string;
  success?: boolean;
};

// ─── Page Content ────────────────────────────────────────────────────────────

export async function updatePageContent(
  pageKey: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();

  const pageDef = getPageDef(pageKey);
  if (!pageDef) return { error: "Page not found in config" };

  // Build payload from form fields
  const payload: Record<string, string | boolean> = {};
  for (const [fieldKey, fieldDef] of Object.entries(pageDef.fields)) {
    const value = formData.get(`field_${fieldKey}`);
    if (fieldDef.type === "boolean") {
      payload[fieldKey] = value === "on";
    } else {
      payload[fieldKey] = (value as string) ?? fieldDef.default ?? "";
    }
  }

  // SEO fields
  const seo: Record<string, string> = {};
  const seoTitle = formData.get("seo_title") as string;
  const seoDesc = formData.get("seo_description") as string;
  if (seoTitle) seo.title = seoTitle;
  if (seoDesc) seo.description = seoDesc;

  await prisma.pageContent.upsert({
    where: { pageKey },
    update: { payload, seo, updatedByEmail: user.email },
    create: { pageKey, payload, seo, updatedByEmail: user.email },
  });

  revalidatePath(`/admin/pages/${pageKey}`);
  revalidatePath("/"); // Revalidate the marketing pages
  revalidatePath(`/${pageKey === "home" ? "" : pageKey}`);
  return { success: true };
}

// ─── Page Group Items ────────────────────────────────────────────────────────

export async function addGroupItem(
  pageKey: string,
  groupKey: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const pageDef = getPageDef(pageKey);
  const groupDef = pageDef?.groups?.[groupKey];
  if (!groupDef) return { error: "Group not found" };

  const payload: Record<string, string | boolean> = {};
  for (const [fieldKey, fieldDef] of Object.entries(groupDef.fields)) {
    const value = formData.get(`group_${fieldKey}`);
    payload[fieldKey] = (value as string) ?? "";
  }

  // Get next sort order
  const lastItem = await prisma.pageGroupItem.findFirst({
    where: { pageKey, groupKey },
    orderBy: { sortOrder: "desc" },
  });
  const sortOrder = (lastItem?.sortOrder ?? -1) + 1;

  await prisma.pageGroupItem.create({
    data: { pageKey, groupKey, sortOrder, payload },
  });

  revalidatePath(`/admin/pages/${pageKey}`);
  revalidatePath("/");
  return { success: true };
}

export async function updateGroupItem(
  itemId: string,
  pageKey: string,
  groupKey: string,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const pageDef = getPageDef(pageKey);
  const groupDef = pageDef?.groups?.[groupKey];
  if (!groupDef) return { error: "Group not found" };

  const payload: Record<string, string | boolean> = {};
  for (const [fieldKey] of Object.entries(groupDef.fields)) {
    const value = formData.get(`group_${fieldKey}`);
    payload[fieldKey] = (value as string) ?? "";
  }

  await prisma.pageGroupItem.update({
    where: { id: itemId },
    data: { payload },
  });

  revalidatePath(`/admin/pages/${pageKey}`);
  revalidatePath("/");
  return { success: true };
}

export async function deleteGroupItem(itemId: string, pageKey: string): Promise<FormState> {
  await requireAdmin();

  await prisma.pageGroupItem.delete({ where: { id: itemId } });

  revalidatePath(`/admin/pages/${pageKey}`);
  revalidatePath("/");
  return {};
}

export async function reorderGroupItems(
  pageKey: string,
  groupKey: string,
  itemIds: string[],
): Promise<FormState> {
  await requireAdmin();

  await prisma.$transaction(
    itemIds.map((id, index) =>
      prisma.pageGroupItem.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  revalidatePath(`/admin/pages/${pageKey}`);
  revalidatePath("/");
  return {};
}
