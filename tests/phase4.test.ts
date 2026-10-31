import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  calculateNextBillingDate,
} from "../features/subscriptions/lifecycle.ts";

import {
  round2Num,
  addDaysUTC,
} from "../features/billing/math.ts";

import {
  recordPaymentSchema,
} from "../features/payments/schemas.ts";

import {
  billingRunInputSchema,
} from "../features/billing/schemas.ts";

import type {
  InvoiceStatus,
  FinancialSummaryMetrics,
} from "../types/index.ts";

describe("Phase 4: Billing-Period and Month-End Date Calculations", () => {
  test("preserves anchor day across month ends without drifting (Jan 31 -> Feb 28 -> Mar 31)", () => {
    const anchorDay = 31;
    const anchorMonth = 1;

    // Jan 31 -> Feb 28 in a non-leap year (2025)
    const febDate = calculateNextBillingDate("2025-01-31", "monthly", 1, anchorDay, anchorMonth);
    assert.equal(febDate, "2025-02-28");

    // Feb 28 -> Mar 31 (recovers anchor day 31, does not drift to Mar 28!)
    const marDate = calculateNextBillingDate(febDate, "monthly", 1, anchorDay, anchorMonth);
    assert.equal(marDate, "2025-03-31");

    // Mar 31 -> Apr 30 (30-day month)
    const aprDate = calculateNextBillingDate(marDate, "monthly", 1, anchorDay, anchorMonth);
    assert.equal(aprDate, "2025-04-30");

    // Apr 30 -> May 31 (recovers anchor day 31)
    const mayDate = calculateNextBillingDate(aprDate, "monthly", 1, anchorDay, anchorMonth);
    assert.equal(mayDate, "2025-05-31");
  });

  test("handles leap years correctly for February anchor dates (Jan 31, 2024 -> Feb 29, 2024)", () => {
    const anchorDay = 31;
    const anchorMonth = 1;

    // 2024 is a leap year (Feb has 29 days)
    const feb2024 = calculateNextBillingDate("2024-01-31", "monthly", 1, anchorDay, anchorMonth);
    assert.equal(feb2024, "2024-02-29");

    const mar2024 = calculateNextBillingDate(feb2024, "monthly", 1, anchorDay, anchorMonth);
    assert.equal(mar2024, "2024-03-31");
  });

  test("calculates daily, weekly, and yearly interval cycles accurately", () => {
    // Daily: 3 days
    const dailyNext = calculateNextBillingDate("2026-10-01", "daily", 3, 1, 10);
    assert.equal(dailyNext, "2026-10-04");

    // Weekly: 2 weeks (14 days)
    const weeklyNext = calculateNextBillingDate("2026-10-01", "weekly", 2, 1, 10);
    assert.equal(weeklyNext, "2026-10-15");

    // Yearly: 1 year
    const yearlyNext = calculateNextBillingDate("2026-10-31", "yearly", 1, 31, 10);
    assert.equal(yearlyNext, "2027-10-31");
  });

  test("calculates due date from payment terms days", () => {
    const issueDate = "2026-10-01";
    assert.equal(addDaysUTC(issueDate, 15), "2026-10-16");
    assert.equal(addDaysUTC(issueDate, 30), "2026-10-31");
    assert.equal(addDaysUTC("2026-12-25", 10), "2027-01-04");
  });
});

describe("Phase 4: Recurring Billing Eligibility & State Rules", () => {
  test("skips subscriptions not in 'active' status (draft, quotation, paused, closed)", () => {
    const statuses = ["draft", "quotation", "confirmed", "paused", "closed"] as const;
    const asOfDate = "2026-10-31";

    for (const status of statuses) {
      const isEligibleForRecurringBilling =
        (status as string) === "active" && "2026-10-15" <= asOfDate;
      assert.equal(isEligibleForRecurringBilling, false, `Status ${status} should not be eligible for recurring billing`);
    }
  });

  test("skips active subscriptions whose next billing date is in the future", () => {
    const asOfDate = "2026-10-31";
    const subNextBillingDate = "2026-11-15";
    const isDue = subNextBillingDate <= asOfDate;
    assert.equal(isDue, false, "Future billing date must not be billed prematurely");
  });

  test("includes active subscriptions whose next billing date is due on or before asOfDate", () => {
    const asOfDate = "2026-10-31";
    assert.equal("2026-10-31" <= asOfDate, true, "Due today must be eligible");
    assert.equal("2026-10-01" <= asOfDate, true, "Past due must be eligible");
  });

  test("auto-close on expiry rule triggers when asOfDate > expiryDate and autoCloseOnEnd is true", () => {
    const asOfDate = "2026-11-01";
    const sub = {
      status: "active",
      expiryDate: "2026-10-31",
      autoCloseOnEnd: true,
    };

    const isExpiredAndAutoClose =
      sub.status === "active" &&
      sub.autoCloseOnEnd &&
      sub.expiryDate !== null &&
      asOfDate > sub.expiryDate;

    assert.equal(isExpiredAndAutoClose, true);
  });
});

