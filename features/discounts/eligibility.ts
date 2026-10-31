import type { Discount } from "@/types";

export interface DiscountEligibilityContext {
  purchaseAmount: number;
  quantity: number;
  date?: Date | string;
  productId?: string;
  currentUses?: number;
}

export interface DiscountEligibilityResult {
  isEligible: boolean;
  reason?: string;
}

/**
 * Validates whether a discount rule is eligible to be applied under the given context.
 *
 * Checks:
 * 1. Active status (is_active)
 * 2. Date validity window [starts_on, ends_on]
 * 3. Usage cap (max_uses) vs current redemptions
 * 4. Minimum purchase amount threshold
 * 5. Minimum quantity threshold
 * 6. Product scope eligibility (if scope is 'product', checks if target product is included)
 */
export function checkDiscountEligibility(
  discount: Pick<
    Discount,
    | "isActive"
    | "startsOn"
    | "endsOn"
    | "maxUses"
    | "minimumPurchaseAmount"
    | "minimumQuantity"
    | "scope"
    | "productIds"
  >,
  context: DiscountEligibilityContext
): DiscountEligibilityResult {
  if (!discount.isActive) {
    return {
      isEligible: false,
      reason: "Discount rule is currently inactive or archived",
    };
  }

  // Date range check
  const targetDate = context.date
    ? typeof context.date === "string"
      ? new Date(context.date)
      : context.date
    : new Date();
  const dayStr = targetDate.toISOString().slice(0, 10);

  if (dayStr < discount.startsOn) {
    return {
      isEligible: false,
      reason: `Discount has not started yet (valid from ${discount.startsOn})`,
    };
  }

  if (dayStr > discount.endsOn) {
    return {
      isEligible: false,
      reason: `Discount expired on ${discount.endsOn}`,
    };
  }

  // Usage cap check
  if (
    discount.maxUses !== null &&
    discount.maxUses !== undefined &&
    context.currentUses !== undefined &&
    context.currentUses >= discount.maxUses
  ) {
    return {
      isEligible: false,
      reason: `Discount has reached its maximum usage limit of ${discount.maxUses} redemptions`,
    };
  }

  // Minimum purchase amount check
  if (
    discount.minimumPurchaseAmount > 0 &&
    context.purchaseAmount < discount.minimumPurchaseAmount
  ) {
    return {
      isEligible: false,
      reason: `Order subtotal ${context.purchaseAmount} is below required minimum purchase of ${discount.minimumPurchaseAmount}`,
    };
  }

  // Minimum quantity check
  if (
    discount.minimumQuantity > 0 &&
    context.quantity < discount.minimumQuantity
  ) {
    return {
      isEligible: false,
      reason: `Quantity ${context.quantity} is below required minimum quantity of ${discount.minimumQuantity}`,
    };
  }

  // Product scope check
  if (discount.scope === "product") {
    if (!context.productId) {
      return {
        isEligible: false,
        reason: "Product ID is required for product-scoped discount validation",
      };
    }
    const eligibleIds = discount.productIds || [];
    if (!eligibleIds.includes(context.productId)) {
      return {
        isEligible: false,
        reason: "Target product is not eligible for this product-scoped discount",
      };
    }
  }

  return { isEligible: true };
}

/**
 * Calculates the exact monetary reduction from a discount rule applied to an eligible subtotal.
 * Decimal-safe rounding to 2 decimal places.
 */
export function calculateDiscountAmount(
  discount: Pick<Discount, "discountType" | "value">,
  eligibleSubtotal: number
): number {
  if (eligibleSubtotal <= 0) return 0;

  if (discount.discountType === "fixed") {
    return Math.min(discount.value, eligibleSubtotal);
  }

  if (discount.discountType === "percentage") {
    const rawDiscount = (eligibleSubtotal * discount.value) / 100;
    const rounded = Math.round(rawDiscount * 100) / 100;
    return Math.min(rounded, eligibleSubtotal);
  }

  return 0;
}
