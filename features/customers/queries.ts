import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerAccount } from "@/types";

/**
 * Retrieves the customer record linked to the given user ID.
 * Returns null if no customer mapping exists.
 */
export async function getCustomerForUser(
  userId: string
): Promise<CustomerAccount | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("customer_users")
    .select(
      `customer_id, customers ( id, customer_code, legal_name, company_name, email, phone, currency_code, is_active )`
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || !data.customers) {
    return null;
  }

  const c = Array.isArray(data.customers) ? data.customers[0] : data.customers;

  return {
    id: c.id,
    customerCode: c.customer_code,
    legalName: c.legal_name,
    companyName: c.company_name,
    email: c.email,
    phone: c.phone,
    currencyCode: c.currency_code,
    isActive: c.is_active,
  };
}

/**
 * Retrieves all customers (for staff/admin to select when creating quotations/subscriptions).
 */
export async function getCustomers(): Promise<CustomerAccount[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_code, legal_name, company_name, email, phone, currency_code, is_active")
    .eq("is_active", true)
    .order("legal_name", { ascending: true });

  if (error) {
    console.error("[getCustomers] Database query error:", error.message);
    return [];
  }

  if (!data) {
    return [];
  }

  return data.map((c) => ({
    id: c.id,
    customerCode: c.customer_code,
    legalName: c.legal_name,
    companyName: c.company_name,
    email: c.email,
    phone: c.phone,
    currencyCode: c.currency_code,
    isActive: c.is_active,
  }));
}
