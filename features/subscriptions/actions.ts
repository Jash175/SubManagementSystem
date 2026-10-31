"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserSession, requireStaffOrAdmin } from "@/features/auth/guards";
import {
  calculateNextBillingDate,
  calculateResumeBillingDate,
  validateQuotationConfirmation,
  validateEarlyClose,
  validatePause,
  validateResume,
  validateRenewal,
  formatDateUTC,
} from "./lifecycle";
import type { ActionResult, Subscription, SubscriptionStatus } from "@/types";

/**
 * Helper to load subscription and verify caller authorization (Staff/Admin or linked Customer).
 */
async function loadSubscriptionWithAuthCheck(subscriptionId: string) {
  const session = await getCurrentUserSession();
  if (!session) {
    return { error: "You must be signed in to perform this action.", subscription: null, session: null };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { error: "Database client is unavailable.", subscription: null, session: null };
  }

  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select(`
      *,
      plans (
        billing_interval_unit,
        billing_interval_count,
        minimum_quantity,
        available_from,
        available_until
      )
    `)
    .eq("id", subscriptionId)
    .single();

  if (subErr || !sub) {
    return { error: "Subscription record not found.", subscription: null, session: null };
  }

  // If customer, verify ownership
  if (session.role === "customer") {
    if (!session.customer || session.customer.id !== sub.customer_id) {
      return { error: "You do not have permission to access or modify this subscription.", subscription: null, session: null };
    }
  }

  return { error: null, subscription: sub, session, supabase };
}

/**
 * Send quotation offer to customer (draft -> quotation).
 */
export async function sendQuotationAction(
  subscriptionId: string
): Promise<ActionResult<void>> {
  await requireStaffOrAdmin();
  const { error, subscription, session, supabase } = await loadSubscriptionWithAuthCheck(subscriptionId);
  if (error || !subscription || !supabase || !session) {
    return { success: false, error: error || "Failed to load subscription." };
  }

  if (subscription.status !== "draft") {
    return {
      success: false,
      error: `Only draft subscriptions can be marked as quotation sent. Current status is '${subscription.status}'.`,
    };
  }

  // Ensure valid_until is set
  let validUntil = subscription.quotation_valid_until;
  if (!validUntil) {
    const validUntilDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    validUntil = formatDateUTC(validUntilDate);
  }

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({
      status: "quotation",
      quotation_valid_until: validUntil,
    })
    .eq("id", subscriptionId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await supabase.from("subscription_events").insert({
    subscription_id: subscriptionId,
    from_status: "draft",
    to_status: "quotation",
    action: "send_quotation",
    note: `Quotation sent. Valid until ${validUntil}`,
    actor_id: session.id,
  });

  revalidatePath("/quotations");
  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${subscriptionId}`);
  return { success: true };
}

/**
 * Confirm quotation (quotation -> confirmed).
 * Enforces T-10: quotation must not be expired.
 */
export async function confirmSubscriptionAction(
  subscriptionId: string
): Promise<ActionResult<void>> {
  await requireStaffOrAdmin();
  const { error, subscription, session, supabase } = await loadSubscriptionWithAuthCheck(subscriptionId);
  if (error || !subscription || !supabase || !session) {
    return { success: false, error: error || "Failed to load subscription." };
  }

  const today = formatDateUTC(new Date());

  // Validate quotation validity date (T-10)
  const validation = validateQuotationConfirmation(
    {
      status: subscription.status,
      quotationValidUntil: subscription.quotation_valid_until,
    },
    today
  );

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const plan = Array.isArray(subscription.plans) ? subscription.plans[0] : subscription.plans;
  if (plan) {
    // Validate minimum quantity (T-08)
    if (Number(subscription.plan_quantity) < Number(plan.minimum_quantity)) {
      return {
        success: false,
        error: `Plan quantity (${subscription.plan_quantity}) is below minimum quantity (${plan.minimum_quantity}).`,
      };
    }

    // Validate availability on start date (T-09)
    if (plan.available_from && subscription.start_date < plan.available_from) {
      return {
        success: false,
        error: `Plan is not yet available on start date (${subscription.start_date}).`,
      };
    }
    if (plan.available_until && subscription.start_date > plan.available_until) {
      return {
        success: false,
        error: `Plan is no longer available on start date (${subscription.start_date}).`,
      };
    }
  }

  const now = new Date().toISOString();

  // If start_date <= today, can automatically activate or stay confirmed
  const shouldAutoActivate = subscription.start_date <= today;

  let nextBillingDate: string | null = null;
  if (shouldAutoActivate && plan) {
    const anchorDay = subscription.billing_anchor_day || new Date(subscription.start_date).getUTCDate();
    const anchorMonth = subscription.billing_anchor_month || (new Date(subscription.start_date).getUTCMonth() + 1);

    nextBillingDate = calculateNextBillingDate(
      subscription.start_date,
      plan.billing_interval_unit,
      plan.billing_interval_count,
      anchorDay,
      anchorMonth
    );
  }

  const newStatus: SubscriptionStatus = shouldAutoActivate ? "active" : "confirmed";

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({
      status: newStatus,
      confirmed_at: now,
      activated_at: shouldAutoActivate ? now : null,
      next_billing_date: nextBillingDate,
    })
    .eq("id", subscriptionId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await supabase.from("subscription_events").insert({
    subscription_id: subscriptionId,
    from_status: subscription.status,
    to_status: newStatus,
    action: "confirm",
    note: shouldAutoActivate
      ? `Confirmed and activated. Next billing date: ${nextBillingDate}`
      : "Quotation accepted and confirmed. Pending activation on start date.",
    actor_id: session.id,
  });

  revalidatePath("/quotations");
  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${subscriptionId}`);
  return { success: true };
}

