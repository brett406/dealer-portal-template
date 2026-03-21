import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateCategory } from "../actions";
import { CategoryForm } from "../category-form";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const category = await prisma.productCategory.findUnique({ where: { id } });
  if (!category) notFound();

  const boundUpdate = updateCategory.bind(null, id);

  return (
    <div>
      <h1>Edit Category</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Update the &ldquo;{category.name}&rdquo; category.
      </p>
      <CategoryForm
        action={boundUpdate}
        defaultValues={{
          name: category.name,
          slug: category.slug,
          description: category.description ?? undefined,
          sortOrder: category.sortOrder,
          active: category.active,
          featured: category.featured,
        }}
        submitLabel="Save Changes"
      />
    </div>
  );
}
