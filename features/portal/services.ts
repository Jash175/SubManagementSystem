import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSubscriptions } from "@/features/subscriptions/services";
import { getInvoices } from "@/features/billing/services";
import { getPayments } from "@/features/payments/services";
import { formatDateUTC } from "@/features/subscriptions/lifecycle";
import type {
  CustomerDashboardMetrics,
  CustomerProfileDetails,
  Subscription,
  Invoice,
  Payment,
} from "@/types";

export interface CustomerDashboardData {
  metrics: CustomerDashboardMetrics;
  customer: CustomerProfileDetails | null;
  activeSubscriptions: Subscription[];
  quotations: Subscription[];
  recentInvoices: Invoice[];
  recentPayments: Payment[];
}

/**
 * Loads aggregated customer portal dashboard metrics and recent activity.
 * Strict customer scoping ensures no data leaks across accounts.
 */
export async function getCustomerDashboardData(
  customerId: string
): Promise<CustomerDashboardData> {
  const today = formatDateUTC(new Date());

  const [customer, allSubscriptions, allInvoices, recentPayments] =
    await Promise.all([
      getCustomerProfile(customerId),
      getSubscriptions({ customerId }),
      getInvoices({ customerId }),
      getPayments({ customerId, limit: 5 }),
    ]);

  // Separate subscriptions into lifecycle subscriptions and quotations
  const quotations = allSubscriptions.filter(
    (s) => s.status === "draft" || s.status === "quotation"
  );

  const lifecycleSubs = allSubscriptions.filter(
    (s) => s.status !== "draft" && s.status !== "quotation"
  );

  const activeSubscriptions = lifecycleSubs.filter(
    (s) => s.status === "active" || s.status === "paused"
  );

  const activeCount = lifecycleSubs.filter((s) => s.status === "active").length;
  const pausedCount = lifecycleSubs.filter((s) => s.status === "paused").length;
  const pendingQuotesCount = quotations.filter((s) => s.status === "quotation").length;

  // Invoice calculations
  let openInvoicesCount = 0;
  let outstandingBalance = 0;
  let totalPaid = 0;
  let overdueInvoicesCount = 0;
  let overdueAmount = 0;

  for (const inv of allInvoices) {
    if (inv.status === "cancelled" || inv.status === "void") {
      continue;
    }

    if (inv.status === "confirmed" || inv.status === "partially_paid") {
      openInvoicesCount += 1;
      outstandingBalance += inv.balanceDue;

      if (inv.dueDate < today && inv.balanceDue > 0) {
        overdueInvoicesCount += 1;
        overdueAmount += inv.balanceDue;
      }
    }

    totalPaid += inv.amountPaid;
  }

  const currencyCode = customer?.currencyCode || "USD";

  const metrics: CustomerDashboardMetrics = {
    activeSubscriptionsCount: activeCount,
    pausedSubscriptionsCount: pausedCount,
    totalSubscriptionsCount: lifecycleSubs.length,
    pendingQuotationsCount: pendingQuotesCount,
    openInvoicesCount,
    outstandingBalance: Math.round(outstandingBalance * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    overdueInvoicesCount,
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    currencyCode,
  };

  return {
    metrics,
    customer,
    activeSubscriptions,
    quotations,
    recentInvoices: allInvoices.slice(0, 5),
    recentPayments,
  };
}

/**
 * Retrieves full customer profile and billing address details.
 */
export async function getCustomerProfile(
  customerId: string
): Promise<CustomerProfileDetails | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("customers")
      .select(`
        id,
        customer_code,
        legal_name,
        company_name,
        email,
        phone,
        currency_code,
        is_active,
        billing_address_line1,
        billing_address_line2,
        billing_city,
        billing_state,
        billing_postal_code,
        billing_country,
        created_at,
        updated_at
      `)
      .eq("id", customerId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      customerCode: data.customer_code,
      legalName: data.legal_name,
      companyName: data.company_name,
      email: data.email,
      phone: data.phone,
      currencyCode: data.currency_code,
      isActive: data.is_active,
      billingAddressLine1: data.billing_address_line1,
      billingAddressLine2: data.billing_address_line2,
      billingCity: data.billing_city,
      billingState: data.billing_state,
      billingPostalCode: data.billing_postal_code,
      billingCountry: data.billing_country,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error("Failed to load customer profile:", err);
    return null;
  }
}

/**
 * Fetches only quotations for a customer.
 */
export async function getCustomerQuotations(
  customerId: string
): Promise<Subscription[]> {
  const all = await getSubscriptions({ customerId });
  return all.filter((s) => s.status === "draft" || s.status === "quotation");
}
