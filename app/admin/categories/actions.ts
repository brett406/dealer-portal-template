"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { invalidateCache } from "@/lib/cache";


// ─── Validation ──────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
  description: z
    .union([z.string().max(500, "Description must be 500 characters or less"), z.null()])
    .optional()
    .transform((v) => v || undefined),
  sortOrder: z
    .coerce.number()
    .int("Sort order must be a whole number")
    .optional()
    .default(0),
  active: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type CategoryFormState = {
  errors?: Record<string, string>;
  success?: boolean;
};

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    sortOrder: formData.get("sortOrder"),
    active: formData.get("active") === "on",
    featured: formData.get("featured") === "on",
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  // Check unique slug
  const existing = await prisma.productCategory.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (existing) {
    return { errors: { slug: "A category with this slug already exists" } };
  }

  await prisma.productCategory.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      sortOrder: parsed.data.sortOrder,
      active: parsed.data.active,
      featured: parsed.data.featured,
    },
  });

  invalidateCache("products:");
  redirect("/admin/categories?status=created");
}

export async function updateCategory(
  id: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    sortOrder: formData.get("sortOrder"),
    active: formData.get("active") === "on",
    featured: formData.get("featured") === "on",
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  // Check unique slug (excluding self)
  const existing = await prisma.productCategory.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (existing) {
    return { errors: { slug: "A category with this slug already exists" } };
  }

  await prisma.productCategory.update({
    where: { id },
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      sortOrder: parsed.data.sortOrder,
      active: parsed.data.active,
      featured: parsed.data.featured,
    },
  });

  invalidateCache("products:");
  redirect("/admin/categories?status=updated");
}

export async function deleteCategory(id: string): Promise<{ error?: string }> {
  await requireAdmin();

  const category = await prisma.productCategory.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });

  if (!category) {
    return { error: "Category not found" };
  }

  if (category._count.products > 0) {
    return {
      error: `Cannot delete — ${category._count.products} product(s) are assigned to this category`,
    };
  }

  await prisma.productCategory.delete({ where: { id } });
  revalidatePath("/admin/categories");
  return {};
}

export async function toggleCategoryActive(id: string): Promise<{ error?: string }> {
  await requireAdmin();

  const category = await prisma.productCategory.findUnique({ where: { id } });

  if (!category) {
    return { error: "Category not found" };
  }

  await prisma.productCategory.update({
    where: { id },
    data: { active: !category.active },
  });

  revalidatePath("/admin/categories");
  return {};
}

export async function toggleCategoryFeatured(id: string): Promise<{ error?: string }> {
  await requireAdmin();

  const category = await prisma.productCategory.findUnique({ where: { id } });

  if (!category) {
    return { error: "Category not found" };
  }

  await prisma.productCategory.update({
    where: { id },
    data: { featured: !category.featured },
  });

  invalidateCache("products:");
  revalidatePath("/admin/categories");
  revalidatePath("/");
  return {};
}
