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

  // Pricing carries the dealer's currency, which selects the price column for
  // search price ranges — so it must be resolved before the product search.
  const pricing = await getCustomerPricing();
  const currency = pricing?.currency ?? "CAD";

  const [productResult, categories] = await Promise.all([
    showProducts
      ? searchProducts({ query: q, categoryId: category, limit: 20, currency })
      : Promise.resolve({ products: [], nextCursor: null }),
    prisma.productCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { products: { where: { active: true } } } },
      },
    }),
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
        currency={currency}
        showCategoryView={!showProducts}
      />
    </div>
  );
}
