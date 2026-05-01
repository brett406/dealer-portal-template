"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ImageGallery } from "./ImageGallery";
import { addToCartAction } from "@/app/(portal)/portal/catalog/actions";
import { calculateUOMBasePrice, calculateCustomerPrice, formatPrice } from "@/lib/pricing";
import { getTagStyle } from "@/lib/product-tags";
import "@/app/(portal)/portal/catalog/catalog.css";

type Variant = {
  id: string;
  name: string;
  sku: string;
  baseRetailPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
};

type UOM = {
  id: string;
  name: string;
  conversionFactor: number;
  priceOverride: number | null;
};

type Image = {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
};

export function ProductDetailClient({
  product,
  variants,
  uoms,
  images,
  discountPercent,
  priceLevelName,
  accessories,
}: {
  product: {
    id: string;
    name: string;
    description: string | null;
    categoryName: string;
    minOrderQuantity: number | null;
    madeToOrder?: boolean;
    tags?: string[];
  };
  variants: Variant[];
  uoms: UOM[];
  images: Image[];
  discountPercent: number;
  priceLevelName: string;
  accessories?: {
    id: string;
    name: string;
    slug: string;
    categoryName: string;
    primaryImageUrl: string | null;
    madeToOrder: boolean;
    baseRetailPrice: number;
    defaultVariantId: string;
    defaultUomId: string | null;
    stockQuantity: number;
  }[];
}) {
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id ?? "");
  const [selectedUomId, setSelectedUomId] = useState(uoms[0]?.id ?? "");
  const [quantity, setQuantity] = useState(product.minOrderQuantity ?? 1);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const selectedUom = uoms.find((u) => u.id === selectedUomId);

  // Calculate prices
  const baseRetailPrice = selectedVariant?.baseRetailPrice ?? 0;
  const retailPrice = selectedUom
    ? calculateUOMBasePrice(baseRetailPrice, selectedUom.conversionFactor, selectedUom.priceOverride)
    : baseRetailPrice;
  const customerPrice = calculateCustomerPrice(retailPrice, discountPercent);

  // Stock status
  const isMadeToOrder = product.madeToOrder ?? false;
  const stockQty = selectedVariant?.stockQuantity ?? 0;
  const lowThreshold = selectedVariant?.lowStockThreshold ?? 5;
  let stockStatus: "in" | "low" | "out" = "in";
  let stockLabel = "In Stock";
  if (isMadeToOrder) {
    stockStatus = "in";
    stockLabel = "Made to Order";
  } else if (stockQty === 0) {
    stockStatus = "out";
    stockLabel = "Out of Stock";
  } else if (stockQty <= lowThreshold) {
    stockStatus = "low";
    stockLabel = `Low Stock (${stockQty} remaining)`;
  }

  function handleAddToCart() {
    if (!selectedVariant || !selectedUom) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addToCartAction(selectedVariant.id, selectedUom.id, quantity);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Added to cart!" });
      }
    });
  }

  return (
    <div>
      <Link href="/portal/catalog" style={{ fontSize: "0.85rem", color: "var(--color-primary)", textDecoration: "none" }}>
        &larr; Back to Catalog
      </Link>

      <div className="product-detail">
        {/* Left: Gallery */}
        <ImageGallery images={images} productName={product.name} />

        {/* Right: Info */}
        <div className="product-info">
          <div className="product-category-label">{product.categoryName}</div>
          <h1>{product.name}</h1>

          {product.tags && product.tags.length > 0 && (
            <div className="product-detail-tags">
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

          {product.description && (
            <div className="product-description">{product.description}</div>
          )}

          {/* Variant selector */}
          {variants.length > 1 && (
            <div className="product-selector">
              <label htmlFor="product-variant">Variant</label>
              <select
                id="product-variant"
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.sku}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* UOM tabs + pricing */}
          {uoms.length > 1 ? (
            <div className="uom-tabs" role="tablist" aria-label="Unit of Measure">
              {uoms.map((u) => {
                const uomRetail = calculateUOMBasePrice(baseRetailPrice, u.conversionFactor, u.priceOverride);
                const uomCustomer = calculateCustomerPrice(uomRetail, discountPercent);
                const isActive = u.id === selectedUomId;
                // Per-unit price when buying in bulk (for savings display)
                const perUnitPrice = u.conversionFactor > 1
                  ? uomCustomer / u.conversionFactor
                  : null;
                // Base single-unit UOM for comparison
                const baseUom = uoms.find((x) => x.conversionFactor === 1);
                const baseUomRetail = baseUom
                  ? calculateUOMBasePrice(baseRetailPrice, baseUom.conversionFactor, baseUom.priceOverride)
                  : baseRetailPrice;
                const baseUomCustomer = calculateCustomerPrice(baseUomRetail, discountPercent);
                const hasSavings = perUnitPrice !== null && perUnitPrice < baseUomCustomer;

                return (
                  <button
                    key={u.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`uom-tab${isActive ? " uom-tab-active" : ""}`}
                    onClick={() => setSelectedUomId(u.id)}
                  >
                    <span className="uom-tab-price">
                      {formatPrice(uomCustomer)} / Per {u.name.toUpperCase()}
                      {u.conversionFactor > 1 && (
                        <span className="uom-tab-count">{u.conversionFactor}</span>
                      )}
                    </span>
                    {perUnitPrice !== null && (
                      <span className="uom-tab-savings">
                        {formatPrice(Math.round(perUnitPrice * 100) / 100)} / EA
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Single UOM — show standard pricing box */
            <div className="product-pricing">
              {discountPercent > 0 && (
                <div className="retail-price">Retail: {formatPrice(retailPrice)}</div>
              )}
              <div>
                <span className="customer-price">Your Price: {formatPrice(customerPrice)}</span>
                {discountPercent > 0 && (
                  <span className="discount-badge">{discountPercent}% off</span>
                )}
              </div>
            </div>
          )}

          {/* Stock status */}
          <div className={`stock-status stock-${stockStatus}`}>{stockLabel}</div>

          {/* Add to cart */}
          <div className="add-to-cart-row">
            <div>
              <label htmlFor="product-quantity" style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px", color: "var(--color-text-muted)" }}>
                Qty {product.minOrderQuantity ? `(min ${product.minOrderQuantity})` : ""}
              </label>
              <input
                id="product-quantity"
                type="number"
                inputMode="numeric"
                min={product.minOrderQuantity ?? 1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <Button
              onClick={handleAddToCart}
              loading={isPending}
              disabled={stockStatus === "out" && !isMadeToOrder}
            >
              Add to Cart
            </Button>
          </div>

          {message && (
            <div className={`add-to-cart-message ${message.type === "success" ? "add-to-cart-success" : "add-to-cart-error"}`}>
              {message.text}
            </div>
          )}

          {/* Inline accessories */}
          {accessories && accessories.length > 0 && (
            <div className="inline-accessories">
              <div className="inline-accessories-header">Recommended Accessories</div>
              <div className="inline-accessories-list">
                {accessories.map((acc) => {
                  const accPrice = calculateCustomerPrice(
                    calculateUOMBasePrice(acc.baseRetailPrice, 1, null),
                    discountPercent,
                  );
                  const inStock = acc.madeToOrder || acc.stockQuantity > 0;

                  return (
                    <div key={acc.id} className="inline-accessory-card">
                      <Link href={`/portal/catalog/${acc.slug}`} className="inline-accessory-link">
                        {acc.primaryImageUrl ? (
                          <img src={acc.primaryImageUrl} alt={acc.name} className="inline-accessory-img" />
                        ) : (
                          <div className="inline-accessory-img-placeholder">IMG</div>
                        )}
                        <div className="inline-accessory-info">
                          <div className="inline-accessory-name">{acc.name}</div>
                          <div className="inline-accessory-price">{formatPrice(accPrice)}</div>
                        </div>
                      </Link>
                      {inStock && acc.defaultUomId && (
                        <button
                          type="button"
                          className="inline-accessory-add"
                          disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              const result = await addToCartAction(acc.defaultVariantId, acc.defaultUomId!, 1);
                              if (result.error) {
                                setMessage({ type: "error", text: result.error });
                              } else {
                                setMessage({ type: "success", text: `${acc.name} added to cart!` });
                              }
                            });
                          }}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
