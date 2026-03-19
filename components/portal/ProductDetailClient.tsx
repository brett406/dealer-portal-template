"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ImageGallery } from "./ImageGallery";
import { addToCartAction } from "@/app/(portal)/portal/catalog/actions";
import { calculateUOMBasePrice, calculateCustomerPrice, formatPrice } from "@/lib/pricing";
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
}: {
  product: {
    id: string;
    name: string;
    description: string | null;
    categoryName: string;
    minOrderQuantity: number | null;
  };
  variants: Variant[];
  uoms: UOM[];
  images: Image[];
  discountPercent: number;
  priceLevelName: string;
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
  const stockQty = selectedVariant?.stockQuantity ?? 0;
  const lowThreshold = selectedVariant?.lowStockThreshold ?? 5;
  let stockStatus: "in" | "low" | "out" = "in";
  let stockLabel = "In Stock";
  if (stockQty === 0) {
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

          {/* UOM selector */}
          {uoms.length > 1 && (
            <div className="product-selector">
              <label htmlFor="product-uom">Unit of Measure</label>
              <select
                id="product-uom"
                value={selectedUomId}
                onChange={(e) => setSelectedUomId(e.target.value)}
              >
                {uoms.map((u) => {
                  const uomRetail = calculateUOMBasePrice(baseRetailPrice, u.conversionFactor, u.priceOverride);
                  const uomCustomer = calculateCustomerPrice(uomRetail, discountPercent);
                  const label = u.conversionFactor === 1
                    ? `${u.name} — ${formatPrice(uomCustomer)}`
                    : `${u.name} of ${u.conversionFactor} — ${formatPrice(uomCustomer)}`;
                  return <option key={u.id} value={u.id}>{label}</option>;
                })}
              </select>
            </div>
          )}

          {/* Price display */}
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
              disabled={stockStatus === "out"}
            >
              Add to Cart
            </Button>
          </div>

          {message && (
            <div className={`add-to-cart-message ${message.type === "success" ? "add-to-cart-success" : "add-to-cart-error"}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
