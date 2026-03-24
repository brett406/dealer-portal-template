"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/pricing";
import {
  updateCartItemQuantity,
  removeCartItemAction,
  submitOrder,
} from "@/app/(portal)/portal/cart/actions";
import "@/app/(portal)/portal/cart/cart.css";

type CartItem = {
  id: string;
  variantId: string;
  variantName: string;
  sku: string;
  productName: string;
  productId: string;
  productActive: boolean;
  variantActive: boolean;
  uomId: string;
  uomName: string;
  conversionFactor: number;
  quantity: number;
  baseUnitQuantity: number;
  retailPrice: number;
  customerPrice: number;
  lineTotal: number;
  warnings: string[];
};

type Address = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
};

export function CartClient({
  items,
  subtotal,
  shippingCost,
  shippingMethod,
  taxAmount = 0,
  taxRateName = null,
  total,
  discountPercent,
  priceLevelName,
  addresses,
  requirePONumber,
  canSubmit = true,
  hasWarnings = false,
}: {
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  shippingMethod?: string;
  taxAmount?: number;
  taxRateName?: string | null;
  total: number;
  discountPercent: number;
  priceLevelName: string;
  addresses: Address[];
  requirePONumber: boolean;
  canSubmit?: boolean;
  hasWarnings?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];

  function handleQuantityChange(itemId: string, newQty: number) {
    if (newQty < 0) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCartItemQuantity(itemId, newQty);
      if (result.error) setError(result.error);
    });
  }

  function handleRemove(itemId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeCartItemAction(itemId);
      if (result.error) setError(result.error);
    });
  }

  function handleSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitOrder(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="cart-layout">
      {/* Left: Cart items */}
      <div className="cart-items">
        {items.map((item) => (
          <div key={item.id} className="cart-item" style={item.warnings.length > 0 ? { opacity: 0.7, borderColor: "#fbbf24" } : undefined}>
            <div className="cart-item-thumb-placeholder" />
            <div className="cart-item-info">
              <div className="cart-item-name">
                {item.productName} — {item.variantName}
              </div>
              <div className="cart-item-meta">
                SKU: {item.sku} | {item.uomName}
                {item.conversionFactor > 1 ? ` of ${item.conversionFactor}` : ""}
              </div>
              <div className="cart-item-price">
                <span className="unit-price">{formatPrice(item.customerPrice)}</span>
                {discountPercent > 0 && (
                  <span style={{ color: "var(--color-text-muted)", textDecoration: "line-through", marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                    {formatPrice(item.retailPrice)}
                  </span>
                )}
              </div>
              {item.warnings.length > 0 && (
                <div style={{ marginTop: "0.35rem" }}>
                  {item.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: "0.8rem", color: "#b45309", fontWeight: 500 }}>
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="cart-item-controls">
              <button
                type="button"
                className="qty-btn"
                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                disabled={isPending}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={item.quantity}
                min={0}
                onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                disabled={isPending}
                aria-label={`Quantity for ${item.productName}`}
              />
              <button
                type="button"
                className="qty-btn"
                onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                disabled={isPending}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <div className="cart-item-line-total tabular-nums">{formatPrice(item.lineTotal)}</div>
            <button
              type="button"
              className="cart-item-remove"
              onClick={() => handleRemove(item.id)}
              disabled={isPending}
              aria-label={`Remove ${item.productName} from cart`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Right: Summary + checkout form */}
      <form action={handleSubmit} className="cart-summary">
        <h2>Order Summary</h2>

        <div className="cart-summary-row">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="cart-summary-row">
          <span>Shipping</span>
          <span>{shippingMethod === "pickup" ? "Pickup" : shippingCost === 0 ? "Free" : formatPrice(shippingCost)}</span>
        </div>
        {taxAmount > 0 && (
          <div className="cart-summary-row">
            <span>Tax{taxRateName ? ` (${taxRateName})` : ""}</span>
            <span>{formatPrice(taxAmount)}</span>
          </div>
        )}
        <div className="cart-summary-total">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>

        {/* Shipping address */}
        {shippingMethod !== "pickup" && addresses.length > 0 && (
          <div className="cart-form-section">
            <label htmlFor="cart-shipping-address">Shipping Address</label>
            <select id="cart-shipping-address" name="shippingAddressId" defaultValue={defaultAddress?.id}>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} — {a.line1}, {a.city}, {a.state}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* PO Number */}
        <div className="cart-form-section">
          <label htmlFor="cart-po-number">
            PO Number {requirePONumber ? "(required)" : "(optional)"}
          </label>
          <input
            id="cart-po-number"
            name="poNumber"
            type="text"
            placeholder="Enter PO number"
            required={requirePONumber}
          />
        </div>

        {/* Notes */}
        <div className="cart-form-section">
          <label htmlFor="cart-notes">Order Notes (optional)</label>
          <textarea id="cart-notes" name="notes" placeholder="Special instructions..." />
        </div>

        {hasWarnings && !canSubmit && (
          <div className="cart-error">
            Some items in your cart are no longer available. Please remove them before submitting.
          </div>
        )}

        {error && <div className="cart-error">{error}</div>}

        <Button type="submit" loading={isPending} disabled={!canSubmit} className="cart-submit-btn">
          Submit Order
        </Button>

        <Link href="/portal/catalog" className="cart-footer-link">
          Continue Shopping
        </Link>
      </form>
    </div>
  );
}
