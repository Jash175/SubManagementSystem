import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  calculateNextBillingDate,
  calculateResumeBillingDate,
  validateQuotationConfirmation,
  validateEarlyClose,
  validatePause,
  validateResume,
  validateRenewal,
  isValidStatusTransition,
} from "../features/subscriptions/lifecycle.ts";

import {
  quotationTemplateSchema,
  createQuotationFromTemplateSchema,
  createQuotationDirectSchema,
  subscriptionActionSchema,
} from "../features/quotations/schemas.ts";

import { createCustomerSchema } from "../features/customers/schemas.ts";

describe("Phase 3: Quotation Validation & Expiry (T-10)", () => {
  test("T-10: rejects confirmation when quotation validity date has elapsed", () => {
    const expiredQuotation = {
      status: "quotation" as const,
      quotationValidUntil: "2026-10-15",
    };

    const result = validateQuotationConfirmation(expiredQuotation, "2026-10-31");
    assert.equal(result.valid, false);
    assert.match(result.error || "", /Quotation expired/);
  });

  test("accepts confirmation when quotation is within valid-until window", () => {
    const validQuotation = {
      status: "quotation" as const,
      quotationValidUntil: "2026-11-15",
    };

    const result = validateQuotationConfirmation(validQuotation, "2026-10-31");
    assert.equal(result.valid, true);
    assert.equal(result.error, undefined);
  });

  test("accepts confirmation on the exact validity expiry date", () => {
    const exactDateQuotation = {
      status: "quotation" as const,
      quotationValidUntil: "2026-10-31",
    };

    const result = validateQuotationConfirmation(exactDateQuotation, "2026-10-31");
    assert.equal(result.valid, true);
  });

  test("rejects confirmation if subscription is in active or closed status", () => {
    const activeSub = {
      status: "active" as const,
      quotationValidUntil: "2026-12-31",
    };

    const result = validateQuotationConfirmation(activeSub, "2026-10-31");
    assert.equal(result.valid, false);
    assert.match(result.error || "", /Cannot confirm subscription in 'active' state/);
  });
});

describe("Phase 3: Lifecycle Policy Flags (T-11, T-12)", () => {
  test("T-11: rejects early closure when allowEarlyClose policy flag is false prior to expiry", () => {
    const subNoEarlyClose = {
      status: "active" as const,
      allowEarlyClose: false,
      expiryDate: "2027-10-31",
    };

    const result = validateEarlyClose(subNoEarlyClose, "2026-11-01");
    assert.equal(result.valid, false);
    assert.match(result.error || "", /allowEarlyClose policy flag is false/);
  });

  test("permits closure when allowEarlyClose is true", () => {
    const subAllowEarlyClose = {
      status: "active" as const,
      allowEarlyClose: true,
      expiryDate: "2027-10-31",
    };

    const result = validateEarlyClose(subAllowEarlyClose, "2026-11-01");
    assert.equal(result.valid, true);
  });

  test("permits closure after contract expiry date even if allowEarlyClose is false", () => {
    const expiredSub = {
      status: "active" as const,
      allowEarlyClose: false,
      expiryDate: "2026-10-01",
    };

    const result = validateEarlyClose(expiredSub, "2026-10-31");
    assert.equal(result.valid, true);
  });

  test("T-12: rejects pausing when allowPause policy flag is false", () => {
    const subNoPause = {
      status: "active" as const,
      allowPause: false,
    };

    const result = validatePause(subNoPause);
    assert.equal(result.valid, false);
    assert.match(result.error || "", /allowPause policy flag is false/);
  });

  test("permits pausing when allowPause is true and subscription is active", () => {
    const subAllowPause = {
      status: "active" as const,
      allowPause: true,
    };

    const result = validatePause(subAllowPause);
    assert.equal(result.valid, true);
  });

  test("rejects pausing if subscription is already paused or closed", () => {
    const subPaused = {
      status: "paused" as const,
      allowPause: true,
    };

    const result = validatePause(subPaused);
    assert.equal(result.valid, false);
    assert.match(result.error || "", /Only active subscriptions can be paused/);
  });

  test("validates resume and shifts next billing date forward by paused duration", () => {
    const pausedAt = "2026-10-01T00:00:00.000Z";
    const currentNextBilling = "2026-10-15";
    const resumeDate = "2026-10-11"; // 10 days paused

    const shifted = calculateResumeBillingDate(pausedAt, currentNextBilling, resumeDate);
    // 2026-10-15 + 10 days = 2026-10-25
    assert.equal(shifted, "2026-10-25");
  });

  test("enforces allowRenewal policy flag on renewal", () => {
    const nonRenewable = { status: "active" as const, allowRenewal: false };
    const renewable = { status: "active" as const, allowRenewal: true };

    assert.equal(validateRenewal(nonRenewable).valid, false);
    assert.equal(validateRenewal(renewable).valid, true);
  });
});

