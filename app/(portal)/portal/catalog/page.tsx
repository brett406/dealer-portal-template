import { prisma } from "@/lib/prisma";
import { searchProducts } from "@/lib/search";
import { getCustomerPricing } from "./actions";
import { ProductGrid } from "@/components/portal/ProductGrid";
import "./catalog.css";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;

  const showProducts = !!(q || category);

  const [productResult, categories, pricing] = await Promise.all([
    showProducts
      ? searchProducts({ query: q, categoryId: category, limit: 20 })
      : Promise.resolve({ products: [], nextCursor: null }),
    prisma.productCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { products: { where: { active: true } } } },
      },
    }),
    getCustomerPricing(),
  ]);

  const categoryData = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    imageUrl: c.imageUrl,
    productCount: c._count.products,
  }));

  return (
    <div>
      <h1>Product Catalog</h1>
      <ProductGrid
        initialProducts={productResult.products}
        initialCursor={productResult.nextCursor}
        categories={categoryData}
        filters={{ q, category }}
        discountPercent={pricing?.discountPercent ?? 0}
        priceLevelName={pricing?.priceLevelName ?? "Retail"}
        showCategoryView={!showProducts}
      />
    </div>
  );
}