/**
 * Customer / Subscriber acceptance of a quotation offer.
 * Allows the customer who owns the quotation (or staff/admin) to confirm and accept it.
 * Enforces T-10: quotation must not be expired.
 */
export async function acceptQuotationAction(
  subscriptionId: string
): Promise<ActionResult<void>> {
  const { error, subscription, session, supabase } = await loadSubscriptionWithAuthCheck(subscriptionId);
  if (error || !subscription || !supabase || !session) {
    return { success: false, error: error || "Failed to load subscription." };
  }

  // If customer, verify ownership
  if (session.role === "customer") {
    if (!session.customer || session.customer.id !== subscription.customer_id) {
      return { success: false, error: "You do not have permission to accept this quotation." };
    }
  }

  if (subscription.status !== "quotation" && subscription.status !== "draft") {
    return {
      success: false,
      error: `Only quotations can be accepted. Current status is '${subscription.status}'.`,
    };
  }

  const today = formatDateUTC(new Date());

  // Validate quotation validity date (T-10)
  const validation = validateQuotationConfirmation(
    {
      status: subscription.status,
      quotationValidUntil: subscription.quotation_valid_until,
    },
    today
  );

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const plan = Array.isArray(subscription.plans) ? subscription.plans[0] : subscription.plans;
  if (plan) {
    if (Number(subscription.plan_quantity) < Number(plan.minimum_quantity)) {
      return {
        success: false,
        error: `Plan quantity (${subscription.plan_quantity}) is below minimum quantity (${plan.minimum_quantity}).`,
      };
    }
    if (plan.available_from && subscription.start_date < plan.available_from) {
      return {
        success: false,
        error: `Plan is not yet available on start date (${subscription.start_date}).`,
      };
    }
    if (plan.available_until && subscription.start_date > plan.available_until) {
      return {
        success: false,
        error: `Plan is no longer available on start date (${subscription.start_date}).`,
      };
    }
  }

  const now = new Date().toISOString();
  const shouldAutoActivate = subscription.start_date <= today;

  let nextBillingDate: string | null = null;
  if (shouldAutoActivate && plan) {
    const anchorDay = subscription.billing_anchor_day || new Date(subscription.start_date).getUTCDate();
    const anchorMonth = subscription.billing_anchor_month || (new Date(subscription.start_date).getUTCMonth() + 1);

    nextBillingDate = calculateNextBillingDate(
      subscription.start_date,
      plan.billing_interval_unit,
      plan.billing_interval_count,
      anchorDay,
      anchorMonth
    );
  }

  const newStatus: SubscriptionStatus = shouldAutoActivate ? "active" : "confirmed";

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({
      status: newStatus,
      confirmed_at: now,
      activated_at: shouldAutoActivate ? now : null,
      next_billing_date: nextBillingDate,
    })
    .eq("id", subscriptionId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await supabase.from("subscription_events").insert({
    subscription_id: subscriptionId,
    from_status: subscription.status,
    to_status: newStatus,
    action: "confirm",
    note: session.role === "customer"
      ? `Quotation accepted by customer ${session.fullName || session.email}. ${shouldAutoActivate ? `Activated. Next billing date: ${nextBillingDate}` : "Pending activation on start date."}`
      : `Quotation confirmed by staff. ${shouldAutoActivate ? `Activated. Next billing date: ${nextBillingDate}` : "Pending activation on start date."}`,
    actor_id: session.id,
  });

  revalidatePath("/portal");
  revalidatePath("/portal/quotations");
  revalidatePath(`/portal/quotations/${subscriptionId}`);
  revalidatePath("/portal/subscriptions");
  revalidatePath("/quotations");
  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${subscriptionId}`);
  return { success: true };
}

/**
 * Activate a confirmed subscription once its start date has arrived.
 */
export async function activateSubscriptionAction(
  subscriptionId: string
): Promise<ActionResult<void>> {
  await requireStaffOrAdmin();
  const { error, subscription, session, supabase } = await loadSubscriptionWithAuthCheck(subscriptionId);
  if (error || !subscription || !supabase || !session) {
    return { success: false, error: error || "Failed to load subscription." };
  }

  if (subscription.status !== "confirmed") {
    return {
      success: false,
      error: `Only confirmed subscriptions can be activated. Current status is '${subscription.status}'.`,
    };
  }

  const today = formatDateUTC(new Date());
  if (subscription.start_date > today) {
    return {
      success: false,
      error: `Cannot activate prior to start date (${subscription.start_date}).`,
    };
  }

  const plan = Array.isArray(subscription.plans) ? subscription.plans[0] : subscription.plans;
  if (!plan) {
    return { success: false, error: "Associated plan not found." };
  }

  const anchorDay = subscription.billing_anchor_day || new Date(subscription.start_date).getUTCDate();
  const anchorMonth = subscription.billing_anchor_month || (new Date(subscription.start_date).getUTCMonth() + 1);

  const nextBillingDate = calculateNextBillingDate(
    subscription.start_date,
    plan.billing_interval_unit,
    plan.billing_interval_count,
    anchorDay,
    anchorMonth
  );

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      activated_at: now,
      next_billing_date: nextBillingDate,
    })
    .eq("id", subscriptionId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await supabase.from("subscription_events").insert({
    subscription_id: subscriptionId,
    from_status: "confirmed",
    to_status: "active",
    action: "activate",
    note: `Subscription activated. Next billing date: ${nextBillingDate}`,
    actor_id: session.id,
  });

  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${subscriptionId}`);
  return { success: true };
}