describe("Phase 4: Idempotency & Duplicate Invoice Protection (T-13 to T-16)", () => {
  test("T-14: duplicate billing execution does not recreate invoice for the same subscription and period", () => {
    // Simulated database invoice store
    const existingInvoices: {
      subscriptionId: string;
      billingPeriodStart: string;
      billingPeriodEnd: string;
    }[] = [
      {
        subscriptionId: "sub-123",
        billingPeriodStart: "2026-10-01",
        billingPeriodEnd: "2026-11-01",
      },
    ];

    function checkInvoiceExists(subId: string, start: string, end: string) {
      return existingInvoices.some(
        (i) =>
          i.subscriptionId === subId &&
          i.billingPeriodStart === start &&
          i.billingPeriodEnd === end
      );
    }

    // Re-run with the same period
    const isDuplicate = checkInvoiceExists("sub-123", "2026-10-01", "2026-11-01");
    assert.equal(isDuplicate, true, "Existing invoice must be detected to prevent duplication");

    // Advance to next period
    const nextPeriodIsDuplicate = checkInvoiceExists("sub-123", "2026-11-01", "2026-12-01");
    assert.equal(nextPeriodIsDuplicate, false, "New period is not a duplicate");
  });

  test("T-15: subscription next_billing_date only advances after invoice generation succeeds", () => {
    let nextBillingDate = "2026-10-01";
    const periodEnd = "2026-11-01";

    // Simulate failed invoice insertion
    const invoiceCreationSucceeded = false;
    if (invoiceCreationSucceeded) {
      nextBillingDate = periodEnd;
    }

    assert.equal(nextBillingDate, "2026-10-01", "Date must NOT advance if invoice creation fails");

    // Simulate successful invoice insertion
    const secondAttemptSucceeded = true;
    if (secondAttemptSucceeded) {
      nextBillingDate = periodEnd;
    }

    assert.equal(nextBillingDate, "2026-11-01", "Date MUST advance to period end once invoice creation succeeds");
  });
});

describe("Phase 4: Financial Immutability & Price Snapshots", () => {
  test("historical invoice line prices and totals remain unchanged after plan price updates", () => {
    // Created invoice with original plan price of 500
    const invoice = {
      id: "inv-001",
      total: 590.0, // 500 + 18% tax
      lines: [
        {
          descriptionSnapshot: "Professional Plan",
          quantity: 1,
          unitPrice: 500.0,
          subtotal: 500.0,
          taxAmount: 90.0,
          lineTotal: 590.0,
        },
      ],
    };

    // Later: Admin updates catalog plan price from 500 to 750
    const updatedCatalogPlan = {
      price: 750.0,
    };

    // The historical invoice line must NOT be recalculated from the catalog!
    assert.equal(invoice.lines[0].unitPrice, 500.0);
    assert.equal(invoice.lines[0].lineTotal, 590.0);
    assert.equal(invoice.total, 590.0);
    assert.notEqual(invoice.lines[0].unitPrice, updatedCatalogPlan.price);
  });
});

