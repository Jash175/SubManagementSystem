import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Products & Variants
import { calculateProductPrice } from "../features/products/pricing.ts";
import { productSchema, productVariantSchema } from "../features/products/schemas.ts";

// Plans
import { checkPlanAvailability, validatePlanQuantity } from "../features/plans/eligibility.ts";
import { planSchema } from "../features/plans/schemas.ts";

// Taxes
import { taxSchema } from "../features/taxes/schemas.ts";

// Discounts
import {
  checkDiscountEligibility,
  calculateDiscountAmount,
} from "../features/discounts/eligibility.ts";
import { discountSchema } from "../features/discounts/schemas.ts";

describe("Phase 2: Products & Variants Pricing (T-07)", () => {
  it("T-07: calculates base price + Odoo variant delta 560 accurately (2000 + 560 = 2560)", () => {
    const basePrice = 2000.0;
    const odooDelta = 560.0;
    const finalPrice = calculateProductPrice(basePrice, odooDelta);
    assert.strictEqual(finalPrice, 2560.0);
  });

  it("handles decimal-safe precision without floating-point inaccuracies", () => {
    // 0.1 + 0.2 standard JS float issue
    const price = calculateProductPrice(1999.99, 0.01);
    assert.strictEqual(price, 2000.0);
  });

  it("handles negative price delta for discounted variant tiers", () => {
    const finalPrice = calculateProductPrice(1000.0, -150.5);
    assert.strictEqual(finalPrice, 849.5);
  });

  it("clamps final price to 0 when delta deduction exceeds base price", () => {
    const finalPrice = calculateProductPrice(500.0, -600.0);
    assert.strictEqual(finalPrice, 0);
  });

  it("validates product schema correctly", () => {
    const valid = productSchema.safeParse({
      productCode: "prd-workspace",
      name: "Team Workspace",
      productType: "software",
      salesPrice: 2000,
      costPrice: 700,
      currencyCode: "INR",
      notes: "Core workspace product",
      isActive: true,
    });
    assert.ok(valid.success);
    if (valid.success) {
      assert.strictEqual(valid.data.productCode, "PRD-WORKSPACE"); // uppercase transform
    }

    const invalidPrice = productSchema.safeParse({
      productCode: "PRD-01",
      name: "Test",
      productType: "software",
      salesPrice: -50,
    });
    assert.strictEqual(invalidPrice.success, false);
  });

  it("validates variant schema correctly", () => {
    const validVariant = productVariantSchema.safeParse({
      attributeName: "Brand",
      attributeValue: "Odoo",
      priceDelta: 560.0,
      isActive: true,
    });
    assert.ok(validVariant.success);

    const emptyAttr = productVariantSchema.safeParse({
      attributeName: "",
      attributeValue: "Odoo",
      priceDelta: 560,
    });
    assert.strictEqual(emptyAttr.success, false);
  });
});

describe("Phase 2: Subscription Plans (T-08, T-09, Validation)", () => {
  const samplePlan = {
    planCode: "MONTHLY-TEAM",
    name: "Monthly Team",
    price: 2500,
    currencyCode: "INR",
    billingIntervalUnit: "monthly" as const,
    billingIntervalCount: 1,
    minimumQuantity: 5,
    availableFrom: "2026-06-01",
    availableUntil: "2026-12-31",
    autoCloseOnEnd: false,
    allowEarlyClose: true,
    allowPause: true,
    allowRenewal: true,
    isActive: true,
  };

  it("T-08: rejects plan quantity below minimumQuantity", () => {
    const belowMin = validatePlanQuantity(samplePlan, 4);
    assert.strictEqual(belowMin.isValid, false);
    assert.match(belowMin.error || "", /below the plan minimum of 5/);

    const zeroQty = validatePlanQuantity(samplePlan, 0);
    assert.strictEqual(zeroQty.isValid, false);

    const validQty = validatePlanQuantity(samplePlan, 5);
    assert.strictEqual(validQty.isValid, true);

    const aboveQty = validatePlanQuantity(samplePlan, 10);
    assert.strictEqual(aboveQty.isValid, true);
  });

  it("T-09: validates availability window [availableFrom, availableUntil]", () => {
    // Before start date
    const before = checkPlanAvailability(samplePlan, "2026-05-15");
    assert.strictEqual(before.isAvailable, false);
    assert.match(before.reason || "", /not available until 2026-06-01/);

    // After end date
    const after = checkPlanAvailability(samplePlan, "2027-01-10");
    assert.strictEqual(after.isAvailable, false);
    assert.match(after.reason || "", /expired on 2026-12-31/);

    // Within window
    const inside = checkPlanAvailability(samplePlan, "2026-08-15");
    assert.strictEqual(inside.isAvailable, true);

    // Inactive plan is unavailable
    const inactive = checkPlanAvailability({ ...samplePlan, isActive: false }, "2026-08-15");
    assert.strictEqual(inactive.isAvailable, false);
  });

  it("validates plan schema date order and billing interval units", () => {
    // End date before start date must be rejected
    const invalidDates = planSchema.safeParse({
      ...samplePlan,
      availableFrom: "2026-12-31",
      availableUntil: "2026-01-01",
    });
    assert.strictEqual(invalidDates.success, false);

    // Interval count <= 0 must be rejected
    const invalidCount = planSchema.safeParse({
      ...samplePlan,
      billingIntervalCount: 0,
    });
    assert.strictEqual(invalidCount.success, false);

    // Valid units: daily, weekly, monthly, yearly
    for (const unit of ["daily", "weekly", "monthly", "yearly"] as const) {
      const valid = planSchema.safeParse({
        ...samplePlan,
        billingIntervalUnit: unit,
      });
      assert.ok(valid.success);
    }
  });
});

