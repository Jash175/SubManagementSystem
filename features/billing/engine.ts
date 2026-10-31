import { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateNextBillingDate,
  formatDateUTC,
  parseDateUTC,
} from "@/features/subscriptions/lifecycle";
import {
  checkDiscountEligibility,
  calculateDiscountAmount,
} from "@/features/discounts/eligibility";
import type {
  BillingRunResult,
  BillingIntervalUnit,
  Discount,
} from "@/types";
import { round2, round2Num, addDaysUTC } from "./math";

export { round2, round2Num, addDaysUTC };

/**
 * Generates a unique sequential/timestamped invoice number.
 * Format: INV-YYYYMM-XXXXX (e.g. INV-202610-00104)
 */
export async function generateInvoiceNumber(
  supabase: SupabaseClient
): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  try {
    const { count, error } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true });

    const seq = error || count === null ? Math.floor(1000 + Math.random() * 9000) : count + 1;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `INV-${yearMonth}-${String(seq).padStart(4, "0")}-${randomSuffix.toString().slice(0, 3)}`;
  } catch {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    return `INV-${yearMonth}-${randomSuffix}`;
  }
}

export interface GenerateInvoiceOptions {
  asOfDate?: string;
  autoConfirm?: boolean;
  actorId?: string;
  billingRunId?: string;
}

export interface GenerateInvoiceResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  total?: number;
  periodStart?: string;
  periodEnd?: string;
  error?: string;
}

/**
 * Generates one recurring invoice for a single eligible subscription period.
 * Strictly adheres to 08_BILLING_ALGORITHM.md:
 * - Locks and validates period uniqueness
 * - Copies price snapshots and tax snapshots
 * - Applies eligible discount rule
 * - Calculates percentage non-compound taxes
 * - Inserts draft/confirmed invoice
 * - Advances next_billing_date to period_end ONLY on success
 */
