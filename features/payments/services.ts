import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Payment, PaymentMethod, InvoiceStatus } from "@/types";

interface PaymentQueryOptions {
  customerId?: string;
  invoiceId?: string;
  limit?: number;
}

interface RawPaymentInvoiceCustomer {
  id: string;
  customer_code: string;
  legal_name: string;
  email: string;
}

interface RawPaymentInvoice {
  id: string;
  invoice_number: string;
  total: number | string;
  balance_due: number | string;
  status: string;
  customer_id?: string;
  customer?: RawPaymentInvoiceCustomer | RawPaymentInvoiceCustomer[] | null;
}

interface RawPaymentRow {
  id: string;
  invoice_id: string;
  amount: number | string;
  payment_method: string;
  paid_at: string;
  note?: string | null;
  reference_number?: string | null;
  recorded_by?: string | null;
  created_at: string;
  invoice?: RawPaymentInvoice | RawPaymentInvoice[] | null;
}

/**
 * Fetches recorded payments with invoice and customer context.
 */
export async function getPayments(options?: PaymentQueryOptions): Promise<Payment[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
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
      created_at,
      invoice:invoices (
        id,
        invoice_number,
        total,
        balance_due,
        status,
        customer_id,
        customer:customers (
          id,
          customer_code,
          legal_name,
          email
        )
      )
    `)
    .order("paid_at", { ascending: false });

  if (options?.invoiceId) {
    query = query.eq("invoice_id", options.invoiceId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const rawRows = data as unknown as RawPaymentRow[];

  // If customerId is requested, filter in memory or via customer_id if present
  let filtered = rawRows;
  if (options?.customerId) {
    filtered = rawRows.filter((p) => {
      const inv = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice;
      return inv && inv.customer_id === options.customerId;
    });
  }

  return filtered.map((p): Payment => ({
    id: p.id,
    invoiceId: p.invoice_id,
    amount: Number(p.amount),
    paymentMethod: p.payment_method as PaymentMethod,
    paidAt: p.paid_at,
    note: p.note,
    referenceNumber: p.reference_number,
    recordedBy: p.recorded_by,
    createdAt: p.created_at,
    invoice: (() => {
      const inv = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice;
      if (!inv) return undefined;
      const cust = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        total: Number(inv.total),
        balanceDue: Number(inv.balance_due),
        status: inv.status as InvoiceStatus,
        customer: cust
          ? {
              id: cust.id,
              customerCode: cust.customer_code,
              legalName: cust.legal_name,
              email: cust.email,
            }
          : undefined,
      };
    })(),
  }));
}

/**
 * Fetches a single payment record by ID.
 */
export async function getPaymentById(id: string): Promise<Payment | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
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
      created_at,
      invoice:invoices (
        id,
        invoice_number,
        total,
        balance_due,
        status,
        customer:customers (
          id,
          customer_code,
          legal_name,
          email
        )
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as RawPaymentRow;

  return {
    id: row.id,
    invoiceId: row.invoice_id,
    amount: Number(row.amount),
    paymentMethod: row.payment_method as PaymentMethod,
    paidAt: row.paid_at,
    note: row.note,
    referenceNumber: row.reference_number,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
    invoice: (() => {
      const inv = Array.isArray(row.invoice) ? row.invoice[0] : row.invoice;
      if (!inv) return undefined;
      const cust = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        total: Number(inv.total),
        balanceDue: Number(inv.balance_due),
        status: inv.status as InvoiceStatus,
        customer: cust
          ? {
              id: cust.id,
              customerCode: cust.customer_code,
              legalName: cust.legal_name,
              email: cust.email,
            }
          : undefined,
      };
    })(),
  };
}
