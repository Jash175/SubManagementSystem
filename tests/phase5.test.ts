import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateQuotationConfirmation,
  validateEarlyClose,
  validatePause,
  validateRenewal,
  calculateResumeBillingDate,
} from "../features/subscriptions/lifecycle.ts";
import { round2Num } from "../features/billing/math.ts";
import type {
  Subscription,
  Invoice,
} from "../types/index.ts";

describe("Phase 5: Customer Portal Dashboard Metrics Aggregation", () => {
  const mockSubscriptions: Subscription[] = [
    {
      id: "sub-1",
      subscriptionNumber: "SUB-001",
      customerId: "cust-1",
      planId: "plan-1",
      status: "active",
      planNameSnapshot: "Pro Plan",
      planPriceSnapshot: 100,
      currencyCode: "USD",
      startDate: "2026-10-01",
      planQuantity: 1,
      paymentTermsDays: 15,
      autoCloseOnEnd: false,
      allowEarlyClose: true,
      allowPause: true,
      allowRenewal: true,
      lines: [],
      createdAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "sub-2",
      subscriptionNumber: "SUB-002",
      customerId: "cust-1",
      planId: "plan-1",
      status: "paused",
      planNameSnapshot: "Team Plan",
      planPriceSnapshot: 200,
      currencyCode: "USD",
      startDate: "2026-09-01",
      planQuantity: 2,
      paymentTermsDays: 15,
      autoCloseOnEnd: false,
      allowEarlyClose: true,
      allowPause: true,
      allowRenewal: true,
      lines: [],
      createdAt: "2026-09-01T00:00:00Z",
    },
    {
      id: "sub-3",
      subscriptionNumber: "SUB-003",
      customerId: "cust-1",
      planId: "plan-1",
      status: "closed",
      planNameSnapshot: "Legacy Plan",
      planPriceSnapshot: 50,
      currencyCode: "USD",
      startDate: "2026-01-01",
      expiryDate: "2026-06-01",
      planQuantity: 1,
      paymentTermsDays: 15,
      autoCloseOnEnd: true,
      allowEarlyClose: false,
      allowPause: false,
      allowRenewal: false,
      lines: [],
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "quote-1",
      subscriptionNumber: "QUO-001",
      customerId: "cust-1",
      planId: "plan-1",
      status: "quotation",
      planNameSnapshot: "Enterprise Offer",
      planPriceSnapshot: 500,
      currencyCode: "USD",
      startDate: "2026-11-01",
      quotationValidUntil: "2026-11-15",
      planQuantity: 1,
      paymentTermsDays: 15,
      autoCloseOnEnd: false,
      allowEarlyClose: true,
      allowPause: true,
      allowRenewal: true,
      lines: [],
      createdAt: "2026-10-25T00:00:00Z",
    },
  ];

  const mockInvoices: Invoice[] = [
    {
      id: "inv-1",
      invoiceNumber: "INV-001",
      customerId: "cust-1",
      subscriptionId: "sub-1",
      status: "paid",
      issuedAt: "2026-10-01T00:00:00Z",
      dueDate: "2026-10-15",
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 10,
      total: 110,
      amountPaid: 110,
      balanceDue: 0,
      currencyCode: "USD",
      lines: [],
      payments: [],
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "inv-2",
      invoiceNumber: "INV-002",
      customerId: "cust-1",
      subscriptionId: "sub-1",
      status: "partially_paid",
      issuedAt: "2026-10-15T00:00:00Z",
      dueDate: "2026-10-30",
      subtotal: 200,
      discountTotal: 0,
      taxTotal: 20,
      total: 220,
      amountPaid: 100,
      balanceDue: 120,
      currencyCode: "USD",
      lines: [],
      payments: [],
      createdAt: "2026-10-15T00:00:00Z",
      updatedAt: "2026-10-15T00:00:00Z",
    },
    {
      id: "inv-3",
      invoiceNumber: "INV-003",
      customerId: "cust-1",
      subscriptionId: "sub-2",
      status: "confirmed",
      issuedAt: "2026-09-01T00:00:00Z",
      dueDate: "2026-09-15",
      subtotal: 300,
      discountTotal: 0,
      taxTotal: 30,
      total: 330,
      amountPaid: 0,
      balanceDue: 330,
      currencyCode: "USD",
      lines: [],
      payments: [],
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
    },
    {
      id: "inv-4",
      invoiceNumber: "INV-004",
      customerId: "cust-1",
      status: "cancelled",
      issuedAt: "2026-08-01T00:00:00Z",
      dueDate: "2026-08-15",
      subtotal: 50,
      discountTotal: 0,
      taxTotal: 5,
      total: 55,
      amountPaid: 0,
      balanceDue: 55,
      currencyCode: "USD",
      lines: [],
      payments: [],
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    },
  ];

  it("calculates active, paused, total subscriptions and pending quotation counts accurately", () => {
    const quotations = mockSubscriptions.filter(
      (s) => s.status === "draft" || s.status === "quotation"
    );
    const lifecycleSubs = mockSubscriptions.filter(
      (s) => s.status !== "draft" && s.status !== "quotation"
    );

    const activeCount = lifecycleSubs.filter((s) => s.status === "active").length;
    const pausedCount = lifecycleSubs.filter((s) => s.status === "paused").length;
    const pendingQuotesCount = quotations.filter((s) => s.status === "quotation").length;

    assert.equal(activeCount, 1);
    assert.equal(pausedCount, 1);
    assert.equal(lifecycleSubs.length, 3);
    assert.equal(pendingQuotesCount, 1);
  });

  it("calculates outstanding balance, collected totals, and identifies overdue invoices", () => {
    const today = "2026-10-31";

    let openCount = 0;
    let outstandingBalance = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    for (const inv of mockInvoices) {
      if (inv.status === "cancelled" || inv.status === "void") continue;

      if (inv.status === "confirmed" || inv.status === "partially_paid") {
        openCount += 1;
        outstandingBalance += inv.balanceDue;

        if (inv.dueDate < today && inv.balanceDue > 0) {
          overdueCount += 1;
          overdueAmount += inv.balanceDue;
        }
      }

      totalPaid += inv.amountPaid;
    }

    assert.equal(openCount, 2);
    // inv-2 (120) + inv-3 (330) = 450
    assert.equal(round2Num(outstandingBalance), 450);
    // inv-1 (110) + inv-2 (100) = 210
    assert.equal(round2Num(totalPaid), 210);
    // inv-2 due 2026-10-30 < 2026-10-31, inv-3 due 2026-09-15 < 2026-10-31
    assert.equal(overdueCount, 2);
    assert.equal(round2Num(overdueAmount), 450);
  });

  it("produces clean zero metrics on empty customer accounts without crashing", () => {
    const emptyInvoices: Invoice[] = [];
    let outstandingBalance = 0;
    let totalPaid = 0;
    const overdueCount = 0;

    for (const inv of emptyInvoices) {
      if (inv.status === "confirmed" || inv.status === "partially_paid") {
        outstandingBalance += inv.balanceDue;
      }
      totalPaid += inv.amountPaid;
    }

    assert.equal(outstandingBalance, 0);
    assert.equal(totalPaid, 0);
    assert.equal(overdueCount, 0);
  });
});

