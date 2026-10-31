import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Invoice,
  InvoiceLine,
  InvoiceLineTax,
  BillingRun,
  InvoiceStatus,
  PaymentMethod,
  SubscriptionStatus,
} from "@/types";

interface InvoiceQueryOptions {
  customerId?: string;
  status?: InvoiceStatus;
  search?: string;
  limit?: number;
}

interface RawCustomer {
  id: string;
  customer_code: string;
  legal_name: string;
  email: string;
  company_name?: string | null;
  phone?: string | null;
}

interface RawInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  subscription_id?: string | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  status: string;
  issued_at: string;
  due_date: string;
  currency_code: string;
  subtotal: number | string;
  discount_total: number | string;
  tax_total: number | string;
  total: number | string;
  amount_paid: number | string;
  balance_due: number | string;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  customer?: RawCustomer | RawCustomer[] | null;
}

interface RawInvoiceLineTax {
  id: string;
  invoice_line_id: string;
  tax_id?: string | null;
  tax_name_snapshot: string;
  rate_percent_snapshot: number | string;
  tax_amount: number | string;
}

interface RawInvoiceLine {
  id: string;
  invoice_id: string;
  product_id?: string | null;
  variant_id?: string | null;
  line_type: "plan" | "product" | "other";
  description_snapshot: string;
  quantity: number | string;
  unit_price: number | string;
  subtotal: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  line_total: number | string;
  invoice_line_taxes?: RawInvoiceLineTax[] | null;
}

interface RawPayment {
  id: string;
  invoice_id: string;
  amount: number | string;
  payment_method: string;
  paid_at: string;
  note?: string | null;
  reference_number?: string | null;
  recorded_by?: string | null;
  created_at: string;
}

interface RawBillingRun {
  id: string;
  trigger_source: "scheduled" | "manual" | "retry";
  status: "running" | "completed" | "completed_with_errors" | "failed";
  started_at: string;
  completed_at?: string | null;
  subscriptions_checked?: number | null;
  invoices_created?: number | null;
  invoices_skipped?: number | null;
  errors?: { subscriptionId?: string; subscriptionNumber?: string; error: string }[] | null;
  initiated_by?: string | null;
}

/**
 * Fetches invoices with customer and lines details.
 * Respects customer isolation if customerId is provided.
 */
export async function getInvoices(options?: InvoiceQueryOptions): Promise<Invoice[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      customer_id,
      subscription_id,
      billing_period_start,
      billing_period_end,
      status,
      issued_at,
      due_date,
      currency_code,
      subtotal,
      discount_total,
      tax_total,
      total,
      amount_paid,
      balance_due,
      notes,
      created_by,
      created_at,
      updated_at,
      customer:customers (
        id,
        customer_code,
        legal_name,
        email,
        company_name,
        phone
      )
    `)
    .order("issued_at", { ascending: false });

  if (options?.customerId) {
    query = query.eq("customer_id", options.customerId);
  }

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.search) {
    query = query.ilike("invoice_number", `%${options.search}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown as RawInvoice[]).map((inv): Invoice => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    customerId: inv.customer_id,
    subscriptionId: inv.subscription_id,
    billingPeriodStart: inv.billing_period_start,
    billingPeriodEnd: inv.billing_period_end,
    status: inv.status as InvoiceStatus,
    issuedAt: inv.issued_at,
    dueDate: inv.due_date,
    currencyCode: inv.currency_code,
    subtotal: Number(inv.subtotal),
    discountTotal: Number(inv.discount_total),
    taxTotal: Number(inv.tax_total),
    total: Number(inv.total),
    amountPaid: Number(inv.amount_paid),
    balanceDue: Number(inv.balance_due),
    notes: inv.notes,
    createdBy: inv.created_by,
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
    customer: (() => {
      const cust = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
      return cust
        ? {
            id: cust.id,
            customerCode: cust.customer_code,
            legalName: cust.legal_name,
            email: cust.email,
            companyName: cust.company_name,
            phone: cust.phone,
          }
        : undefined;
    })(),
  }));
}

/**
 * Fetches single invoice with all line items, taxes, and recorded payments.
 */
