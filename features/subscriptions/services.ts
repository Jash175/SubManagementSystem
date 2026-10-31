import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Subscription, SubscriptionStatus, ProductType } from "@/types";

interface RawSubLineProduct {
  id: string;
  product_code: string;
  name: string;
}

interface RawSubLineVariant {
  id: string;
  product_id?: string;
  attribute_name: string;
  attribute_value: string;
  price_delta: number | string;
}

interface RawSubLineRecord {
  id: string;
  subscription_id: string;
  product_id: string;
  variant_id: string | null;
  description_snapshot: string;
  quantity: number | string;
  unit_price: number | string;
  line_subtotal: number | string;
  products?: RawSubLineProduct | RawSubLineProduct[] | null;
  product_variants?: RawSubLineVariant | RawSubLineVariant[] | null;
}

interface RawSubEventActor {
  full_name?: string | null;
}

interface RawSubEventRecord {
  id: string;
  subscription_id: string;
  from_status: SubscriptionStatus | null;
  to_status: SubscriptionStatus;
  action: string;
  note: string | null;
  actor_id: string | null;
  created_at: string;
  profiles?: RawSubEventActor | RawSubEventActor[] | null;
}

export interface SubscriptionFilterOptions {
  customerId?: string;
  status?: SubscriptionStatus | "all";
  search?: string;
}

export async function getSubscriptions(
  options: SubscriptionFilterOptions = {}
): Promise<Subscription[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from("subscriptions")
      .select(`
        id,
        subscription_number,
        customer_id,
        plan_id,
        plan_name_snapshot,
        quotation_template_id,
        renewed_from_subscription_id,
        status,
        start_date,
        expiry_date,
        quotation_valid_until,
        payment_terms_days,
        plan_price_snapshot,
        plan_quantity,
        currency_code,
        next_billing_date,
        billing_anchor_day,
        billing_anchor_month,
        paused_at,
        closed_at,
        closure_reason,
        confirmed_at,
        activated_at,
        auto_close_on_end,
        allow_early_close,
        allow_pause,
        allow_renewal,
        created_by,
        created_at,
        updated_at,
        customers (
          id,
          customer_code,
          legal_name,
          company_name,
          email,
          phone
        ),
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
          available_until
        ),
        subscription_lines (
          id,
          subscription_id,
          product_id,
          variant_id,
          description_snapshot,
          quantity,
          unit_price,
          line_subtotal,
          products (
            id,
            product_code,
            name
          ),
          product_variants (
            id,
            attribute_name,
            attribute_value,
            price_delta
          )
        )
      `)
      .order("created_at", { ascending: false });

    // Strict customer isolation if customerId filter is provided
    if (options.customerId) {
      query = query.eq("customer_id", options.customerId);
    }

    if (options.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    const mapped: Subscription[] = data.map((s) => {
      const customerRaw = Array.isArray(s.customers) ? s.customers[0] : s.customers;
      const planRaw = Array.isArray(s.plans) ? s.plans[0] : s.plans;
      const linesRaw = Array.isArray(s.subscription_lines) ? s.subscription_lines : [];

      return {
        id: s.id,
        subscriptionNumber: s.subscription_number,
        customerId: s.customer_id,
        planId: s.plan_id,
        planNameSnapshot: s.plan_name_snapshot,
        quotationTemplateId: s.quotation_template_id,
        renewedFromSubscriptionId: s.renewed_from_subscription_id,
        status: s.status as SubscriptionStatus,
        startDate: s.start_date,
        expiryDate: s.expiry_date,
        quotationValidUntil: s.quotation_valid_until,
        paymentTermsDays: s.payment_terms_days,
        planPriceSnapshot: Number(s.plan_price_snapshot),
        planQuantity: Number(s.plan_quantity),
        currencyCode: s.currency_code,
        nextBillingDate: s.next_billing_date,
        billingAnchorDay: s.billing_anchor_day,
        billingAnchorMonth: s.billing_anchor_month,
        pausedAt: s.paused_at,
        closedAt: s.closed_at,
        closureReason: s.closure_reason,
        confirmedAt: s.confirmed_at,
        activatedAt: s.activated_at,
        autoCloseOnEnd: s.auto_close_on_end,
        allowEarlyClose: s.allow_early_close,
        allowPause: s.allow_pause,
        allowRenewal: s.allow_renewal,
        createdBy: s.created_by,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        customer: customerRaw
          ? {
              id: customerRaw.id,
              customerCode: customerRaw.customer_code,
              legalName: customerRaw.legal_name,
              companyName: customerRaw.company_name,
              email: customerRaw.email,
              phone: customerRaw.phone,
            }
          : undefined,
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
              autoCloseOnEnd: s.auto_close_on_end,
              allowEarlyClose: s.allow_early_close,
              allowPause: s.allow_pause,
              allowRenewal: s.allow_renewal,
              isActive: true,
            }
          : undefined,
        lines: linesRaw.map((line: RawSubLineRecord) => {
          const prodRaw = Array.isArray(line.products) ? line.products[0] : line.products;
          const varRaw = Array.isArray(line.product_variants) ? line.product_variants[0] : line.product_variants;

          return {
            id: line.id,
            subscriptionId: line.subscription_id,
            productId: line.product_id,
            variantId: line.variant_id,
            descriptionSnapshot: line.description_snapshot,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unit_price),
            lineSubtotal: Number(line.line_subtotal),
            product: prodRaw
              ? {
                  id: prodRaw.id,
                  productCode: prodRaw.product_code,
                  name: prodRaw.name,
                  productType: "software" as ProductType,
                  salesPrice: Number(line.unit_price),
                  costPrice: 0,
                  currencyCode: s.currency_code,
                  isActive: true,
                }
              : undefined,
            variant: varRaw
              ? {
                  id: varRaw.id,
                  productId: varRaw.product_id || line.product_id,
                  attributeName: varRaw.attribute_name,
                  attributeValue: varRaw.attribute_value,
                  priceDelta: Number(varRaw.price_delta),
                  isActive: true,
                }
              : undefined,
          };
        }),
      };
    });

    if (options.search) {
      const q = options.search.toLowerCase();
      return mapped.filter(
        (sub) =>
          sub.subscriptionNumber.toLowerCase().includes(q) ||
          sub.planNameSnapshot.toLowerCase().includes(q) ||
          sub.customer?.legalName.toLowerCase().includes(q) ||
          sub.customer?.customerCode.toLowerCase().includes(q)
      );
    }

    return mapped;
  } catch {
    return [];
  }
}

