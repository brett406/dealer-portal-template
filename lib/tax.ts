/**
 * Calculate tax amount from a subtotal and tax percentage.
 * Tax is applied to the subtotal only (not shipping).
 * Returns 0 if taxPercent is null or 0.
 */
export function calculateTax(subtotal: number, taxPercent: number | null): number {
  if (!taxPercent || taxPercent === 0) return 0;
  return Math.round(subtotal * (taxPercent / 100) * 100) / 100;
}
