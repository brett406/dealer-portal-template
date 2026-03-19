import Link from "next/link";
import { getCartData } from "./actions";
import { CartClient } from "@/components/portal/CartClient";
import "./cart.css";

export default async function CartPage() {
  const data = await getCartData();

  if (!data || data.items.length === 0) {
    return (
      <div className="cart-empty">
        <h1>Your Cart</h1>
        <p>Your cart is empty.</p>
        <Link href="/portal/catalog" className="cart-continue-link">
          Browse the catalog &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Your Cart</h1>
      <CartClient
        items={data.items}
        subtotal={data.subtotal}
        shippingCost={data.shippingCost}
        total={data.total}
        discountPercent={data.discountPercent}
        priceLevelName={data.priceLevelName}
        addresses={data.addresses}
        requirePONumber={data.requirePONumber}
        canSubmit={data.canSubmit}
        hasWarnings={data.hasWarnings}
      />
    </div>
  );
}
