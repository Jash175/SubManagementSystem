import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { QuotationTemplate, ProductType } from "@/types";

interface RawTemplateLineRecord {
  id: string;
  template_id: string;
  product_id: string;
  variant_id: string | null;
  description: string | null;
  quantity: number | string;
  unit_price_override: number | string | null;
  created_at: string;
  products?: {
    id: string;
    product_code: string;
    name: string;
    product_type: ProductType;
    sales_price: number | string;
    cost_price: number | string;
    currency_code: string;
  } | Array<{
    id: string;
    product_code: string;
    name: string;
    product_type: ProductType;
    sales_price: number | string;
    cost_price: number | string;
    currency_code: string;
  }>;
  product_variants?: {
    id: string;
    product_id: string;
    attribute_name: string;
    attribute_value: string;
    price_delta: number | string;
  } | Array<{
    id: string;
    product_id: string;
    attribute_name: string;
    attribute_value: string;
    price_delta: number | string;
  }>;
}

export async function getQuotationTemplates(options: {
  includeArchived?: boolean;
} = {}): Promise<QuotationTemplate[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from("quotation_templates")
      .select(`
        id,
        name,
        plan_id,
        validity_days,
        is_active,
        created_by,
        created_at,
        updated_at,
        plans (
          id,
          plan_code,
          name,
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
          is_active
        ),
        quotation_template_lines (
          id,
          template_id,
          product_id,
          variant_id,
          description,
          quantity,
          unit_price_override,
          created_at,
          products (
            id,
            product_code,
            name,
            product_type,
            sales_price,
            cost_price,
            currency_code
          ),
          product_variants (
            id,
            product_id,
            attribute_name,
            attribute_value,
            price_delta
          )
        )
      `)
      .order("name", { ascending: true });

    if (!options.includeArchived) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      // If table doesn't exist yet in Supabase, return empty array gracefully
      return [];
    }

    return (data || []).map((t) => {
      const planRaw = Array.isArray(t.plans) ? t.plans[0] : t.plans;
      const linesRaw = Array.isArray(t.quotation_template_lines) ? t.quotation_template_lines : [];

      return {
        id: t.id,
        name: t.name,
        planId: t.plan_id,
        validityDays: t.validity_days,
        isActive: t.is_active,
        createdBy: t.created_by,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        plan: planRaw
          ? {
              id: planRaw.id,
              planCode: planRaw.plan_code,
              name: planRaw.name,
              price: Number(planRaw.price),
              currencyCode: planRaw.currency_code,
              billingIntervalUnit: planRaw.billing_interval_unit,
              billingIntervalCount: planRaw.billing_interval_count,
              minimumQuantity: Number(planRaw.minimum_quantity),
              availableFrom: planRaw.available_from,
              availableUntil: planRaw.available_until,
              autoCloseOnEnd: planRaw.auto_close_on_end,
              allowEarlyClose: planRaw.allow_early_close,
              allowPause: planRaw.allow_pause,
              allowRenewal: planRaw.allow_renewal,
              isActive: planRaw.is_active,
            }
          : undefined,
        lines: (linesRaw as unknown as RawTemplateLineRecord[]).map((line) => {
          const productRaw = Array.isArray(line.products) ? line.products[0] : line.products;
          const variantRaw = Array.isArray(line.product_variants) ? line.product_variants[0] : line.product_variants;

          return {
            id: line.id,
            templateId: line.template_id,
            productId: line.product_id,
            variantId: line.variant_id,
            description: line.description,
            quantity: Number(line.quantity),
            unitPriceOverride: line.unit_price_override !== null && line.unit_price_override !== undefined
              ? Number(line.unit_price_override)
              : null,
            createdAt: line.created_at,
            product: productRaw
              ? {
                  id: productRaw.id,
                  productCode: productRaw.product_code,
                  name: productRaw.name,
                  productType: productRaw.product_type,
                  salesPrice: Number(productRaw.sales_price),
                  costPrice: Number(productRaw.cost_price),
                  currencyCode: productRaw.currency_code,
                  isActive: true,
                }
              : undefined,
            variant: variantRaw
              ? {
                  id: variantRaw.id,
                  productId: variantRaw.product_id,
                  attributeName: variantRaw.attribute_name,
                  attributeValue: variantRaw.attribute_value,
                  priceDelta: Number(variantRaw.price_delta),
                  isActive: true,
                }
              : undefined,
          };
        }),
      };
    });
  } catch {
    return [];
  }
}

export async function getQuotationTemplateById(id: string): Promise<QuotationTemplate | null> {
  const templates = await getQuotationTemplates({ includeArchived: true });
  return templates.find((t) => t.id === id) || null;
}