describe("Phase 2: Taxes Validation", () => {
  it("accepts valid tax percentage rates", () => {
    const valid = taxSchema.safeParse({
      taxCode: "GST-18",
      name: "GST 18%",
      ratePercent: 18.0,
      isActive: true,
    });
    assert.ok(valid.success);
  });

  it("rejects negative tax rates or rates above 100%", () => {
    const negative = taxSchema.safeParse({
      taxCode: "TAX-NEG",
      name: "Negative Tax",
      ratePercent: -5,
    });
    assert.strictEqual(negative.success, false);

    const above100 = taxSchema.safeParse({
      taxCode: "TAX-EXCESS",
      name: "Excessive Tax",
      ratePercent: 105,
    });
    assert.strictEqual(above100.success, false);
  });
});

describe("Phase 2: Discounts (T-17, T-18, T-20, T-21)", () => {
  const percentageDiscount = {
    discountCode: "LAUNCH20",
    name: "Launch 20% Off",
    scope: "subscription" as const,
    discountType: "percentage" as const,
    value: 20,
    currencyCode: "INR",
    minimumPurchaseAmount: 1000,
    minimumQuantity: 1,
    startsOn: "2026-01-01",
    endsOn: "2026-12-31",
    maxUses: 100,
    priority: 10,
    isActive: true,
    productIds: [],
  };

  const productFixedDiscount = {
    discountCode: "PROD500",
    name: "500 Off Workspace",
    scope: "product" as const,
    discountType: "fixed" as const,
    value: 500,
    currencyCode: "INR",
    minimumPurchaseAmount: 1500,
    minimumQuantity: 2,
    startsOn: "2026-01-01",
    endsOn: "2026-12-31",
    maxUses: 50,
    priority: 20,
    isActive: true,
    productIds: ["prd-uuid-1"],
  };

  it("T-17: rejects expired discount", () => {
    const expiredCheck = checkDiscountEligibility(percentageDiscount, {
      purchaseAmount: 2000,
      quantity: 2,
      date: "2027-01-15",
    });
    assert.strictEqual(expiredCheck.isEligible, false);
    assert.match(expiredCheck.reason || "", /expired on 2026-12-31/);
  });

  it("T-18: rejects discount when max uses limit is reached", () => {
    const limitReached = checkDiscountEligibility(percentageDiscount, {
      purchaseAmount: 2000,
      quantity: 2,
      date: "2026-06-01",
      currentUses: 100,
    });
    assert.strictEqual(limitReached.isEligible, false);
    assert.match(limitReached.reason || "", /maximum usage limit of 100/);

    const underLimit = checkDiscountEligibility(percentageDiscount, {
      purchaseAmount: 2000,
      quantity: 2,
      date: "2026-06-01",
      currentUses: 99,
    });
    assert.strictEqual(underLimit.isEligible, true);
  });

  it("T-20: enforces product scope and minimum quantity", () => {
    // Non-matching product
    const wrongProduct = checkDiscountEligibility(productFixedDiscount, {
      purchaseAmount: 2000,
      quantity: 2,
      date: "2026-06-01",
      productId: "prd-uuid-999",
    });
    assert.strictEqual(wrongProduct.isEligible, false);
    assert.match(wrongProduct.reason || "", /not eligible for this product-scoped discount/);

    // Below minimum quantity (1 < 2)
    const lowQuantity = checkDiscountEligibility(productFixedDiscount, {
      purchaseAmount: 2000,
      quantity: 1,
      date: "2026-06-01",
      productId: "prd-uuid-1",
    });
    assert.strictEqual(lowQuantity.isEligible, false);
    assert.match(lowQuantity.reason || "", /below required minimum quantity of 2/);

    // Matching product and valid quantity
    const matching = checkDiscountEligibility(productFixedDiscount, {
      purchaseAmount: 2000,
      quantity: 2,
      date: "2026-06-01",
      productId: "prd-uuid-1",
    });
    assert.strictEqual(matching.isEligible, true);
  });

  it("T-21: calculates subscription-scoped and product-scoped discount deductions decimal-safely", () => {
    // 20% of 2500.00 = 500.00
    const pctDeduction = calculateDiscountAmount(percentageDiscount, 2500);
    assert.strictEqual(pctDeduction, 500.0);

    // Fixed 500.00 deduction from 2000.00 = 500.00
    const fixedDeduction = calculateDiscountAmount(productFixedDiscount, 2000);
    assert.strictEqual(fixedDeduction, 500.0);

    // Fixed deduction cannot exceed subtotal (cap at subtotal)
    const cappedDeduction = calculateDiscountAmount(productFixedDiscount, 300);
    assert.strictEqual(cappedDeduction, 300.0);
  });

  it("validates discount schema constraints", () => {
    // Percentage > 100 rejected
    const excessPct = discountSchema.safeParse({
      ...percentageDiscount,
      value: 120,
    });
    assert.strictEqual(excessPct.success, false);

    // End date before start date rejected
    const dateMismatch = discountSchema.safeParse({
      ...percentageDiscount,
      startsOn: "2026-12-31",
      endsOn: "2026-01-01",
    });
    assert.strictEqual(dateMismatch.success, false);

    // Product-scoped without products rejected
    const missingProducts = discountSchema.safeParse({
      ...productFixedDiscount,
      productIds: [],
    });
    assert.strictEqual(missingProducts.success, false);
  });
});
