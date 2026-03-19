import { prisma } from "@/lib/prisma";
import { CategoryList } from "./category-list";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const categories = await prisma.productCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  const data = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    active: cat.active,
    sortOrder: cat.sortOrder,
    productCount: cat._count.products,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Product Categories</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            Organize your product catalog with categories.
          </p>
        </div>
      </div>

      {status === "created" && (
        <div className="status-message status-success">Category created successfully.</div>
      )}
      {status === "updated" && (
        <div className="status-message status-success">Category updated successfully.</div>
      )}

      <CategoryList data={data} />
    </div>
  );
}
