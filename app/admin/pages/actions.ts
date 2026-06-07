"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { getPageDef, type FieldDef } from "@/lib/content-config";
import { sanitizeRichtext } from "@/lib/sanitize";

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

  // Inline "edit on the page" saves set `__partial` and submit only the field(s)
  // they touched. In that mode we MERGE over the existing record so untouched
  // fields and SEO survive. The full-form admin editor omits `__partial` and
  // submits every field, so it keeps the original full-replace behavior.
  const partial = formData.has("__partial");
  const existing = partial
    ? await prisma.pageContent.findUnique({ where: { pageKey } })
    : null;
  const basePayload = (existing?.payload as Record<string, unknown>) ?? {};

  // Build payload from form fields
  const payload: Record<string, unknown> = partial ? { ...basePayload } : {};
  for (const [fieldKey, fieldDef] of Object.entries(pageDef.fields)) {
    if (partial && !formData.has(`field_${fieldKey}`)) continue; // untouched → keep
    const value = formData.get(`field_${fieldKey}`);
    if (fieldDef.type === "boolean") {
      payload[fieldKey] = value === "on";
    } else if (fieldDef.type === "richtext") {
      // Sanitize on save (defense in depth alongside SafeHtml on render).
      payload[fieldKey] = sanitizeRichtext((value as string) ?? fieldDef.default ?? "");
    } else {
      payload[fieldKey] = (value as string) ?? fieldDef.default ?? "";
    }
  }

  // SEO fields. Inline saves never touch SEO, so preserve the stored value;
  // the full-form editor rebuilds SEO from its submitted fields (unchanged).
  let seo: Record<string, unknown>;
  if (partial) {
    seo = (existing?.seo as Record<string, unknown>) ?? {};
  } else {
    seo = {};
    const seoFields = [
      "title", "description", "focusKeyword", "ogTitle", "ogDescription",
      "ogImage", "twitterCard", "indexable", "followable", "canonical",
      "redirect301", "schemaType", "schemaData", "faqItems",
    ];
    for (const key of seoFields) {
      const val = formData.get(`seo_${key}`) as string;
      if (val !== null && val !== undefined && val !== "") {
        // Parse JSON fields
        if (key === "schemaData" || key === "faqItems") {
          try { seo[key] = JSON.parse(val); } catch { seo[key] = val; }
        } else {
          seo[key] = val;
        }
      }
    }
  }

  await prisma.pageContent.upsert({
    where: { pageKey },
    update: { payload: payload as Record<string, string>, seo: seo as Record<string, string>, updatedByEmail: user.email },
    create: { pageKey, payload: payload as Record<string, string>, seo: seo as Record<string, string>, updatedByEmail: user.email },
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
    payload[fieldKey] =
      fieldDef.type === "richtext"
        ? sanitizeRichtext((value as string) ?? "")
        : (value as string) ?? "";
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
  for (const [fieldKey, fieldDef] of Object.entries(groupDef.fields)) {
    const value = formData.get(`group_${fieldKey}`);
    payload[fieldKey] =
      fieldDef.type === "richtext"
        ? sanitizeRichtext((value as string) ?? "")
        : (value as string) ?? "";
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
