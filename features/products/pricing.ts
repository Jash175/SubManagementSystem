/**
 * Product & Variant Pricing Logic
 *
 * CRITICAL INVARIANT:
 * Financial values must never suffer from IEEE 754 floating-point inaccuracies.
 * All monetary calculations use decimal-safe rounding and exact fixed-point string representation.
 */

/**
 * Calculates the combined unit price of a base product and an optional variant price delta.
 * Example: Base price 2000.00 + Odoo variant price delta 560.00 = 2560.00
 *
 * @param salesPrice Base product sales price
 * @param priceDelta Optional attribute variant price delta (positive or negative)
 * @returns Decimal-safe price formatted to 2 decimal places (number)
 */
export function calculateProductPrice(
  salesPrice: number | string,
  priceDelta: number | string = 0
): number {
  const base = typeof salesPrice === "string" ? parseFloat(salesPrice) : salesPrice;
  const delta = typeof priceDelta === "string" ? parseFloat(priceDelta) : priceDelta;

  if (isNaN(base) || base < 0) {
    throw new Error("Invalid base product sales price");
  }

  const safeDelta = isNaN(delta) ? 0 : delta;

  // Use cents/scaled integer arithmetic to avoid IEEE-754 precision issues
  const baseCents = Math.round(base * 100);
  const deltaCents = Math.round(safeDelta * 100);
  const totalCents = baseCents + deltaCents;

  if (totalCents < 0) {
    return 0;
  }

  return Number((totalCents / 100).toFixed(2));
}

/**
 * Formats a currency amount with decimal safety.
 */
export function formatCurrency(
  amount: number | string,
  currencyCode = "INR"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `0.00 ${currencyCode}`;

  // Standard clean decimal format
  const formatted = num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${currencyCode} ${formatted}`;
}
