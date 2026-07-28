import Link from "next/link";
import Image from "next/image";
import { calculateCustomerPrice, formatPrice, type Currency } from "@/lib/pricing";
import { getTagStyle } from "@/lib/product-tags";
import type { ProductSearchResult } from "@/lib/search";

export function ProductCard({
  product,
  discountPercent,
  currency,
}: {
  product: ProductSearchResult;
  discountPercent: number;
  currency: Currency;
}) {
  const priceRange = product.priceRange;
  let priceDisplay: string | null = null;
  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  if (priceRange) {
    minPrice = calculateCustomerPrice(priceRange.min, discountPercent);
    maxPrice = calculateCustomerPrice(priceRange.max, discountPercent);

    if (maxPrice <= 0) {
      // No real list price (e.g. made-to-order / quote items priced at 0).
      // Showing "$0.00" reads as broken — surface a quote prompt instead.
      priceDisplay = "Contact for pricing";
    } else if (minPrice === maxPrice) {
      priceDisplay = formatPrice(minPrice, currency);
    } else if (minPrice <= 0) {
      priceDisplay = `From ${formatPrice(maxPrice, currency)}`;
    } else {
      priceDisplay = `From ${formatPrice(minPrice, currency)}`;
    }
  }

  return (
    <Link href={`/portal/catalog/${product.slug}`} className="product-card">
      {product.tags && product.tags.length > 0 && (
        <div className="product-card-tags">
          {product.tags.map((tag) => {
            const style = getTagStyle(tag);
            return (
              <span key={tag} className="product-tag" style={{ background: style.bg, color: style.text }}>
                {tag}
              </span>
            );
          })}
        </div>
      )}
      {product.primaryImageUrl ? (
        <Image
          src={product.primaryImageUrl}
          alt={product.name}
          width={300}
          height={300}
          className="product-card-image"
          loading="lazy"
          unoptimized
        />
      ) : (
        <div className="product-card-placeholder">No Image</div>
      )}
      <div className="product-card-body">
        <div className="product-card-category">{product.categoryName}</div>
        <div className="product-card-name">{product.name}</div>
        {priceDisplay && (
          <div className="product-card-price">
            <span className="your-price">{priceDisplay}</span>
            {priceRange && product.variantCount > 1 && minPrice !== maxPrice && (
              <span className="from-label"> ({product.variantCount} variants)</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