export async function generateInvoiceForSubscription(
  supabase: SupabaseClient,
  subscriptionId: string,
  options?: GenerateInvoiceOptions
): Promise<GenerateInvoiceResult> {
  const asOfDate = options?.asOfDate || formatDateUTC(new Date());

  // 1. Fetch subscription details along with plan and lines
  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select(`
      *,
      plans (
        id,
        plan_code,
        name,
        price,
        billing_interval_unit,
        billing_interval_count,
        auto_close_on_end
      ),
      customer:customers (
        id,
        customer_code,
        legal_name,
        email,
        company_name,
        tax_number
      ),
      subscription_lines (
        id,
        product_id,
        variant_id,
        description_snapshot,
        quantity,
        unit_price,
        line_subtotal
      )
    `)
    .eq("id", subscriptionId)
    .single();

  if (subErr || !sub) {
    return {
      success: false,
      error: `Subscription ${subscriptionId} not found or unreadable: ${subErr?.message || "Not found"}`,
    };
  }

  // 2. Lifecycle eligibility check
  if (sub.status !== "active") {
    return {
      success: false,
      skipped: true,
      reason: `Subscription is in '${sub.status}' state (only active subscriptions can be billed)`,
    };
  }

  // 3. Expiry and auto-close check
  if (sub.expiry_date && asOfDate > sub.expiry_date) {
    if (sub.auto_close_on_end) {
      await supabase
        .from("subscriptions")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closure_reason: `Auto-closed on reaching expiry date ${sub.expiry_date}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId);

      await supabase.from("subscription_events").insert({
        subscription_id: subscriptionId,
        from_status: "active",
        to_status: "closed",
        action: "auto_close_on_expiry",
        note: `Auto-closed by billing engine upon reaching expiry date ${sub.expiry_date}`,
        actor_id: options?.actorId || null,
      });

      return {
        success: false,
        skipped: true,
        reason: `Subscription expired on ${sub.expiry_date} and was auto-closed.`,
      };
    }
  }

  if (!sub.next_billing_date) {
    return {
      success: false,
      skipped: true,
      reason: "Subscription has no next_billing_date configured.",
    };
  }

  if (sub.next_billing_date > asOfDate) {
    return {
      success: false,
      skipped: true,
      reason: `Billing date ${sub.next_billing_date} is in the future (asOfDate: ${asOfDate}).`,
    };
  }

  const plan = sub.plans;
  if (!plan) {
    return {
      success: false,
      error: `Subscription ${subscriptionId} references missing plan record.`,
    };
  }

  // 4. Calculate Billing Period
  const periodStart = sub.next_billing_date;
  const anchorDay =
    sub.billing_anchor_day ||
    (periodStart ? parseDateUTC(periodStart).getUTCDate() : 1);
  const anchorMonth =
    sub.billing_anchor_month ||
    (periodStart ? parseDateUTC(periodStart).getUTCMonth() + 1 : 1);

  const periodEnd = calculateNextBillingDate(
    periodStart,
    plan.billing_interval_unit as BillingIntervalUnit,
    plan.billing_interval_count,
    anchorDay,
    anchorMonth
  );

  // If expiry date is present and period start is beyond expiry, skip
  if (sub.expiry_date && periodStart > sub.expiry_date) {
    return {
      success: false,
      skipped: true,
      reason: `Billing period start ${periodStart} is beyond expiry date ${sub.expiry_date}.`,
    };
  }

  // 5. Check Idempotency Key: (subscription_id, periodStart, periodEnd)
  const { data: existingInvoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, status")
    .eq("subscription_id", subscriptionId)
    .eq("billing_period_start", periodStart)
    .eq("billing_period_end", periodEnd)
    .maybeSingle();

  if (existingInvoice) {
    // Invoice already exists for this exact period.
    // If next_billing_date was not advanced yet (e.g. from a prior crashed run), advance it now.
    if (sub.next_billing_date === periodStart) {
      await supabase
        .from("subscriptions")
        .update({
          next_billing_date: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId);
    }

    return {
      success: true,
      skipped: true,
      reason: `Invoice ${existingInvoice.invoice_number} already exists for period ${periodStart} to ${periodEnd}.`,
      invoiceId: existingInvoice.id,
      invoiceNumber: existingInvoice.invoice_number,
    };
  }

  // 6. Build Invoice Lines & Taxes
  // Load plan taxes
  const { data: planTaxesData } = await supabase
    .from("plan_taxes")
    .select("tax_id, taxes(id, name, rate_percent)")
    .eq("plan_id", sub.plan_id);

  const planTaxes: { id: string; name: string; rate_percent: number }[] = [];
  if (planTaxesData) {
    for (const pt of planTaxesData) {
      if (pt.taxes) {
        const t = Array.isArray(pt.taxes) ? pt.taxes[0] : pt.taxes;
        if (t) {
          planTaxes.push({
            id: t.id,
            name: t.name,
            rate_percent: Number(t.rate_percent),
          });
        }
      }
    }
  }

  // Load product taxes for any add-on lines
  const productIds = (sub.subscription_lines || [])
    .map((l: { product_id: string }) => l.product_id)
    .filter(Boolean);

  const productTaxesMap: Record<
    string,
    { id: string; name: string; rate_percent: number }[]
  > = {};

  if (productIds.length > 0) {
    const { data: prodTaxesData } = await supabase
      .from("product_taxes")
      .select("product_id, tax_id, taxes(id, name, rate_percent)")
      .in("product_id", productIds);

    if (prodTaxesData) {
      for (const pt of prodTaxesData) {
        if (!productTaxesMap[pt.product_id]) {
          productTaxesMap[pt.product_id] = [];
        }
        if (pt.taxes) {
          const t = Array.isArray(pt.taxes) ? pt.taxes[0] : pt.taxes;
          if (t) {
            productTaxesMap[pt.product_id].push({
              id: t.id,
              name: t.name,
              rate_percent: Number(t.rate_percent),
            });
          }
        }
      }
    }
  }

  // Base Plan Line
  const planQuantity = Number(sub.plan_quantity || 1);
  const planUnitPrice = Number(sub.plan_price_snapshot || plan.price);
  const planSubtotal = round2Num(planQuantity * planUnitPrice);

  interface PreparedLine {
    lineType: "plan" | "product";
    productId?: string | null;
    variantId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    discountAmount: number;
    taxes: {
      taxId: string;
      taxName: string;
      ratePercent: number;
      taxAmount: number;
    }[];
    taxAmount: number;
    lineTotal: number;
  }

  const linesToCreate: PreparedLine[] = [
    {
      lineType: "plan",
      productId: null,
      variantId: null,
      description: sub.plan_name_snapshot || plan.name,
      quantity: planQuantity,
      unitPrice: planUnitPrice,
      subtotal: planSubtotal,
      discountAmount: 0,
      taxes: [],
      taxAmount: 0,
      lineTotal: planSubtotal,
    },
  ];

  // Product Add-on Lines
  if (sub.subscription_lines && sub.subscription_lines.length > 0) {
    for (const l of sub.subscription_lines) {
      const q = Number(l.quantity);
      const p = Number(l.unit_price);
      const subTot = round2Num(q * p);
      linesToCreate.push({
        lineType: "product",
        productId: l.product_id,
        variantId: l.variant_id,
        description: l.description_snapshot,
        quantity: q,
        unitPrice: p,
        subtotal: subTot,
        discountAmount: 0,
        taxes: [],
        taxAmount: 0,
        lineTotal: subTot,
      });
    }
  }

  const invoiceSubtotal = round2Num(
    linesToCreate.reduce((acc, curr) => acc + curr.subtotal, 0)
  );

  // 7. Discount Eligibility & Application
  // Fetch active discounts ordered by priority ASC, created_at ASC
  const { data: rawDiscounts } = await supabase
    .from("discounts")
    .select(`
      id,
      discount_code,
      name,
      scope,
      discount_type,
      value,
      minimum_purchase_amount,
      minimum_quantity,
      starts_on,
      ends_on,
      max_uses,
      priority,
      is_active,
      discount_products (product_id)
    `)
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  let appliedDiscount: {
    id: string;
    code: string;
    amount: number;
  } | null = null;

  if (rawDiscounts && rawDiscounts.length > 0) {
    for (const d of rawDiscounts) {
      const prodIds = (d.discount_products || []).map(
        (dp: { product_id: string }) => dp.product_id
      );

      // Check redemptions count
      const { count: redemptionsCount } = await supabase
        .from("discount_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("discount_id", d.id);

      const discountModel: Pick<
        Discount,
        | "isActive"
        | "startsOn"
        | "endsOn"
        | "maxUses"
        | "minimumPurchaseAmount"
        | "minimumQuantity"
        | "scope"
        | "productIds"
      > = {
        isActive: d.is_active,
        startsOn: d.starts_on,
        endsOn: d.ends_on,
        maxUses: d.max_uses,
        minimumPurchaseAmount: Number(d.minimum_purchase_amount),
        minimumQuantity: Number(d.minimum_quantity),
        scope: d.scope as "product" | "subscription",
        productIds: prodIds,
      };

      if (d.scope === "subscription") {
        const totalQty = linesToCreate.reduce((a, b) => a + b.quantity, 0);
        const check = checkDiscountEligibility(discountModel, {
          purchaseAmount: invoiceSubtotal,
          quantity: totalQty,
          date: asOfDate,
          currentUses: redemptionsCount || 0,
        });

        if (check.isEligible) {
          const discountVal = calculateDiscountAmount(
            {
              discountType: d.discount_type as "fixed" | "percentage",
              value: Number(d.value),
            },
            invoiceSubtotal
          );

          if (discountVal > 0) {
            appliedDiscount = {
              id: d.id,
              code: d.discount_code,
              amount: discountVal,
            };

            // Allocate discount proportionally across lines
            let distributedTotal = 0;
            for (let i = 0; i < linesToCreate.length; i++) {
              const line = linesToCreate[i];
              if (i === linesToCreate.length - 1) {
                // Assign rounding remainder to final line
                const remainder = round2Num(discountVal - distributedTotal);
                line.discountAmount = Math.min(remainder, line.subtotal);
              } else {
                const ratio = line.subtotal / invoiceSubtotal;
                const lineDiscount = round2Num(discountVal * ratio);
                line.discountAmount = Math.min(lineDiscount, line.subtotal);
                distributedTotal += line.discountAmount;
              }
            }
            break; // Apply only one discount rule per invoice
          }
        }
      } else if (d.scope === "product") {
        // Find matching lines
        const matchingLines = linesToCreate.filter(
          (l) => l.productId && prodIds.includes(l.productId)
        );

        if (matchingLines.length > 0) {
          const matchingSubtotal = matchingLines.reduce(
            (acc, l) => acc + l.subtotal,
            0
          );
          const matchingQty = matchingLines.reduce(
            (acc, l) => acc + l.quantity,
            0
          );

          const check = checkDiscountEligibility(discountModel, {
            purchaseAmount: matchingSubtotal,
            quantity: matchingQty,
            date: asOfDate,
            productId: matchingLines[0].productId || undefined,
            currentUses: redemptionsCount || 0,
          });

          if (check.isEligible) {
            const discountVal = calculateDiscountAmount(
              {
                discountType: d.discount_type as "fixed" | "percentage",
                value: Number(d.value),
              },
              matchingSubtotal
            );

            if (discountVal > 0) {
              appliedDiscount = {
                id: d.id,
                code: d.discount_code,
                amount: discountVal,
              };

              let distributedTotal = 0;
              for (let i = 0; i < matchingLines.length; i++) {
                const line = matchingLines[i];
                if (i === matchingLines.length - 1) {
                  const remainder = round2Num(discountVal - distributedTotal);
                  line.discountAmount = Math.min(remainder, line.subtotal);
                } else {
                  const ratio = line.subtotal / matchingSubtotal;
                  const lineDiscount = round2Num(discountVal * ratio);
                  line.discountAmount = Math.min(lineDiscount, line.subtotal);
                  distributedTotal += line.discountAmount;
                }
              }
              break;
            }
          }
        }
      }
    }
  }

  // 8. Calculate Taxes Per Line
  for (const line of linesToCreate) {
    const applicableTaxes =
      line.lineType === "plan"
        ? planTaxes
        : line.productId && productTaxesMap[line.productId]
        ? productTaxesMap[line.productId]
        : [];

    const taxableAmount = Math.max(0, line.subtotal - line.discountAmount);
    let lineTaxTotal = 0;

    for (const tax of applicableTaxes) {
      const taxAmount = round2Num((taxableAmount * tax.rate_percent) / 100);
      line.taxes.push({
        taxId: tax.id,
        taxName: tax.name,
        ratePercent: tax.rate_percent,
        taxAmount,
      });
      lineTaxTotal = round2Num(lineTaxTotal + taxAmount);
    }

    line.taxAmount = lineTaxTotal;
    line.lineTotal = round2Num(taxableAmount + lineTaxTotal);
  }

  // 9. Aggregate Totals
  const totalDiscount = round2Num(
    linesToCreate.reduce((acc, curr) => acc + curr.discountAmount, 0)
  );
  const totalTax = round2Num(
    linesToCreate.reduce((acc, curr) => acc + curr.taxAmount, 0)
  );
  const invoiceTotal = round2Num(invoiceSubtotal - totalDiscount + totalTax);

  const paymentTermsDays = Number(sub.payment_terms_days || 15);
  const dueDate = addDaysUTC(periodStart, paymentTermsDays);
  const invoiceNumber = await generateInvoiceNumber(supabase);
  const initialStatus = options?.autoConfirm ? "confirmed" : "draft";

  // 10. Insert Invoice Header
  const { data: createdInvoice, error: invInsertErr } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      customer_id: sub.customer_id,
      subscription_id: sub.id,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      status: initialStatus,
      issued_at: new Date().toISOString(),
      due_date: dueDate,
      currency_code: sub.currency_code || "INR",
      subtotal: invoiceSubtotal,
      discount_total: totalDiscount,
      tax_total: totalTax,
      total: invoiceTotal,
      amount_paid: 0,
      notes: `Recurring billing for ${sub.plan_name_snapshot} (${periodStart} to ${periodEnd})`,
      created_by: options?.actorId || null,
    })
    .select("id, invoice_number")
    .single();

  if (invInsertErr || !createdInvoice) {
    // If unique constraint violation occurred:
    if (invInsertErr?.code === "23505" || invInsertErr?.message?.includes("uq_invoices_subscription_period")) {
      return {
        success: true,
        skipped: true,
        reason: `Duplicate invoice prevented by database idempotency index for period ${periodStart} to ${periodEnd}.`,
      };
    }
    return {
      success: false,
      error: `Failed to insert invoice: ${invInsertErr?.message || "Unknown error"}`,
    };
  }

  const invoiceId = createdInvoice.id;

  // 11. Insert Lines & Taxes
  for (const line of linesToCreate) {
    const { data: createdLine, error: lineErr } = await supabase
      .from("invoice_lines")
      .insert({
        invoice_id: invoiceId,
        product_id: line.productId || null,
        variant_id: line.variantId || null,
        line_type: line.lineType,
        description_snapshot: line.description,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        discount_amount: line.discountAmount,
        tax_amount: line.taxAmount,
      })
      .select("id")
      .single();

    if (lineErr || !createdLine) {
      return {
        success: false,
        error: `Failed to insert invoice line: ${lineErr?.message || "Line error"}`,
      };
    }

    if (line.taxes.length > 0) {
      const taxInserts = line.taxes.map((t) => ({
        invoice_line_id: createdLine.id,
        tax_id: t.taxId,
        tax_name_snapshot: t.taxName,
        rate_percent_snapshot: t.ratePercent,
        tax_amount: t.taxAmount,
      }));

      await supabase.from("invoice_line_taxes").insert(taxInserts);
    }
  }

  // 12. Record Discount Redemption if applicable
  if (appliedDiscount) {
    await supabase.from("discount_redemptions").insert({
      discount_id: appliedDiscount.id,
      invoice_id: invoiceId,
      subscription_id: sub.id,
      amount: appliedDiscount.amount,
      redeemed_at: new Date().toISOString(),
    });
  }

  // 13. ONLY ONCE INVOICE GENERATION HAS FULLY SUCCEEDED:
  // Advance subscription's next_billing_date to periodEnd
  const { error: subUpdateErr } = await supabase
    .from("subscriptions")
    .update({
      next_billing_date: periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  if (subUpdateErr) {
    console.error(
      `Warning: Invoice ${invoiceNumber} created but failed to advance next_billing_date:`,
      subUpdateErr.message
    );
  }

  // Record audit log
  try {
    await supabase.from("audit_logs").insert({
      actor_id: options?.actorId || null,
      action: "invoice.generated",
      entity_type: "invoice",
      entity_id: invoiceId,
      after_data: {
        invoice_number: invoiceNumber,
        subscription_id: sub.id,
        period_start: periodStart,
        period_end: periodEnd,
        total: invoiceTotal,
        status: initialStatus,
      },
    });
  } catch {
    // Non-fatal if audit logging fails
  }

  return {
    success: true,
    invoiceId,
    invoiceNumber,
    total: invoiceTotal,
    periodStart,
    periodEnd,
  };
}

/**
 * Executes a full retry-safe recurring billing run across all due subscriptions.
 * Adheres to 08_BILLING_ALGORITHM.md:
 * - Iterates candidate subscriptions (status='active' and next_billing_date <= asOfDate)
 * - Safe catch-up bound (up to 12 periods per subscription)
 * - Isolates errors per subscription so one failure doesn't abort others
 * - Records billing run result in billing_runs table
 */
export async function executeBillingRun(
  supabase: SupabaseClient,
  options?: {
    asOfDate?: string;
    triggerSource?: "manual" | "scheduled" | "retry";
    autoConfirm?: boolean;
    subscriptionIds?: string[];
    initiatedBy?: string;
  }
): Promise<BillingRunResult> {
  const asOfDate = options?.asOfDate || formatDateUTC(new Date());
  const triggerSource = options?.triggerSource || "manual";
  const startedAt = new Date().toISOString();

  // Create initial billing run record
  let runId = "";
  try {
    const { data: runRecord } = await supabase
      .from("billing_runs")
      .insert({
        trigger_source: triggerSource,
        status: "running",
        started_at: startedAt,
        initiated_by: options?.initiatedBy || null,
      })
      .select("id")
      .single();

    if (runRecord) {
      runId = runRecord.id;
    }
  } catch (err) {
    console.error("Failed to insert initial billing_run record:", err);
  }

  let subscriptionsChecked = 0;
  let invoicesCreated = 0;
  let invoicesSkipped = 0;
  let expiredSubscriptionsClosed = 0;
  const errors: {
    subscriptionId?: string;
    subscriptionNumber?: string;
    error: string;
  }[] = [];

  // Query candidate subscriptions
  let query = supabase
    .from("subscriptions")
    .select(`
      id,
      subscription_number,
      customer_id,
      status,
      next_billing_date,
      expiry_date,
      auto_close_on_end
    `)
    .eq("status", "active")
    .lte("next_billing_date", asOfDate)
    .order("next_billing_date", { ascending: true })
    .order("id", { ascending: true });

  if (options?.subscriptionIds && options.subscriptionIds.length > 0) {
    query = query.in("id", options.subscriptionIds);
  }

  const { data: candidates, error: candidateErr } = await query;

  if (candidateErr) {
    errors.push({
      error: `Failed to query due subscriptions: ${candidateErr.message}`,
    });
  } else if (candidates) {
    for (const sub of candidates) {
      subscriptionsChecked++;

      // Check auto-close on expiry
      if (
        sub.expiry_date &&
        asOfDate > sub.expiry_date &&
        sub.auto_close_on_end
      ) {
        expiredSubscriptionsClosed++;
        await supabase
          .from("subscriptions")
          .update({
            status: "closed",
            closed_at: new Date().toISOString(),
            closure_reason: `Auto-closed on reaching expiry date ${sub.expiry_date}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);

        await supabase.from("subscription_events").insert({
          subscription_id: sub.id,
          from_status: "active",
          to_status: "closed",
          action: "auto_close_on_expiry",
          note: `Auto-closed by billing run upon reaching expiry date ${sub.expiry_date}`,
          actor_id: options?.initiatedBy || null,
        });

        invoicesSkipped++;
        continue;
      }

      // Catch-up loop: generate invoices until next_billing_date > asOfDate or bound reached (12 periods)
      let catchUpCount = 0;
      const MAX_CATCH_UP_PERIODS = 12;

      while (catchUpCount < MAX_CATCH_UP_PERIODS) {
        // Read fresh subscription to check current next_billing_date
        const { data: freshSub } = await supabase
          .from("subscriptions")
          .select("next_billing_date, status")
          .eq("id", sub.id)
          .single();

        if (
          !freshSub ||
          freshSub.status !== "active" ||
          !freshSub.next_billing_date ||
          freshSub.next_billing_date > asOfDate
        ) {
          break;
        }

        try {
          const res = await generateInvoiceForSubscription(supabase, sub.id, {
            asOfDate,
            autoConfirm: options?.autoConfirm ?? false,
            actorId: options?.initiatedBy,
            billingRunId: runId || undefined,
          });

          if (res.success) {
            if (res.skipped) {
              invoicesSkipped++;
            } else {
              invoicesCreated++;
            }
          } else {
            if (res.skipped) {
              invoicesSkipped++;
            } else {
              errors.push({
                subscriptionId: sub.id,
                subscriptionNumber: sub.subscription_number,
                error: res.error || "Unknown billing error",
              });
            }
            break; // Stop catch-up on error
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          errors.push({
            subscriptionId: sub.id,
            subscriptionNumber: sub.subscription_number,
            error: errMsg,
          });
          break;
        }

        catchUpCount++;
      }
    }
  }

  const finalStatus =
    errors.length > 0 ? "completed_with_errors" : "completed";
  const completedAt = new Date().toISOString();

  // Update billing_runs table
  if (runId) {
    try {
      await supabase
        .from("billing_runs")
        .update({
          status: finalStatus,
          completed_at: completedAt,
          subscriptions_checked: subscriptionsChecked,
          invoices_created: invoicesCreated,
          invoices_skipped: invoicesSkipped,
          errors: errors,
        })
        .eq("id", runId);
    } catch (err) {
      console.error("Failed to update billing_run record:", err);
    }
  }

  return {
    runId,
    triggerSource,
    status: finalStatus,
    subscriptionsChecked,
    invoicesCreated,
    invoicesSkipped,
    expiredSubscriptionsClosed,
    errors,
  };
}
