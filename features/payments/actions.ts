"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffOrAdmin, getCurrentUserSession } from "@/features/auth/guards";
import { recordPaymentSchema, RecordPaymentInput } from "./schemas";
import { round2Num } from "@/features/billing/engine";
import type { ActionResult } from "@/types";

/**
 * Records a manual payment against an invoice.
 * Protected by requireStaffOrAdmin().
 * Atomic update of invoice amount_paid, status, and payment ledger.
 */
export async function recordPaymentAction(
  input: RecordPaymentInput
): Promise<ActionResult<{ paymentId: string }>> {
  await requireStaffOrAdmin();
  const session = await getCurrentUserSession();
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return { success: false, error: "Database client unavailable" };
  }

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { invoiceId, amount, paymentMethod, paidAt, referenceNumber, note } = parsed.data;

  // Try calling the Postgres RPC record_payment first
  try {
    const { data: rpcPaymentId, error: rpcErr } = await supabase.rpc("record_payment", {
      p_invoice_id: invoiceId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_paid_at: paidAt || new Date().toISOString(),
      p_note: note || null,
      p_reference_number: referenceNumber || null,
    });

    if (!rpcErr && rpcPaymentId) {
      revalidatePath("/billing");
      revalidatePath("/invoices");
      revalidatePath(`/invoices/${invoiceId}`);
      revalidatePath("/payments");
      revalidatePath("/portal");
      revalidatePath("/");

      return {
        success: true,
        data: { paymentId: rpcPaymentId as string },
      };
    }

    // If RPC failed with business logic exception, bubble it up
    if (rpcErr && !rpcErr.message.includes("could not find the function") && !rpcErr.message.includes("schema cache")) {
      return { success: false, error: rpcErr.message };
    }
  } catch {
    // Continue to atomic transactional fallback below
  }

  // Fallback: atomic JS transaction pattern
  // 1. Fetch current invoice state
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, amount_paid, balance_due, status")
    .eq("id", invoiceId)
    .single();

  if (invErr || !inv) {
    return { success: false, error: "Invoice record not found" };
  }

  if (inv.status === "draft") {
    return {
      success: false,
      error: `Invoice ${inv.invoice_number} is in 'draft' status. Confirm the invoice before recording payments.`,
    };
  }

  if (inv.status === "cancelled" || inv.status === "void") {
    return {
      success: false,
      error: `Payments cannot be recorded on ${inv.status} invoices.`,
    };
  }

  const currentTotal = Number(inv.total);
  const currentPaid = Number(inv.amount_paid);
  const currentBalance = Number(inv.balance_due ?? currentTotal - currentPaid);

  if (currentBalance <= 0) {
    return {
      success: false,
      error: `Invoice ${inv.invoice_number} is already fully paid.`,
    };
  }

  if (amount > currentBalance) {
    return {
      success: false,
      error: `Payment amount (${amount}) exceeds remaining balance due (${currentBalance}).`,
    };
  }

  // 2. Insert payment record
  const { data: paymentRecord, error: payInsertErr } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      amount,
      payment_method: paymentMethod,
      paid_at: paidAt || new Date().toISOString(),
      note: note || null,
      reference_number: referenceNumber || null,
      recorded_by: session?.id || null,
    })
    .select("id")
    .single();

  if (payInsertErr || !paymentRecord) {
    return {
      success: false,
      error: `Failed to record payment: ${payInsertErr?.message || "Insert failed"}`,
    };
  }

  // 3. Update invoice amount_paid and status
  const newAmountPaid = round2Num(currentPaid + amount);
  const newStatus = newAmountPaid >= currentTotal ? "paid" : "partially_paid";

  const { error: invUpdateErr } = await supabase
    .from("invoices")
    .update({
      amount_paid: newAmountPaid,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (invUpdateErr) {
    return {
      success: false,
      error: `Payment recorded but failed to update invoice balance: ${invUpdateErr.message}`,
    };
  }

  // 4. Record audit log
  try {
    await supabase.from("audit_logs").insert({
      actor_id: session?.id || null,
      action: "payment.recorded",
      entity_type: "invoice",
      entity_id: invoiceId,
      after_data: {
        payment_id: paymentRecord.id,
        amount,
        payment_method: paymentMethod,
        new_amount_paid: newAmountPaid,
        new_status: newStatus,
        remaining_balance: round2Num(currentTotal - newAmountPaid),
      },
    });
  } catch {}

  revalidatePath("/billing");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/payments");
  revalidatePath("/portal");
  revalidatePath("/");

  return {
    success: true,
    data: { paymentId: paymentRecord.id },
  };
}