export async function getSubscriptionById(
  id: string,
  customerId?: string
): Promise<Subscription | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  try {
    let query = supabase
      .from("subscriptions")
      .select(`
        id,
        subscription_number,
        customer_id,
        plan_id,
        plan_name_snapshot,
        quotation_template_id,
        renewed_from_subscription_id,
        status,
        start_date,
        expiry_date,
        quotation_valid_until,
        payment_terms_days,
        plan_price_snapshot,
        plan_quantity,
        currency_code,
        next_billing_date,
        billing_anchor_day,
        billing_anchor_month,
        paused_at,
        closed_at,
        closure_reason,
        confirmed_at,
        activated_at,
        auto_close_on_end,
        allow_early_close,
        allow_pause,
        allow_renewal,
        created_by,
        created_at,
        updated_at,
        customers (
          id,
          customer_code,
          legal_name,
          company_name,
          email,
          phone
        ),
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
          available_until
        ),
        subscription_lines (
          id,
          subscription_id,
          product_id,
          variant_id,
          description_snapshot,
          quantity,
          unit_price,
          line_subtotal,
          products (
            id,
            product_code,
            name
          ),
          product_variants (
            id,
            attribute_name,
            attribute_value,
            price_delta
          )
        ),
        subscription_events (
          id,
          subscription_id,
          from_status,
          to_status,
          action,
          note,
          actor_id,
          created_at,
          profiles (
            full_name
          )
        )
      `)
      .eq("id", id);

    // Strict customer isolation check
    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      return null;
    }

    const customerRaw = Array.isArray(data.customers) ? data.customers[0] : data.customers;
    const planRaw = Array.isArray(data.plans) ? data.plans[0] : data.plans;
    const linesRaw = Array.isArray(data.subscription_lines) ? data.subscription_lines : [];
    const eventsRaw = Array.isArray(data.subscription_events) ? data.subscription_events : [];

    // Sort events by date descending
    eventsRaw.sort(
      (a: RawSubEventRecord, b: RawSubEventRecord) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return {
      id: data.id,
      subscriptionNumber: data.subscription_number,
      customerId: data.customer_id,
      planId: data.plan_id,
      planNameSnapshot: data.plan_name_snapshot,
      quotationTemplateId: data.quotation_template_id,
      renewedFromSubscriptionId: data.renewed_from_subscription_id,
      status: data.status as SubscriptionStatus,
      startDate: data.start_date,
      expiryDate: data.expiry_date,
      quotationValidUntil: data.quotation_valid_until,
      paymentTermsDays: data.payment_terms_days,
      planPriceSnapshot: Number(data.plan_price_snapshot),
      planQuantity: Number(data.plan_quantity),
      currencyCode: data.currency_code,
      nextBillingDate: data.next_billing_date,
      billingAnchorDay: data.billing_anchor_day,
      billingAnchorMonth: data.billing_anchor_month,
      pausedAt: data.paused_at,
      closedAt: data.closed_at,
      closureReason: data.closure_reason,
      confirmedAt: data.confirmed_at,
      activatedAt: data.activated_at,
      autoCloseOnEnd: data.auto_close_on_end,
      allowEarlyClose: data.allow_early_close,
      allowPause: data.allow_pause,
      allowRenewal: data.allow_renewal,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      customer: customerRaw
        ? {
            id: customerRaw.id,
            customerCode: customerRaw.customer_code,
            legalName: customerRaw.legal_name,
            companyName: customerRaw.company_name,
            email: customerRaw.email,
            phone: customerRaw.phone,
          }
        : undefined,
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
            autoCloseOnEnd: data.auto_close_on_end,
            allowEarlyClose: data.allow_early_close,
            allowPause: data.allow_pause,
            allowRenewal: data.allow_renewal,
            isActive: true,
          }
        : undefined,
      lines: linesRaw.map((line: RawSubLineRecord) => {
        const prodRaw = Array.isArray(line.products) ? line.products[0] : line.products;
        const varRaw = Array.isArray(line.product_variants) ? line.product_variants[0] : line.product_variants;

        return {
          id: line.id,
          subscriptionId: line.subscription_id,
          productId: line.product_id,
          variantId: line.variant_id,
          descriptionSnapshot: line.description_snapshot,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unit_price),
          lineSubtotal: Number(line.line_subtotal),
          product: prodRaw
            ? {
                id: prodRaw.id,
                productCode: prodRaw.product_code,
                name: prodRaw.name,
                productType: "software" as ProductType,
                salesPrice: Number(line.unit_price),
                costPrice: 0,
                currencyCode: data.currency_code,
                isActive: true,
              }
            : undefined,
          variant: varRaw
            ? {
                id: varRaw.id,
                productId: varRaw.product_id || line.product_id,
                attributeName: varRaw.attribute_name,
                attributeValue: varRaw.attribute_value,
                priceDelta: Number(varRaw.price_delta),
                isActive: true,
              }
            : undefined,
        };
      }),
      events: eventsRaw.map((event: RawSubEventRecord) => {
        const profileRaw = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles;
        return {
          id: event.id,
          subscriptionId: event.subscription_id,
          fromStatus: event.from_status,
          toStatus: event.to_status,
          action: event.action,
          note: event.note,
          actorId: event.actor_id,
          actorName: profileRaw?.full_name || null,
          createdAt: event.created_at,
        };
      }),
    };
  } catch {
    return null;
  }
}
