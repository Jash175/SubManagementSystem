import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateUTC } from "@/features/subscriptions/lifecycle";
import { round2Num } from "@/features/billing/engine";
import type { FinancialSummaryMetrics } from "@/types";

export interface FinancialMetricsOptions {
  fromDate?: string;
  toDate?: string;
  customerId?: string;
  asOfDate?: string;
}

/**
 * Calculates aggregated financial totals using persisted invoice and payment records.
 * Adheres strictly to Phase 4 rules:
 * - Invoiced total: Confirmed, Partially Paid, and Paid invoices only (excludes draft, cancelled, void)
 * - Collected total: Actual amount paid on valid invoices
 * - Outstanding balance: Remaining balance due on confirmed and partially paid invoices
 * - Overdue total & count: Invoices with positive balance whose due_date < asOfDate
 * - Zero fabricated data: returns clean zeros if empty
 */
export async function getFinancialMetrics(
  options?: FinancialMetricsOptions
): Promise<FinancialSummaryMetrics> {
  const supabase = await getSupabaseServerClient();
  const emptyMetrics: FinancialSummaryMetrics = {
    invoicedTotal: 0,
    collectedTotal: 0,
    outstandingTotal: 0,
    overdueTotal: 0,
    overdueCount: 0,
    totalInvoicesCount: 0,
    paidInvoicesCount: 0,
    partiallyPaidCount: 0,
    unpaidCount: 0,
    draftCount: 0,
  };

  if (!supabase) return emptyMetrics;

  const today = options?.asOfDate || formatDateUTC(new Date());

  let query = supabase
    .from("invoices")
    .select("id, status, total, amount_paid, balance_due, due_date, issued_at");

  if (options?.customerId) {
    query = query.eq("customer_id", options.customerId);
  }

  if (options?.fromDate) {
    query = query.gte("issued_at", `${options.fromDate}T00:00:00.000Z`);
  }

  if (options?.toDate) {
    query = query.lte("issued_at", `${options.toDate}T23:59:59.999Z`);
  }

  const { data: invoices, error } = await query;
  if (error || !invoices || invoices.length === 0) {
    return emptyMetrics;
  }

  let invoicedTotal = 0;
  let collectedTotal = 0;
  let outstandingTotal = 0;
  let overdueTotal = 0;
  let overdueCount = 0;
  let paidCount = 0;
  let partiallyPaidCount = 0;
  let unpaidCount = 0;
  let draftCount = 0;

  for (const inv of invoices) {
    const status = inv.status;
    const total = Number(inv.total || 0);
    const amountPaid = Number(inv.amount_paid || 0);
    const balanceDue = Number(inv.balance_due ?? total - amountPaid);
    const dueDate = inv.due_date;

    if (status === "draft") {
      draftCount++;
      continue;
    }

    if (status === "cancelled" || status === "void") {
      // Ignored for active financial metrics
      continue;
    }

    // Status is confirmed, partially_paid, or paid
    invoicedTotal = round2Num(invoicedTotal + total);
    collectedTotal = round2Num(collectedTotal + amountPaid);

    if (status === "paid") {
      paidCount++;
    } else if (status === "partially_paid") {
      partiallyPaidCount++;
      outstandingTotal = round2Num(outstandingTotal + balanceDue);
    } else if (status === "confirmed") {
      unpaidCount++;
      outstandingTotal = round2Num(outstandingTotal + balanceDue);
    }

    // Overdue check
    if ((status === "confirmed" || status === "partially_paid") && balanceDue > 0) {
      if (dueDate && dueDate < today) {
        overdueCount++;
        overdueTotal = round2Num(overdueTotal + balanceDue);
      }
    }
  }

  return {
    invoicedTotal,
    collectedTotal,
    outstandingTotal,
    overdueTotal,
    overdueCount,
    totalInvoicesCount: invoices.length,
    paidInvoicesCount: paidCount,
    partiallyPaidCount,
    unpaidCount,
    draftCount,
  };
}
