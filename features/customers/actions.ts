"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffOrAdmin } from "@/features/auth/guards";
import type { ActionResult, CustomerAccount } from "@/types";

import { createCustomerSchema, type CreateCustomerInput } from "./schemas";
export { createCustomerSchema, type CreateCustomerInput };

export async function createCustomerAction(
  input: CreateCustomerInput
): Promise<ActionResult<CustomerAccount>> {
  await requireStaffOrAdmin();
  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid customer data",
    };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { success: false, error: "Database client unavailable." };
  }

  const customerCode =
    "CUST-" + Math.random().toString(36).substring(2, 10).toUpperCase();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      customer_code: customerCode,
      legal_name: parsed.data.legalName,
      company_name: parsed.data.companyName || null,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      currency_code: parsed.data.currencyCode,
      is_active: true,
    })
    .select("id, customer_code, legal_name, company_name, email, phone, currency_code, is_active")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message || "Failed to create customer account",
    };
  }

  revalidatePath("/quotations");
  revalidatePath("/customers");

  return {
    success: true,
    data: {
      id: data.id,
      customerCode: data.customer_code,
      legalName: data.legal_name,
      companyName: data.company_name,
      email: data.email,
      phone: data.phone,
      currencyCode: data.currency_code,
      isActive: data.is_active,
    },
  };
}