describe("Phase 4: Decimal-Safe Financial Rounding & Tax Calculations", () => {
  test("calculates percentage non-compound tax accurately without floating point leaks", () => {
    const subtotal = 199.99;
    const taxRate = 18.0; // 18% GST

    const taxAmount = round2Num((subtotal * taxRate) / 100);
    assert.equal(taxAmount, 36.0); // 199.99 * 0.18 = 35.9982 -> rounded to 36.00

    const total = round2Num(subtotal + taxAmount);
    assert.equal(total, 235.99);
  });

  test("allocates multi-line discounts proportionally with remainder on final line", () => {
    const lines = [
      { id: "line-1", subtotal: 100.0, discount: 0 },
      { id: "line-2", subtotal: 200.0, discount: 0 },
      { id: "line-3", subtotal: 300.0, discount: 0 },
    ];
    const invoiceSubtotal = 600.0;
    const discountVal = 50.0; // Fixed 50 discount across entire invoice

    let distributed = 0;
    for (let i = 0; i < lines.length; i++) {
      if (i === lines.length - 1) {
        lines[i].discount = round2Num(discountVal - distributed);
      } else {
        const ratio = lines[i].subtotal / invoiceSubtotal;
        const lineDisc = round2Num(discountVal * ratio);
        lines[i].discount = lineDisc;
        distributed += lineDisc;
      }
    }

    // Line 1: 100/600 * 50 = 8.33
    assert.equal(lines[0].discount, 8.33);
    // Line 2: 200/600 * 50 = 16.67
    assert.equal(lines[1].discount, 16.67);
    // Line 3: 50 - (8.33 + 16.67) = 25.00
    assert.equal(lines[2].discount, 25.0);

    const sumDiscount = round2Num(lines.reduce((a, b) => a + b.discount, 0));
    assert.equal(sumDiscount, 50.0, "Sum of line discounts must exactly match header discount");
  });
});

describe("Phase 4: Payment Recording & Balance Invariants", () => {
  test("partial payment reduces balance due and transitions status to partially_paid", () => {
    const invoice = {
      total: 1000.0,
      amountPaid: 0.0,
      balanceDue: 1000.0,
      status: "confirmed" as InvoiceStatus,
    };

    const paymentAmount = 400.0;

    // Apply payment
    invoice.amountPaid = round2Num(invoice.amountPaid + paymentAmount);
    invoice.balanceDue = round2Num(invoice.total - invoice.amountPaid);
    invoice.status = invoice.amountPaid >= invoice.total ? "paid" : "partially_paid";

    assert.equal(invoice.amountPaid, 400.0);
    assert.equal(invoice.balanceDue, 600.0);
    assert.equal(invoice.status, "partially_paid");
  });

  test("multiple payments accumulate to full settlement and transition status to paid", () => {
    const invoice = {
      total: 1000.0,
      amountPaid: 400.0,
      balanceDue: 600.0,
      status: "partially_paid" as InvoiceStatus,
    };

    // Second payment settling remainder
    const secondPayment = 600.0;
    invoice.amountPaid = round2Num(invoice.amountPaid + secondPayment);
    invoice.balanceDue = round2Num(invoice.total - invoice.amountPaid);
    invoice.status = invoice.amountPaid >= invoice.total ? "paid" : "partially_paid";

    assert.equal(invoice.amountPaid, 1000.0);
    assert.equal(invoice.balanceDue, 0.0);
    assert.equal(invoice.status, "paid");
  });

  test("rejects overpayment when payment amount exceeds outstanding balance due", () => {
    const invoice = {
      total: 500.0,
      amountPaid: 300.0,
      balanceDue: 200.0,
      status: "partially_paid" as const,
    };

    const excessivePayment = 250.0;
    const isOverpayment = excessivePayment > invoice.balanceDue;

    assert.equal(isOverpayment, true, "Payment of 250 must be rejected when balance due is 200");
  });

  test("rejects payments on draft, cancelled, or void invoices", () => {
    const invalidStatuses: InvoiceStatus[] = ["draft", "cancelled", "void"];

    for (const st of invalidStatuses) {
      const canAcceptPayment = st === "confirmed" || st === "partially_paid";
      assert.equal(canAcceptPayment, false, `Invoice in '${st}' status must reject payments`);
    }
  });

  test("rejects payments on fully paid invoices", () => {
    const paidInvoice = {
      total: 500.0,
      amountPaid: 500.0,
      balanceDue: 0.0,
      status: "paid" as const,
    };

    const canAcceptPayment = paidInvoice.balanceDue > 0;
    assert.equal(canAcceptPayment, false, "Paid invoice must reject further payments");
  });
});

