import { prisma } from "@/lib/prisma";
import { ProductList } from "./product-list";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; active?: string; q?: string }>;
}) {
  const { status, category, active, q } = await searchParams;

  const where: Record<string, unknown> = {};
  if (category) where.categoryId = category;
  if (active === "true") where.active = true;
  if (active === "false") where.active = false;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        category: { select: { name: true } },
        variants: { select: { stockQuantity: true, lowStockThreshold: true, active: true } },
        images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
      },
    }),
    prisma.productCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const data = products.map((p) => {
    const activeVariants = p.variants.filter((v) => v.active);
    const totalStock = activeVariants.reduce((sum, v) => sum + v.stockQuantity, 0);
    const hasLowStock = activeVariants.some(
      (v) => v.stockQuantity > 0 && v.stockQuantity <= v.lowStockThreshold,
    );
    const allOutOfStock = activeVariants.length > 0 && activeVariants.every((v) => v.stockQuantity === 0);

    let stockStatus: "ok" | "low" | "out" = "ok";
    if (allOutOfStock) stockStatus = "out";
    else if (hasLowStock) stockStatus = "low";

    return {
      id: p.id,
      name: p.name,
      categoryName: p.category.name,
      variantCount: p.variants.length,
      totalStock,
      stockStatus,
      active: p.active,
      sortOrder: p.sortOrder,
      thumbUrl: p.images[0]?.url ?? null,
    };
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            Manage your product catalog.
          </p>
        </div>
      </div>

      {status === "deleted" && (
        <div className="status-message status-success">Product deleted successfully.</div>
      )}

      <ProductList
        data={data}
        categories={categories}
        filters={{ category, active, q }}
      />
    </div>
  );
}
