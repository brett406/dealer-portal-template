/**
 * Pure pricing functions — no database calls, no side effects.
 * Safe to import from client components.
 * All monetary values are plain numbers rounded to 2 decimal places.
 */

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
 * Formats a number as a USD price string.
 */
export function formatPrice(amount: number): string {
  return `$${round2(amount).toFixed(2)}`;
}