/**
 * Pause subscription (active -> paused).
 * Enforces T-12: allowPause policy flag must be true.
 */
export async function pauseSubscriptionAction(
  subscriptionId: string,
  note?: string
): Promise<ActionResult<void>> {
  const { error, subscription, session, supabase } = await loadSubscriptionWithAuthCheck(subscriptionId);
  if (error || !subscription || !supabase || !session) {
    return { success: false, error: error || "Failed to load subscription." };
  }

  const validation = validatePause({
    status: subscription.status,
    allowPause: subscription.allow_pause,
  });

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({
      status: "paused",
      paused_at: now,
    })
    .eq("id", subscriptionId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await supabase.from("subscription_events").insert({
    subscription_id: subscriptionId,
    from_status: "active",
    to_status: "paused",
    action: "pause",
    note: note || "Subscription temporarily paused. Recurring billing suppressed.",
    actor_id: session.id,
  });

  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${subscriptionId}`);
  revalidatePath("/portal");
  return { success: true };
}

/**
 * Resume a paused subscription (paused -> active).
 * Shifts next billing date forward by the paused duration.
 */
export async function resumeSubscriptionAction(
  subscriptionId: string,
  note?: string
): Promise<ActionResult<void>> {
  const { error, subscription, session, supabase } = await loadSubscriptionWithAuthCheck(subscriptionId);
  if (error || !subscription || !supabase || !session) {
    return { success: false, error: error || "Failed to load subscription." };
  }

  const validation = validateResume({
    status: subscription.status,
    pausedAt: subscription.paused_at,
  });

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  let shiftedNextBillingDate = subscription.next_billing_date;
  if (subscription.paused_at && subscription.next_billing_date) {
    shiftedNextBillingDate = calculateResumeBillingDate(
      subscription.paused_at,
      subscription.next_billing_date
    );
  }

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      paused_at: null,
      next_billing_date: shiftedNextBillingDate,
    })
    .eq("id", subscriptionId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await supabase.from("subscription_events").insert({
    subscription_id: subscriptionId,
    from_status: "paused",
    to_status: "active",
    action: "resume",
    note: note || `Resumed. Next billing date shifted to ${shiftedNextBillingDate}`,
    actor_id: session.id,
  });

  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${subscriptionId}`);
  revalidatePath("/portal");
  return { success: true };
}

