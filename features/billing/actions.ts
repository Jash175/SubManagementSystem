"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffOrAdmin, getCurrentUserSession } from "@/features/auth/guards";
import {
  billingRunInputSchema,
  BillingRunInput,
  generateSubscriptionInvoiceSchema,
  GenerateSubscriptionInvoiceInput,
  confirmInvoiceSchema,
  ConfirmInvoiceInput,
  cancelInvoiceSchema,
  CancelInvoiceInput,
} from "./schemas";
import {
  executeBillingRun,
  generateInvoiceForSubscription,
} from "./engine";
import type { ActionResult, BillingRunResult } from "@/types";

/**
 * Triggers recurring billing run across all due subscriptions.
 * Protected by requireStaffOrAdmin().
 */
export async function runDueBillingAction(
  input?: BillingRunInput
): Promise<ActionResult<BillingRunResult>> {
  await requireStaffOrAdmin();
  const session = await getCurrentUserSession();
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return { success: false, error: "Database client unavailable" };
  }

  const parsed = billingRunInputSchema.safeParse(input || {});
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const result = await executeBillingRun(supabase, {
      asOfDate: parsed.data.asOfDate,
      triggerSource: parsed.data.triggerSource,
      autoConfirm: parsed.data.autoConfirm,
      subscriptionIds: parsed.data.subscriptionIds,
      initiatedBy: session?.id,
    });

    revalidatePath("/billing");
    revalidatePath("/invoices");
    revalidatePath("/subscriptions");
    revalidatePath("/payments");
    revalidatePath("/portal");
    revalidatePath("/");

    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Manually generates a recurring invoice for a specific subscription.
 */
export async function generateSubscriptionInvoiceAction(
  input: GenerateSubscriptionInvoiceInput
): Promise<ActionResult<{ invoiceId?: string; invoiceNumber?: string }>> {
  await requireStaffOrAdmin();
  const session = await getCurrentUserSession();
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return { success: false, error: "Database client unavailable" };
  }

  const parsed = generateSubscriptionInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const result = await generateInvoiceForSubscription(
      supabase,
      parsed.data.subscriptionId,
      {
        asOfDate: parsed.data.asOfDate,
        autoConfirm: parsed.data.autoConfirm,
        actorId: session?.id,
      }
    );

    if (!result.success) {
      if (result.skipped) {
        return {
          success: false,
          error: `Invoice generation skipped: ${result.reason}`,
        };
      }
      return { success: false, error: result.error || "Generation failed" };
    }

    revalidatePath("/billing");
    revalidatePath("/invoices");
    revalidatePath(`/subscriptions/${parsed.data.subscriptionId}`);
    revalidatePath("/portal");
    revalidatePath("/");

    return {
      success: true,
      data: {
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Confirms a draft invoice so it can receive payments.
 */
export async function confirmInvoiceAction(
  input: ConfirmInvoiceInput
): Promise<ActionResult<void>> {
  await requireStaffOrAdmin();
  const session = await getCurrentUserSession();
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return { success: false, error: "Database client unavailable" };
  }

  const parsed = confirmInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  // Check current status
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, status, invoice_number")
    .eq("id", parsed.data.invoiceId)
    .single();

  if (invErr || !inv) {
    return { success: false, error: "Invoice not found" };
  }

  if (inv.status !== "draft") {
    return {
      success: false,
      error: `Invoice ${inv.invoice_number} is in '${inv.status}' status. Only draft invoices can be confirmed.`,
    };
  }

  const { error: updateErr } = await supabase
    .from("invoices")
    .update({
      status: "confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.invoiceId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Audit log
  try {
    await supabase.from("audit_logs").insert({
      actor_id: session?.id || null,
      action: "invoice.confirmed",
      entity_type: "invoice",
      entity_id: parsed.data.invoiceId,
      after_data: { status: "confirmed" },
    });
  } catch {}

  revalidatePath("/billing");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  revalidatePath("/portal");
  revalidatePath("/");

  return { success: true };
}

/**
 * Cancels a draft or confirmed invoice if no payment has been recorded.
 */
export async function cancelInvoiceAction(
  input: CancelInvoiceInput
): Promise<ActionResult<void>> {
  await requireStaffOrAdmin();
  const session = await getCurrentUserSession();
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return { success: false, error: "Database client unavailable" };
  }

  const parsed = cancelInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, status, amount_paid, invoice_number")
    .eq("id", parsed.data.invoiceId)
    .single();

  if (invErr || !inv) {
    return { success: false, error: "Invoice not found" };
  }

  if (inv.status === "cancelled" || inv.status === "void") {
    return { success: false, error: `Invoice is already ${inv.status}.` };
  }

  if (Number(inv.amount_paid) > 0) {
    return {
      success: false,
      error: `Cannot cancel invoice ${inv.invoice_number} because payments of ${inv.amount_paid} have already been recorded. Use credit note or refund flow.`,
    };
  }

  const { error: updateErr } = await supabase
    .from("invoices")
    .update({
      status: "cancelled",
      notes: parsed.data.reason
        ? `Cancelled: ${parsed.data.reason}`
        : "Cancelled by staff/admin",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.invoiceId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Audit log
  try {
    await supabase.from("audit_logs").insert({
      actor_id: session?.id || null,
      action: "invoice.cancelled",
      entity_type: "invoice",
      entity_id: parsed.data.invoiceId,
      after_data: { status: "cancelled", reason: parsed.data.reason },
    });
  } catch {}

  revalidatePath("/billing");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  revalidatePath("/portal");
  revalidatePath("/");

  return { success: true };
}
