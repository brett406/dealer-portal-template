import { prisma } from "@/lib/prisma";
import { searchProducts } from "@/lib/search";
import { getCustomerPricing } from "./actions";
import { ProductGrid } from "@/components/portal/ProductGrid";
import "./catalog.css";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;

  const [{ products, nextCursor }, categories, pricing] = await Promise.all([
    searchProducts({ query: q, categoryId: category, limit: 20 }),
    prisma.productCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    getCustomerPricing(),
  ]);

  return (
    <div>
      <h1>Product Catalog</h1>
      <ProductGrid
        initialProducts={products}
        initialCursor={nextCursor}
        categories={categories}
        filters={{ q, category }}
        discountPercent={pricing?.discountPercent ?? 0}
        priceLevelName={pricing?.priceLevelName ?? "Retail"}
      />
    </div>
  );
}