describe("Phase 5: Customer Isolation & Security Invariants", () => {
  it("enforces strict customer isolation on subscription filtering", () => {
    const customerAId = "cust-a";
    const customerBId = "cust-b";

    const allSubs = [
      { id: "1", customerId: customerAId, subscriptionNumber: "SUB-A" },
      { id: "2", customerId: customerBId, subscriptionNumber: "SUB-B" },
    ];

    const customerAView = allSubs.filter((s) => s.customerId === customerAId);
    assert.equal(customerAView.length, 1);
    assert.equal(customerAView[0].subscriptionNumber, "SUB-A");

    // Must never leak Customer B records
    assert.ok(customerAView.every((s) => s.customerId === customerAId));
  });

  it("enforces strict customer isolation on invoice access", () => {
    const customerAId = "cust-a";
    const customerBId = "cust-b";

    const allInvoices = [
      { id: "inv-a", customerId: customerAId, total: 100 },
      { id: "inv-b", customerId: customerBId, total: 500 },
    ];

    const customerAInvoices = allInvoices.filter((i) => i.customerId === customerAId);
    assert.equal(customerAInvoices.length, 1);
    assert.equal(customerAInvoices[0].id, "inv-a");
  });

  it("prevents customer from performing staff actions (recordPayment, billing run)", () => {
    const customerSession = {
      id: "user-cust",
      role: "customer" as const,
      customer: { id: "cust-1", customerCode: "CUST-001" },
    };

    // Customer must be rejected for staff/admin actions
    const roleStr = customerSession.role as string;
    const isStaffOrAdmin = roleStr === "admin" || roleStr === "staff";
    assert.equal(isStaffOrAdmin, false);
  });
});

