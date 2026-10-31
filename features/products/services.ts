import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Product, ProductVariant, Tax } from "@/types";

interface ProductRow {
  id: string;
  product_code: string;
  name: string;
  product_type: Product["productType"];
  sales_price: number | string;
  cost_price: number | string;
  currency_code: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_variants?: {
    id: string;
    product_id: string;
    attribute_name: string;
    attribute_value: string;
    price_delta: number | string;
    is_active: boolean;
    created_at: string;
  }[];
  product_taxes?: {
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
 * Fetches all products with variants and linked taxes.
 */
export async function getProducts(options?: {
  includeArchived?: boolean;
}): Promise<Product[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("products")
    .select(
      `
      id,
      product_code,
      name,
      product_type,
      sales_price,
      cost_price,
      currency_code,
      notes,
      is_active,
      created_at,
      updated_at,
      product_variants (
        id,
        product_id,
        attribute_name,
        attribute_value,
        price_delta,
        is_active,
        created_at
      ),
      product_taxes (
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

  if (error || !data) {
    return [];
  }

  return (data as unknown as ProductRow[]).map((row): Product => {
    const variants: ProductVariant[] = (row.product_variants || []).map((v) => ({
      id: v.id,
      productId: v.product_id,
      attributeName: v.attribute_name,
      attributeValue: v.attribute_value,
      priceDelta: Number(v.price_delta),
      isActive: v.is_active,
      createdAt: v.created_at,
    }));

    const taxes: Tax[] = (row.product_taxes || [])
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
      productCode: row.product_code,
      name: row.name,
      productType: row.product_type,
      salesPrice: Number(row.sales_price),
      costPrice: Number(row.cost_price),
      currencyCode: row.currency_code,
      notes: row.notes,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      variants,
      taxes,
    };
  });
}

/**
 * Fetches a single product by ID with variants and linked taxes.
 */
export async function getProductById(id: string): Promise<Product | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      product_code,
      name,
      product_type,
      sales_price,
      cost_price,
      currency_code,
      notes,
      is_active,
      created_at,
      updated_at,
      product_variants (
        id,
        product_id,
        attribute_name,
        attribute_value,
        price_delta,
        is_active,
        created_at
      ),
      product_taxes (
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

  const row = data as unknown as ProductRow;
  const variants: ProductVariant[] = (row.product_variants || []).map((v) => ({
    id: v.id,
    productId: v.product_id,
    attributeName: v.attribute_name,
    attributeValue: v.attribute_value,
    priceDelta: Number(v.price_delta),
    isActive: v.is_active,
    createdAt: v.created_at,
  }));

  const taxes: Tax[] = (row.product_taxes || [])
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
    productCode: row.product_code,
    name: row.name,
    productType: row.product_type,
    salesPrice: Number(row.sales_price),
    costPrice: Number(row.cost_price),
    currencyCode: row.currency_code,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variants,
    taxes,
  };
}