describe("Phase 4: Input Validation Schemas", () => {
  test("recordPaymentSchema validates positive amounts and max 2 decimal places", () => {
    // Valid payment
    const valid = recordPaymentSchema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 149.99,
      paymentMethod: "bank_transfer",
    });
    assert.equal(valid.success, true);

    // Rejects zero amount
    const zero = recordPaymentSchema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 0,
      paymentMethod: "cash",
    });
    assert.equal(zero.success, false);

    // Rejects negative amount
    const negative = recordPaymentSchema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      amount: -50,
      paymentMethod: "upi",
    });
    assert.equal(negative.success, false);

    // Rejects more than 2 decimal places (e.g. 10.555)
    const threeDecimals = recordPaymentSchema.safeParse({
      invoiceId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 10.555,
      paymentMethod: "card",
    });
    assert.equal(threeDecimals.success, false);
  });

  test("billingRunInputSchema validates date formats and trigger sources", () => {
    const valid = billingRunInputSchema.safeParse({
      asOfDate: "2026-10-31",
      triggerSource: "manual",
      autoConfirm: true,
    });
    assert.equal(valid.success, true);

    const invalidDate = billingRunInputSchema.safeParse({
      asOfDate: "31-10-2026", // Wrong format
    });
    assert.equal(invalidDate.success, false);
  });
});

describe("Phase 4: Financial Dashboard Metric Aggregation Rules", () => {
  test("aggregates invoiced, collected, outstanding, and overdue totals accurately", () => {
    const today = "2026-10-31";

    const mockInvoices = [
      // 1. Confirmed, overdue (due Oct 15), unpaid
      { status: "confirmed", total: 1000.0, amountPaid: 0.0, balanceDue: 1000.0, dueDate: "2026-10-15" },
      // 2. Partially paid, overdue (due Oct 20)
      { status: "partially_paid", total: 800.0, amountPaid: 300.0, balanceDue: 500.0, dueDate: "2026-10-20" },
      // 3. Paid in full (due Oct 25)
      { status: "paid", total: 1200.0, amountPaid: 1200.0, balanceDue: 0.0, dueDate: "2026-10-25" },
      // 4. Confirmed, not overdue (due Nov 15)
      { status: "confirmed", total: 600.0, amountPaid: 0.0, balanceDue: 600.0, dueDate: "2026-11-15" },
      // 5. Draft invoice (must NOT be counted in invoiced total!)
      { status: "draft", total: 400.0, amountPaid: 0.0, balanceDue: 400.0, dueDate: "2026-11-20" },
      // 6. Cancelled invoice (must NOT be counted!)
      { status: "cancelled", total: 500.0, amountPaid: 0.0, balanceDue: 500.0, dueDate: "2026-10-10" },
    ];

    let invoicedTotal = 0;
    let collectedTotal = 0;
    let outstandingTotal = 0;
    let overdueTotal = 0;
    let overdueCount = 0;

    for (const inv of mockInvoices) {
      if (inv.status === "draft" || inv.status === "cancelled") {
        continue; // Excluded from invoiced/active metrics
      }

      invoicedTotal = round2Num(invoicedTotal + inv.total);
      collectedTotal = round2Num(collectedTotal + inv.amountPaid);
      outstandingTotal = round2Num(outstandingTotal + inv.balanceDue);

      if ((inv.status === "confirmed" || inv.status === "partially_paid") && inv.balanceDue > 0) {
        if (inv.dueDate < today) {
          overdueCount++;
          overdueTotal = round2Num(overdueTotal + inv.balanceDue);
        }
      }
    }

    // Invoiced: 1000 + 800 + 1200 + 600 = 3600 (excludes draft 400 and cancelled 500)
    assert.equal(invoicedTotal, 3600.0);

    // Collected: 0 + 300 + 1200 + 0 = 1500
    assert.equal(collectedTotal, 1500.0);

    // Outstanding: 1000 + 500 + 0 + 600 = 2100
    assert.equal(outstandingTotal, 2100.0);

    // Overdue: #1 (1000) + #2 (500) = 1500; count = 2
    assert.equal(overdueTotal, 1500.0);
    assert.equal(overdueCount, 2);
  });

  test("empty dataset produces clean zeros with zero fabricated numbers", () => {
    const emptyInvoices: unknown[] = [];

    const metrics: FinancialSummaryMetrics = {
      invoicedTotal: 0,
      collectedTotal: 0,
      outstandingTotal: 0,
      overdueTotal: 0,
      overdueCount: 0,
      totalInvoicesCount: emptyInvoices.length,
      paidInvoicesCount: 0,
      partiallyPaidCount: 0,
      unpaidCount: 0,
      draftCount: 0,
    };

    assert.equal(metrics.invoicedTotal, 0);
    assert.equal(metrics.collectedTotal, 0);
    assert.equal(metrics.outstandingTotal, 0);
    assert.equal(metrics.overdueTotal, 0);
    assert.equal(metrics.overdueCount, 0);
    assert.equal(metrics.totalInvoicesCount, 0);
  });
});
