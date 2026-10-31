import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Tax } from "@/types";

interface TaxRow {
  id: string;
  tax_code: string;
  name: string;
  rate_percent: number | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches all tax rules from the database.
 */
export async function getTaxes(options?: {
  includeArchived?: boolean;
}): Promise<Tax[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("taxes")
    .select("id, tax_code, name, rate_percent, is_active, created_at, updated_at")
    .order("rate_percent", { ascending: true });

  if (!options?.includeArchived) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown as TaxRow[]).map((row): Tax => ({
    id: row.id,
    taxCode: row.tax_code,
    name: row.name,
    ratePercent: Number(row.rate_percent),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Fetches a single tax rule by ID.
 */
export async function getTaxById(id: string): Promise<Tax | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("taxes")
    .select("id, tax_code, name, rate_percent, is_active, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const row = data as unknown as TaxRow;
  return {
    id: row.id,
    taxCode: row.tax_code,
    name: row.name,
    ratePercent: Number(row.rate_percent),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
