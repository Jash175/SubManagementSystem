import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Discount } from "@/types";

interface DiscountRow {
  id: string;
  discount_code: string;
  name: string;
  scope: Discount["scope"];
  discount_type: Discount["discountType"];
  value: number | string;
  currency_code: string;
  minimum_purchase_amount: number | string;
  minimum_quantity: number | string;
  starts_on: string;
  ends_on: string;
  max_uses: number | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  discount_products?: {
    product_id: string;
    products?: {
      id: string;
      name: string;
      product_code: string;
    } | null;
  }[];
}

/**
 * Fetches all discount rules with linked eligible products.
 */
export async function getDiscounts(options?: {
  includeArchived?: boolean;
}): Promise<Discount[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("discounts")
    .select(
      `
      id,
      discount_code,
      name,
      scope,
      discount_type,
      value,
      currency_code,
      minimum_purchase_amount,
      minimum_quantity,
      starts_on,
      ends_on,
      max_uses,
      priority,
      is_active,
      created_at,
      updated_at,
      discount_products (
        product_id,
        products (
          id,
          name,
          product_code
        )
      )
    `
    )
    .order("priority", { ascending: true });

  if (!options?.includeArchived) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown as DiscountRow[]).map((row): Discount => {
    const productIds: string[] = (row.discount_products || []).map(
      (dp) => dp.product_id
    );
    const products = (row.discount_products || [])
      .map((dp) => dp.products)
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({
        id: p.id,
        name: p.name,
        productCode: p.product_code,
      }));

    return {
      id: row.id,
      discountCode: row.discount_code,
      name: row.name,
      scope: row.scope,
      discountType: row.discount_type,
      value: Number(row.value),
      currencyCode: row.currency_code,
      minimumPurchaseAmount: Number(row.minimum_purchase_amount),
      minimumQuantity: Number(row.minimum_quantity),
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      maxUses: row.max_uses,
      priority: row.priority,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      productIds,
      products,
    };
  });
}

/**
 * Fetches a single discount rule by ID.
 */
export async function getDiscountById(id: string): Promise<Discount | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("discounts")
    .select(
      `
      id,
      discount_code,
      name,
      scope,
      discount_type,
      value,
      currency_code,
      minimum_purchase_amount,
      minimum_quantity,
      starts_on,
      ends_on,
      max_uses,
      priority,
      is_active,
      created_at,
      updated_at,
      discount_products (
        product_id,
        products (
          id,
          name,
          product_code
        )
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const row = data as unknown as DiscountRow;
  const productIds = (row.discount_products || []).map((dp) => dp.product_id);
  const products = (row.discount_products || [])
    .map((dp) => dp.products)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      id: p.id,
      name: p.name,
      productCode: p.product_code,
    }));

  return {
    id: row.id,
    discountCode: row.discount_code,
    name: row.name,
    scope: row.scope,
    discountType: row.discount_type,
    value: Number(row.value),
    currencyCode: row.currency_code,
    minimumPurchaseAmount: Number(row.minimum_purchase_amount),
    minimumQuantity: Number(row.minimum_quantity),
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    maxUses: row.max_uses,
    priority: row.priority,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    productIds,
    products,
  };
}
