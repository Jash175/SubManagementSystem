"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaffOrAdmin } from "@/features/auth/guards";
import {
  quotationTemplateSchema,
  createQuotationFromTemplateSchema,
  createQuotationDirectSchema,
  type QuotationTemplateInput,
  type CreateQuotationFromTemplateInput,
  type CreateQuotationDirectInput,
} from "./schemas";
import { calculateProductPrice } from "@/features/products/pricing";
import { formatDateUTC } from "@/features/subscriptions/lifecycle";
import type { ActionResult, QuotationTemplate, Subscription } from "@/types";

export async function createQuotationTemplateAction(
  rawData: QuotationTemplateInput
): Promise<ActionResult<QuotationTemplate>> {
  const session = await requireAdmin();
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { success: false, error: "Database client is unavailable." };
  }

  const parsed = quotationTemplateSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { name, planId, validityDays, isActive, lines } = parsed.data;

  // Verify plan exists
  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("id")
    .eq("id", planId)
    .single();

  if (planErr || !plan) {
    return { success: false, error: "Referenced plan does not exist." };
  }

  const { data: template, error: tmplErr } = await supabase
    .from("quotation_templates")
    .insert({
      name,
      plan_id: planId,
      validity_days: validityDays,
      is_active: isActive,
      created_by: session.id,
    })
    .select()
    .single();

  if (tmplErr || !template) {
    return { success: false, error: tmplErr?.message || "Failed to create quotation template." };
  }

  // Insert lines if provided
  if (lines && lines.length > 0) {
    const linesToInsert = lines.map((l) => ({
      template_id: template.id,
      product_id: l.productId,
      variant_id: l.variantId || null,
      description: l.description || null,
      quantity: l.quantity,
      unit_price_override: l.unitPriceOverride ?? null,
    }));

    const { error: linesErr } = await supabase
      .from("quotation_template_lines")
      .insert(linesToInsert);

    if (linesErr) {
      return { success: false, error: `Template created, but line error: ${linesErr.message}` };
    }
  }

  revalidatePath("/quotations");
  return { success: true, data: template as unknown as QuotationTemplate };
}

export async function toggleQuotationTemplateActiveAction(
  id: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  await requireStaffOrAdmin();
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { success: false, error: "Database client is unavailable." };
  }

  const { error } = await supabase
    .from("quotation_templates")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/quotations");
  return { success: true };
}

export async function archiveQuotationTemplateAction(
  id: string
): Promise<ActionResult<void>> {
  return toggleQuotationTemplateActiveAction(id, false);
}

export async function activateQuotationTemplateAction(
  id: string
): Promise<ActionResult<void>> {
  return toggleQuotationTemplateActiveAction(id, true);
}