describe("Phase 3: Calendar-Safe Next Billing Date Arithmetic (T-14)", () => {
  test("T-14: Jan 31 start date computes last day of Feb (28/29) and preserves 31 anchor for March", () => {
    // 2026 is non-leap year (Feb has 28 days)
    const febBilling = calculateNextBillingDate(
      "2026-01-31",
      "monthly",
      1,
      31, // Anchor day
      1   // Anchor month
    );
    assert.equal(febBilling, "2026-02-28");

    // Next cycle from Feb 28 must advance to March 31, preserving anchor day 31!
    const marchBilling = calculateNextBillingDate(
      "2026-02-28",
      "monthly",
      1,
      31, // Anchor day
      1
    );
    assert.equal(marchBilling, "2026-03-31");
  });

  test("leap year Feb 29 preservation for yearly intervals", () => {
    // 2024 is a leap year (Feb 29)
    // 1 year later (2025 non-leap) -> Feb 28
    const nextYearBilling = calculateNextBillingDate(
      "2024-02-29",
      "yearly",
      1,
      29, // Anchor day
      2   // Anchor month (February)
    );
    assert.equal(nextYearBilling, "2025-02-28");
  });

  test("calculates daily and weekly billing intervals correctly", () => {
    const dailyBilling = calculateNextBillingDate("2026-10-01", "daily", 5, 1, 10);
    assert.equal(dailyBilling, "2026-10-06");

    const weeklyBilling = calculateNextBillingDate("2026-10-01", "weekly", 2, 1, 10);
    // 2 weeks = 14 days -> 2026-10-15
    assert.equal(weeklyBilling, "2026-10-15");
  });
});

describe("Phase 3: State Transitions and Quotation Schemas", () => {
  test("enforces valid status journey transitions", () => {
    // Allowed transitions
    assert.equal(isValidStatusTransition("draft", "quotation"), true);
    assert.equal(isValidStatusTransition("quotation", "confirmed"), true);
    assert.equal(isValidStatusTransition("confirmed", "active"), true);
    assert.equal(isValidStatusTransition("active", "paused"), true);
    assert.equal(isValidStatusTransition("paused", "active"), true);
    assert.equal(isValidStatusTransition("active", "closed"), true);

    // Disallowed transitions
    assert.equal(isValidStatusTransition("draft", "active"), false); // Cannot jump to active
    assert.equal(isValidStatusTransition("closed", "active"), false); // Terminal state cannot transition
    assert.equal(isValidStatusTransition("paused", "confirmed"), false);
  });

  test("validates quotation template schema", () => {
    const validTemplate = {
      name: "Team Workspace Template",
      planId: "a0000000-0000-0000-0000-000000000001",
      validityDays: 30,
      isActive: true,
      lines: [
        {
          productId: "b0000000-0000-0000-0000-000000000001",
          quantity: 2,
        },
      ],
    };

    const res = quotationTemplateSchema.safeParse(validTemplate);
    assert.equal(res.success, true);

    // Rejects negative validity days
    const invalidTemplate = { ...validTemplate, validityDays: -5 };
    assert.equal(quotationTemplateSchema.safeParse(invalidTemplate).success, false);
  });

  test("validates quotation from template schema and date bounds", () => {
    const validQuotation = {
      customerId: "c0000000-0000-0000-0000-000000000001",
      templateId: "d0000000-0000-0000-0000-000000000001",
      startDate: "2026-11-01",
      expiryDate: "2027-10-31",
      planQuantity: 3,
      paymentTermsDays: 15,
    };

    assert.equal(createQuotationFromTemplateSchema.safeParse(validQuotation).success, true);

    // Rejects expiry date prior to start date
    const invalidDates = { ...validQuotation, expiryDate: "2026-10-01" };
    assert.equal(createQuotationFromTemplateSchema.safeParse(invalidDates).success, false);
  });

  test("validates resume eligibility on paused subscriptions", () => {
    assert.equal(validateResume({ status: "paused", pausedAt: "2026-10-01" }).valid, true);
    assert.equal(validateResume({ status: "active", pausedAt: null }).valid, false);
    assert.equal(validateResume({ status: "closed", pausedAt: null }).valid, false);
  });

  test("validates createQuotationDirectSchema structure and line items", () => {
    const directQuotation = {
      customerId: "c0000000-0000-0000-0000-000000000001",
      planId: "a0000000-0000-0000-0000-000000000001",
      startDate: "2026-11-01",
      planQuantity: 1,
      lines: [
        {
          productId: "b0000000-0000-0000-0000-000000000001",
          quantity: 2,
        },
      ],
    };

    assert.equal(createQuotationDirectSchema.safeParse(directQuotation).success, true);

    // Rejects zero or negative plan quantity
    assert.equal(
      createQuotationDirectSchema.safeParse({ ...directQuotation, planQuantity: 0 }).success,
      false
    );
  });

  test("validates subscriptionActionSchema allowed actions and note constraints", () => {
    // Valid actions
    assert.equal(subscriptionActionSchema.safeParse({ action: "pause" }).success, true);
    assert.equal(subscriptionActionSchema.safeParse({ action: "close", reason: "Customer requested" }).success, true);
    assert.equal(subscriptionActionSchema.safeParse({ action: "resume" }).success, true);
    assert.equal(subscriptionActionSchema.safeParse({ action: "renew" }).success, true);

    // Invalid action rejected by enum
    assert.equal(subscriptionActionSchema.safeParse({ action: "destroy" }).success, false);
    assert.equal(subscriptionActionSchema.safeParse({ action: "refund" }).success, false);
  });

  test("validates createCustomerSchema constraints", () => {
    const valid = {
      legalName: "Acme Corp",
      email: "billing@acme.com",
    };
    assert.equal(createCustomerSchema.safeParse(valid).success, true);

    // Rejects invalid email
    assert.equal(
      createCustomerSchema.safeParse({ ...valid, email: "not-an-email" }).success,
      false
    );

    // Rejects short legal name
    assert.equal(
      createCustomerSchema.safeParse({ ...valid, legalName: "A" }).success,
      false
    );
  });

  test("rejects quotation creation when customerId is empty string", () => {
    const withoutCustomer = {
      customerId: "",
      templateId: "d0000000-0000-0000-0000-000000000001",
      startDate: "2026-11-01",
    };
    const res = createQuotationFromTemplateSchema.safeParse(withoutCustomer);
    assert.equal(res.success, false);
  });
});

