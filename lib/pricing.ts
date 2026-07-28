/**
 * Pure pricing functions — no database calls, no side effects.
 * Safe to import from client components.
 * All monetary values are plain numbers rounded to 2 decimal places.
 */

// Type-only import — erased at build, so this stays client-safe (no Prisma in the
// client bundle) while staying in sync with the schema's Currency enum.
import type { Currency } from "@prisma/client";

export type { Currency };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Returns the base price for a UOM.
 * If a priceOverride is set, use it directly; otherwise multiply
 * the per-unit retail price by the conversion factor.
 */
export function calculateUOMBasePrice(
  baseRetailPrice: number,
  conversionFactor: number,
  priceOverride: number | null,
): number {
  if (priceOverride !== null) {
    return round2(priceOverride);
  }
  return round2(baseRetailPrice * conversionFactor);
}

/**
 * Returns the customer-facing price after discount.
 * discountPercent is 0-100 (e.g. 20 means 20% off).
 */
export function calculateCustomerPrice(
  uomBasePrice: number,
  discountPercent: number,
): number {
  return round2(uomBasePrice * (1 - discountPercent / 100));
}

/**
 * Returns the line total for a given quantity.
 */
export function calculateLineTotal(
  unitPrice: number,
  quantity: number,
): number {
  return round2(unitPrice * quantity);
}

/**
 * Selects the variant base price for a currency.
 *
 * Returns `null` when the currency is USD but no USD price is set. Callers MUST
 * treat null as "not available in this currency" — block add-to-cart / order and
 * hide the price — and NEVER fall back to the CAD number. A silent CAD fallback
 * would quote a US dealer a CAD figure formatted as US$.
 */
export function resolveBasePrice(
  currency: Currency,
  cadPrice: number,
  usdPrice: number | null,
): number | null {
  if (currency === "USD") return usdPrice;
  return cadPrice;
}

/**
 * Picks the currency-appropriate per-UOM price override. Unlike the variant base
 * price, a null override is always legitimate ("derive from base × factor"), so
 * this never signals "not priced" — that decision belongs to resolveBasePrice.
 */
export function resolveUomOverride(
  currency: Currency,
  cadOverride: number | null,
  usdOverride: number | null,
): number | null {
  return currency === "USD" ? usdOverride : cadOverride;
}

const CURRENCY_PREFIX: Record<Currency, string> = {
  CAD: "CA$",
  USD: "US$",
};

/**
 * Formats a number as a price string in the given currency, e.g. CA$1234.00 /
 * US$1234.00. The currency argument is REQUIRED by design: a default would turn a
 * missed call site into a silent mispricing instead of a compile error.
 */
export function formatPrice(amount: number, currency: Currency): string {
  return `${CURRENCY_PREFIX[currency]}${round2(amount).toFixed(2)}`;
}