export async function createQuotationFromTemplateAction(
  rawData: CreateQuotationFromTemplateInput
): Promise<ActionResult<Subscription>> {
  const session = await requireStaffOrAdmin();
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { success: false, error: "Database client is unavailable." };
  }

  const parsed = createQuotationFromTemplateSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { customerId, templateId, startDate, expiryDate, planQuantity, paymentTermsDays, lines: customLines } = parsed.data;

  // Load customer
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, currency_code")
    .eq("id", customerId)
    .single();

  if (custErr || !customer) {
    return { success: false, error: "Selected customer does not exist." };
  }

  // Load template with plan and lines
  const { data: template, error: tmplErr } = await supabase
    .from("quotation_templates")
    .select(`
      id,
      name,
      validity_days,
      plans (
        id,
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
        product_id,
        variant_id,
        description,
        quantity,
        unit_price_override,
        products (
          id,
          name,
          sales_price
        ),
        product_variants (
          id,
          price_delta
        )
      )
    `)
    .eq("id", templateId)
    .single();

  if (tmplErr || !template) {
    return { success: false, error: "Selected quotation template does not exist." };
  }

  const plan = Array.isArray(template.plans) ? template.plans[0] : template.plans;
  if (!plan) {
    return { success: false, error: "Quotation template is missing its associated plan." };
  }

  // Validate plan minimum quantity (T-08)
  if (planQuantity < Number(plan.minimum_quantity)) {
    return {
      success: false,
      error: `Plan quantity (${planQuantity}) cannot be less than minimum required quantity (${plan.minimum_quantity}).`,
    };
  }

  // Validate plan availability dates (T-09)
  if (plan.available_from && startDate < plan.available_from) {
    return {
      success: false,
      error: `Plan is not yet available on ${startDate}. Availability starts on ${plan.available_from}.`,
    };
  }
  if (plan.available_until && startDate > plan.available_until) {
    return {
      success: false,
      error: `Plan is no longer available on ${startDate}. Availability ended on ${plan.available_until}.`,
    };
  }

  // Calculate quotation_valid_until = today + validity_days
  const validityDays = template.validity_days || 30;
  const validUntilDate = new Date(new Date().getTime() + validityDays * 24 * 60 * 60 * 1000);
  const quotationValidUntil = formatDateUTC(validUntilDate);

  // Generate unique human-readable subscription number
  const timestamp = Date.now().toString().slice(-6);
  const subscriptionNumber = `SUB-${new Date().getUTCFullYear()}-${timestamp}`;

  // Insert Subscription (initial status = 'draft')
  const { data: subscription, error: subErr } = await supabase
    .from("subscriptions")
    .insert({
      subscription_number: subscriptionNumber,
      customer_id: customerId,
      plan_id: plan.id,
      plan_name_snapshot: plan.name,
      quotation_template_id: template.id,
      status: "draft",
      start_date: startDate,
      expiry_date: expiryDate || null,
      quotation_valid_until: quotationValidUntil,
      payment_terms_days: paymentTermsDays,
      plan_price_snapshot: Number(plan.price),
      plan_quantity: planQuantity,
      currency_code: plan.currency_code || customer.currency_code || "INR",
      auto_close_on_end: plan.auto_close_on_end ?? false,
      allow_early_close: plan.allow_early_close ?? true,
      allow_pause: plan.allow_pause ?? false,
      allow_renewal: plan.allow_renewal ?? true,
      created_by: session.id,
    })
    .select()
    .single();

  if (subErr || !subscription) {
    return { success: false, error: subErr?.message || "Failed to create subscription record." };
  }

  interface ProcessableLine {
    productId: string;
    variantId?: string | null;
    description?: string | null;
    quantity: number;
    unitPriceOverride?: number | null;
    products?: { name?: string; sales_price?: number } | null;
    product_variants?: { price_delta?: number } | null;
  }

  interface RawTemplateLine {
    product_id: string;
    variant_id: string | null;
    description: string | null;
    quantity: number;
    unit_price_override: number | null;
    products?: { name?: string; sales_price?: number } | null;
    product_variants?: { price_delta?: number } | null;
  }

  // Prepare and insert subscription line snapshots
  const rawTemplateLines = (template.quotation_template_lines || []) as unknown as RawTemplateLine[];

  const linesToProcess: ProcessableLine[] = customLines && customLines.length > 0
    ? customLines
    : rawTemplateLines.map((tl) => ({
        productId: tl.product_id,
        variantId: tl.variant_id,
        description: tl.description,
        quantity: Number(tl.quantity),
        unitPriceOverride: tl.unit_price_override ? Number(tl.unit_price_override) : null,
        products: tl.products,
        product_variants: tl.product_variants,
      }));

  if (linesToProcess.length > 0) {
    const linesToInsert = [];

    for (const item of linesToProcess) {
      // If product details not already attached, query
      let basePrice = 0;
      let productName = "Product Line";
      let priceDelta = 0;

      if (item.products) {
        basePrice = Number(item.products.sales_price || 0);
        productName = item.products.name || "Product Line";
      } else {
        const { data: p } = await supabase
          .from("products")
          .select("name, sales_price")
          .eq("id", item.productId)
          .single();
        if (p) {
          basePrice = Number(p.sales_price || 0);
          productName = p.name;
        }
      }

      if (item.variantId) {
        if (item.product_variants) {
          priceDelta = Number(item.product_variants.price_delta || 0);
        } else {
          const { data: v } = await supabase
            .from("product_variants")
            .select("price_delta")
            .eq("id", item.variantId)
            .single();
          if (v) {
            priceDelta = Number(v.price_delta || 0);
          }
        }
      }

      // Unit price snapshot with variant delta or override
      const unitPrice = item.unitPriceOverride !== null && item.unitPriceOverride !== undefined
        ? Number(item.unitPriceOverride)
        : calculateProductPrice(basePrice, priceDelta);

      const descriptionSnapshot = item.description || productName;

      linesToInsert.push({
        subscription_id: subscription.id,
        product_id: item.productId,
        variant_id: item.variantId || null,
        description_snapshot: descriptionSnapshot,
        quantity: item.quantity,
        unit_price: unitPrice,
      });
    }

    if (linesToInsert.length > 0) {
      await supabase.from("subscription_lines").insert(linesToInsert);
    }
  }

  // Insert initial lifecycle event
  await supabase.from("subscription_events").insert({
    subscription_id: subscription.id,
    from_status: null,
    to_status: "draft",
    action: "create_quotation",
    note: `Created from template '${template.name}'`,
    actor_id: session.id,
  });

  revalidatePath("/quotations");
  revalidatePath("/subscriptions");
  return { success: true, data: subscription as unknown as Subscription };
}

