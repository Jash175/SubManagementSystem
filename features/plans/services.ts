import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Plan, Tax } from "@/types";

interface PlanRow {
  id: string;
  plan_code: string;
  name: string;
  description: string | null;
  price: number | string;
  currency_code: string;
  billing_interval_unit: Plan["billingIntervalUnit"];
  billing_interval_count: number;
  minimum_quantity: number | string;
  available_from: string | null;
  available_until: string | null;
  auto_close_on_end: boolean;
  allow_early_close: boolean;
  allow_pause: boolean;
  allow_renewal: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  plan_taxes?: {
    tax_id: string;
    taxes: {
      id: string;
      tax_code: string;
      name: string;
      rate_percent: number | string;
      is_active: boolean;
    } | null;
  }[];
}

/**
 * Fetches all subscription plans with linked taxes.
 */
export async function getPlans(options?: {
  includeArchived?: boolean;
}): Promise<Plan[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("plans")
    .select(
      `
      id,
      plan_code,
      name,
      description,
      price,
      currency_code,
      billing_interval_unit,
      billing_interval_count,
      minimum_quantity,
      available_from,
      available_until,
      auto_close_on_end,
      allow_early_close,
      allow_pause,
      allow_renewal,
      is_active,
      created_at,
      updated_at,
      plan_taxes (
        tax_id,
        taxes (
          id,
          tax_code,
          name,
          rate_percent,
          is_active
        )
      )
    `
    )
    .order("created_at", { ascending: false });

  if (!options?.includeArchived) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown as PlanRow[]).map((row): Plan => {
    const taxes: Tax[] = (row.plan_taxes || [])
      .map((pt) => pt.taxes)
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => ({
        id: t.id,
        taxCode: t.tax_code,
        name: t.name,
        ratePercent: Number(t.rate_percent),
        isActive: t.is_active,
      }));

    return {
      id: row.id,
      planCode: row.plan_code,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      currencyCode: row.currency_code,
      billingIntervalUnit: row.billing_interval_unit,
      billingIntervalCount: row.billing_interval_count,
      minimumQuantity: Number(row.minimum_quantity),
      availableFrom: row.available_from,
      availableUntil: row.available_until,
      autoCloseOnEnd: row.auto_close_on_end,
      allowEarlyClose: row.allow_early_close,
      allowPause: row.allow_pause,
      allowRenewal: row.allow_renewal,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      taxes,
    };
  });
}

/**
 * Fetches a single plan by ID with linked taxes.
 */
export async function getPlanById(id: string): Promise<Plan | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("plans")
    .select(
      `
      id,
      plan_code,
      name,
      description,
      price,
      currency_code,
      billing_interval_unit,
      billing_interval_count,
      minimum_quantity,
      available_from,
      available_until,
      auto_close_on_end,
      allow_early_close,
      allow_pause,
      allow_renewal,
      is_active,
      created_at,
      updated_at,
      plan_taxes (
        tax_id,
        taxes (
          id,
          tax_code,
          name,
          rate_percent,
          is_active
        )
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const row = data as unknown as PlanRow;
  const taxes: Tax[] = (row.plan_taxes || [])
    .map((pt) => pt.taxes)
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((t) => ({
      id: t.id,
      taxCode: t.tax_code,
      name: t.name,
      ratePercent: Number(t.rate_percent),
      isActive: t.is_active,
    }));

  return {
    id: row.id,
    planCode: row.plan_code,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    currencyCode: row.currency_code,
    billingIntervalUnit: row.billing_interval_unit,
    billingIntervalCount: row.billing_interval_count,
    minimumQuantity: Number(row.minimum_quantity),
    availableFrom: row.available_from,
    availableUntil: row.available_until,
    autoCloseOnEnd: row.auto_close_on_end,
    allowEarlyClose: row.allow_early_close,
    allowPause: row.allow_pause,
    allowRenewal: row.allow_renewal,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    taxes,
  };
}