export async function getInvoiceById(
  id: string,
  options?: { customerId?: string }
): Promise<Invoice | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  let query = supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      customer_id,
      subscription_id,
      billing_period_start,
      billing_period_end,
      status,
      issued_at,
      due_date,
      currency_code,
      subtotal,
      discount_total,
      tax_total,
      total,
      amount_paid,
      balance_due,
      notes,
      created_by,
      created_at,
      updated_at,
      customer:customers (
        id,
        customer_code,
        legal_name,
        email,
        company_name,
        phone
      ),
      subscription:subscriptions (
        id,
        subscription_number,
        plan_name_snapshot,
        status,
        start_date,
        next_billing_date
      )
    `)
    .eq("id", id);

  if (options?.customerId) {
    query = query.eq("customer_id", options.customerId);
  }

  const { data: invRaw, error } = await query.maybeSingle();
  if (error || !invRaw) return null;

  const inv = invRaw as unknown as RawInvoice & {
    subscription?: {
      id: string;
      subscription_number: string;
      plan_name_snapshot: string;
      status: string;
      start_date: string;
      next_billing_date?: string | null;
    } | null;
  };

  // Load line items with line taxes
  const { data: linesData } = await supabase
    .from("invoice_lines")
    .select(`
      id,
      invoice_id,
      product_id,
      variant_id,
      line_type,
      description_snapshot,
      quantity,
      unit_price,
      subtotal,
      discount_amount,
      tax_amount,
      line_total,
      invoice_line_taxes (
        id,
        invoice_line_id,
        tax_id,
        tax_name_snapshot,
        rate_percent_snapshot,
        tax_amount
      )
    `)
    .eq("invoice_id", id)
    .order("line_type", { ascending: true });

  const lines: InvoiceLine[] = (linesData as unknown as RawInvoiceLine[] || []).map((l): InvoiceLine => {
    const taxes: InvoiceLineTax[] = (l.invoice_line_taxes || []).map(
      (t): InvoiceLineTax => ({
        id: t.id,
        invoiceLineId: t.invoice_line_id,
        taxId: t.tax_id,
        taxNameSnapshot: t.tax_name_snapshot,
        ratePercentSnapshot: Number(t.rate_percent_snapshot),
        taxAmount: Number(t.tax_amount),
      })
    );

    return {
      id: l.id,
      invoiceId: l.invoice_id,
      productId: l.product_id,
      variantId: l.variant_id,
      lineType: l.line_type,
      descriptionSnapshot: l.description_snapshot,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      subtotal: Number(l.subtotal),
      discountAmount: Number(l.discount_amount),
      taxAmount: Number(l.tax_amount),
      lineTotal: Number(l.line_total),
      taxes,
    };
  });

  // Load payments
  const { data: paymentsData } = await supabase
    .from("payments")
    .select(`
      id,
      invoice_id,
      amount,
      payment_method,
      paid_at,
      note,
      reference_number,
      recorded_by,
      created_at
    `)
    .eq("invoice_id", id)
    .order("paid_at", { ascending: false });

  const payments = (paymentsData as unknown as RawPayment[] || []).map((p) => ({
    id: p.id,
    invoiceId: p.invoice_id,
    amount: Number(p.amount),
    paymentMethod: p.payment_method as PaymentMethod,
    paidAt: p.paid_at,
    note: p.note,
    referenceNumber: p.reference_number,
    recordedBy: p.recorded_by,
    createdAt: p.created_at,
  }));

  return {
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    customerId: inv.customer_id,
    subscriptionId: inv.subscription_id,
    billingPeriodStart: inv.billing_period_start,
    billingPeriodEnd: inv.billing_period_end,
    status: inv.status as InvoiceStatus,
    issuedAt: inv.issued_at,
    dueDate: inv.due_date,
    currencyCode: inv.currency_code,
    subtotal: Number(inv.subtotal),
    discountTotal: Number(inv.discount_total),
    taxTotal: Number(inv.tax_total),
    total: Number(inv.total),
    amountPaid: Number(inv.amount_paid),
    balanceDue: Number(inv.balance_due),
    notes: inv.notes,
    createdBy: inv.created_by,
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
    customer: (() => {
      const cust = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
      return cust
        ? {
            id: cust.id,
            customerCode: cust.customer_code,
            legalName: cust.legal_name,
            email: cust.email,
            companyName: cust.company_name,
            phone: cust.phone,
          }
        : undefined;
    })(),
    subscription: inv.subscription
      ? {
          id: inv.subscription.id,
          subscriptionNumber: inv.subscription.subscription_number,
          customerId: inv.customer_id,
          planId: "",
          planNameSnapshot: inv.subscription.plan_name_snapshot,
          status: inv.subscription.status as SubscriptionStatus,
          startDate: inv.subscription.start_date,
          nextBillingDate: inv.subscription.next_billing_date,
          paymentTermsDays: 15,
          planPriceSnapshot: 0,
          planQuantity: 1,
          currencyCode: inv.currency_code,
          autoCloseOnEnd: false,
          allowEarlyClose: true,
          allowPause: false,
          allowRenewal: true,
        }
      : undefined,
    lines,
    payments,
  };
}

/**
 * Fetches historical billing runs for audit and status inspection.
 */
export async function getBillingRuns(options?: { limit?: number }): Promise<BillingRun[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("billing_runs")
    .select("*")
    .order("started_at", { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown as RawBillingRun[]).map((r): BillingRun => ({
    id: r.id,
    triggerSource: r.trigger_source,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    subscriptionsChecked: Number(r.subscriptions_checked || 0),
    invoicesCreated: Number(r.invoices_created || 0),
    invoicesSkipped: Number(r.invoices_skipped || 0),
    errors: Array.isArray(r.errors) ? r.errors : [],
    initiatedBy: r.initiated_by,
  }));
}