export async function createQuotationDirectAction(
  rawData: CreateQuotationDirectInput
): Promise<ActionResult<Subscription>> {
  const session = await requireStaffOrAdmin();
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { success: false, error: "Database client is unavailable." };
  }

  const parsed = createQuotationDirectSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { customerId, planId, startDate, expiryDate, validityDays, planQuantity, paymentTermsDays, lines } = parsed.data;

  // Load customer
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, currency_code")
    .eq("id", customerId)
    .single();

  if (custErr || !customer) {
    return { success: false, error: "Selected customer does not exist." };
  }

  // Load plan
  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (planErr || !plan) {
    return { success: false, error: "Selected plan does not exist." };
  }

  // Validate plan minimum quantity (T-08)
  if (planQuantity < Number(plan.minimum_quantity)) {
    return {
      success: false,
      error: `Plan quantity (${planQuantity}) cannot be less than minimum required quantity (${plan.minimum_quantity}).`,
    };
  }

  // Validate plan availability dates (T-09)
  if (plan.available_from && startDate < plan.available_from) {
    return {
      success: false,
      error: `Plan is not yet available on ${startDate}. Availability starts on ${plan.available_from}.`,
    };
  }
  if (plan.available_until && startDate > plan.available_until) {
    return {
      success: false,
      error: `Plan is no longer available on ${startDate}. Availability ended on ${plan.available_until}.`,
    };
  }

  const validUntilDate = new Date(new Date().getTime() + validityDays * 24 * 60 * 60 * 1000);
  const quotationValidUntil = formatDateUTC(validUntilDate);

  const timestamp = Date.now().toString().slice(-6);
  const subscriptionNumber = `SUB-${new Date().getUTCFullYear()}-${timestamp}`;

  const { data: subscription, error: subErr } = await supabase
    .from("subscriptions")
    .insert({
      subscription_number: subscriptionNumber,
      customer_id: customerId,
      plan_id: plan.id,
      plan_name_snapshot: plan.name,
      status: "draft",
      start_date: startDate,
      expiry_date: expiryDate || null,
      quotation_valid_until: quotationValidUntil,
      payment_terms_days: paymentTermsDays,
      plan_price_snapshot: Number(plan.price),
      plan_quantity: planQuantity,
      currency_code: plan.currency_code || customer.currency_code || "INR",
      auto_close_on_end: plan.auto_close_on_end ?? false,
      allow_early_close: plan.allow_early_close ?? true,
      allow_pause: plan.allow_pause ?? false,
      allow_renewal: plan.allow_renewal ?? true,
      created_by: session.id,
    })
    .select()
    .single();

  if (subErr || !subscription) {
    return { success: false, error: subErr?.message || "Failed to create subscription record." };
  }

  if (lines && lines.length > 0) {
    const linesToInsert = [];
    for (const item of lines) {
      let basePrice = 0;
      let productName = "Product Line";
      let priceDelta = 0;

      const { data: p } = await supabase
        .from("products")
        .select("name, sales_price")
        .eq("id", item.productId)
        .single();
      if (p) {
        basePrice = Number(p.sales_price || 0);
        productName = p.name;
      }

      if (item.variantId) {
        const { data: v } = await supabase
          .from("product_variants")
          .select("price_delta")
          .eq("id", item.variantId)
          .single();
        if (v) {
          priceDelta = Number(v.price_delta || 0);
        }
      }

      const unitPrice = item.unitPriceOverride !== null && item.unitPriceOverride !== undefined
        ? Number(item.unitPriceOverride)
        : calculateProductPrice(basePrice, priceDelta);

      linesToInsert.push({
        subscription_id: subscription.id,
        product_id: item.productId,
        variant_id: item.variantId || null,
        description_snapshot: item.description || productName,
        quantity: item.quantity,
        unit_price: unitPrice,
      });
    }

    if (linesToInsert.length > 0) {
      await supabase.from("subscription_lines").insert(linesToInsert);
    }
  }

  await supabase.from("subscription_events").insert({
    subscription_id: subscription.id,
    from_status: null,
    to_status: "draft",
    action: "create_quotation",
    note: "Direct quotation created by staff",
    actor_id: session.id,
  });

  revalidatePath("/quotations");
  revalidatePath("/subscriptions");
  return { success: true, data: subscription as unknown as Subscription };
}