/**
 * Close subscription (terminal state).
 * Enforces T-11: allowEarlyClose must be true if closed prior to expiry date.
 */
export async function closeSubscriptionAction(
  subscriptionId: string,
  reason?: string
): Promise<ActionResult<void>> {
  const { error, subscription, session, supabase } = await loadSubscriptionWithAuthCheck(subscriptionId);
  if (error || !subscription || !supabase || !session) {
    return { success: false, error: error || "Failed to load subscription." };
  }

  const validation = validateEarlyClose({
    status: subscription.status,
    allowEarlyClose: subscription.allow_early_close,
    expiryDate: subscription.expiry_date,
  });

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({
      status: "closed",
      closed_at: now,
      closure_reason: reason || "User or staff requested closure",
    })
    .eq("id", subscriptionId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await supabase.from("subscription_events").insert({
    subscription_id: subscriptionId,
    from_status: subscription.status,
    to_status: "closed",
    action: "close",
    note: reason ? `Subscription closed: ${reason}` : "Subscription closed.",
    actor_id: session.id,
  });

  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${subscriptionId}`);
  revalidatePath("/portal");
  return { success: true };
}

/**
 * Renew subscription: creates a new subscription linked via renewed_from_subscription_id.
 * Enforces allowRenewal flag.
 */
export async function renewSubscriptionAction(
  subscriptionId: string
): Promise<ActionResult<Subscription>> {
  const { error, subscription, session, supabase } = await loadSubscriptionWithAuthCheck(subscriptionId);
  if (error || !subscription || !supabase || !session) {
    return { success: false, error: error || "Failed to load subscription." };
  }

  const validation = validateRenewal({
    status: subscription.status,
    allowRenewal: subscription.allow_renewal,
  });

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const today = formatDateUTC(new Date());
  // New subscription starts at original expiry date or today
  const newStartDate = subscription.expiry_date && subscription.expiry_date >= today
    ? subscription.expiry_date
    : today;

  const timestamp = Date.now().toString().slice(-6);
  const newSubscriptionNumber = `SUB-${new Date().getUTCFullYear()}-${timestamp}`;

  const { data: newSub, error: newSubErr } = await supabase
    .from("subscriptions")
    .insert({
      subscription_number: newSubscriptionNumber,
      customer_id: subscription.customer_id,
      plan_id: subscription.plan_id,
      plan_name_snapshot: subscription.plan_name_snapshot,
      quotation_template_id: subscription.quotation_template_id,
      renewed_from_subscription_id: subscription.id,
      status: "confirmed",
      start_date: newStartDate,
      payment_terms_days: subscription.payment_terms_days,
      plan_price_snapshot: subscription.plan_price_snapshot,
      plan_quantity: subscription.plan_quantity,
      currency_code: subscription.currency_code,
      auto_close_on_end: subscription.auto_close_on_end,
      allow_early_close: subscription.allow_early_close,
      allow_pause: subscription.allow_pause,
      allow_renewal: subscription.allow_renewal,
      confirmed_at: new Date().toISOString(),
      created_by: session.id,
    })
    .select()
    .single();

  if (newSubErr || !newSub) {
    return { success: false, error: newSubErr?.message || "Failed to create renewal subscription." };
  }

  // Copy existing subscription lines
  const { data: existingLines } = await supabase
    .from("subscription_lines")
    .select("*")
    .eq("subscription_id", subscription.id);

  if (existingLines && existingLines.length > 0) {
    const linesToInsert = existingLines.map((l) => ({
      subscription_id: newSub.id,
      product_id: l.product_id,
      variant_id: l.variant_id,
      description_snapshot: l.description_snapshot,
      quantity: l.quantity,
      unit_price: l.unit_price,
    }));

    await supabase.from("subscription_lines").insert(linesToInsert);
  }

  await supabase.from("subscription_events").insert({
    subscription_id: newSub.id,
    from_status: null,
    to_status: "confirmed",
    action: "renew",
    note: `Renewed from subscription ${subscription.subscription_number}`,
    actor_id: session.id,
  });

  await supabase.from("subscription_events").insert({
    subscription_id: subscription.id,
    from_status: subscription.status,
    to_status: subscription.status,
    action: "renew_spawned",
    note: `Created renewal subscription ${newSubscriptionNumber}`,
    actor_id: session.id,
  });

  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${subscriptionId}`);
  revalidatePath("/portal");
  return { success: true, data: newSub as unknown as Subscription };
}