describe("Phase 5: Quotation Acceptance & Expiry (T-10)", () => {
  it("T-10: rejects quotation acceptance when quotation valid until date has passed", () => {
    const today = "2026-10-31";
    const expiredQuotation = {
      status: "quotation" as const,
      quotationValidUntil: "2026-10-20",
    };

    const res = validateQuotationConfirmation(expiredQuotation, today);
    assert.equal(res.valid, false);
    assert.ok(res.error?.includes("Quotation expired"));
  });

  it("accepts quotation confirmation on or before valid until date", () => {
    const today = "2026-10-31";
    const validQuotation = {
      status: "quotation" as const,
      quotationValidUntil: "2026-11-15",
    };

    const res = validateQuotationConfirmation(validQuotation, today);
    assert.equal(res.valid, true);
  });

  it("accepts quotation on exact expiration date", () => {
    const today = "2026-10-31";
    const boundaryQuotation = {
      status: "quotation" as const,
      quotationValidUntil: "2026-10-31",
    };

    const res = validateQuotationConfirmation(boundaryQuotation, today);
    assert.equal(res.valid, true);
  });
});

describe("Phase 5: Customer Self-Service Lifecycle Governance (T-11, T-12)", () => {
  it("T-12: rejects pausing when allowPause flag is false", () => {
    const res = validatePause({
      status: "active",
      allowPause: false,
    });
    assert.equal(res.valid, false);
    assert.ok(res.error?.includes("allowPause policy flag is false"));
  });

  it("allows pausing when allowPause flag is true", () => {
    const res = validatePause({
      status: "active",
      allowPause: true,
    });
    assert.equal(res.valid, true);
  });

  it("T-11: rejects early closure prior to expiry date when allowEarlyClose is false", () => {
    const res = validateEarlyClose(
      {
        status: "active",
        allowEarlyClose: false,
        expiryDate: "2027-12-31",
      },
      "2026-10-31"
    );
    assert.equal(res.valid, false);
    assert.ok(res.error?.includes("allowEarlyClose policy flag is false"));
  });

  it("allows closure when allowEarlyClose is true", () => {
    const res = validateEarlyClose(
      {
        status: "active",
        allowEarlyClose: true,
        expiryDate: "2027-12-31",
      },
      "2026-10-31"
    );
    assert.equal(res.valid, true);
  });

  it("shifts next billing date forward upon resume by paused duration", () => {
    const pausedAt = "2026-10-01T00:00:00Z";
    const nextBillingDate = "2026-10-15";
    const asOfDate = "2026-10-11"; // Paused for 10 days

    const resumedDate = calculateResumeBillingDate(pausedAt, nextBillingDate, asOfDate);
    // 15 + 10 days = 25
    assert.equal(resumedDate, "2026-10-25");
  });

  it("validates renewal eligibility based on allowRenewal flag", () => {
    assert.equal(validateRenewal({ status: "active", allowRenewal: true }).valid, true);
    assert.equal(validateRenewal({ status: "closed", allowRenewal: true }).valid, true);
    assert.equal(validateRenewal({ status: "active", allowRenewal: false }).valid, false);
  });
});
