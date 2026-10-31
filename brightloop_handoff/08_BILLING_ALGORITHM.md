# 08 — Recurring Billing Algorithm (Implementation Contract)

This document defines the hardest business operation so a coding agent does not implement a fragile “find due rows then insert” loop.

## 1. Billing-date semantics

- `subscriptions.next_billing_date` means: **the start date of the next service period that must be invoiced**.
- The invoice period is half-open: `[billing_period_start, billing_period_end)`.
- `billing_period_start = next_billing_date` at processing time.
- `billing_period_end = calculate_next_billing_date(start, plan interval, anchor)`.
- After successful invoice insertion, set subscription `next_billing_date = billing_period_end`.
- When a subscription first becomes active, set `next_billing_date = start_date` (unless product owners explicitly decide first invoice is collected immediately on confirmation).
- Use date arithmetic in the business timezone. Billing dates are `DATE`; event timestamps are `TIMESTAMPTZ`.

The SQL migration provides `calculate_next_billing_date(...)`. It preserves the original anchor day for monthly/yearly plans. Example: a monthly plan starting on January 31 should cycle January 31 → February 28/29 → March 31, not drift to March 28.

## 2. Due-subscription query

Candidates:

```sql
select s.id
from public.subscriptions s
where s.status = 'active'
  and s.next_billing_date <= :as_of_business_date
order by s.next_billing_date, s.id;
```

Do not query only `status='confirmed'`; only active subscriptions are recurring-billing candidates. Future confirmed subscriptions are activated when their start date arrives.

## 3. Per-subscription transaction

Implement `generate_due_invoices()` as a PostgreSQL function/RPC or a server worker that performs each subscription period inside one transaction. Recommended transaction algorithm:

```text
for each candidate subscription id:
  BEGIN
    SELECT subscription + plan FOR UPDATE SKIP LOCKED
    if row not found: skip (another worker owns it)
    if status != active: skip
    if expiry_date < business_date and auto_close_on_end:
       set status=closed, closed_at=now; write subscription_event; COMMIT; continue
    if status != active or paused: COMMIT; continue

    while next_billing_date <= business_date and below catch-up limit:
       period_start = next_billing_date
       period_end = calculate_next_billing_date(period_start, plan interval, anchor)

       if expiry_date is not null and period_start > expiry_date:
          if auto_close_on_end: close and write event
          break

       check unique subscription + period invoice key
       if invoice already exists:
          -- Prior execution may have created the record before an old non-atomic
          -- implementation advanced the date. Do not create another invoice.
          advance next_billing_date to period_end
          continue

       load current plan and subscription line snapshots
       calculate pre-discount subtotal
       lock and validate one eligible discount rule, if present
       distribute discount across eligible line(s)
       snapshot tax names/rates and calculate tax per line
       insert draft invoice header + lines + invoice-line taxes
       insert discount_redemption if a discount was used
       advance subscription.next_billing_date to period_end
       write billing-run result / audit event
    COMMIT
  on error:
    ROLLBACK this subscription period
    record error and continue with next subscription
```

Use a catch-up bound (for example 12 periods in one run per subscription) to prevent one badly overdue subscription from monopolizing the job. Leave it due for a later run after the bound is reached; do not silently skip old periods.

## 4. Expiry and pause semantics

- Expiry date is inclusive as the final date the subscription may remain active.
- If `auto_close_on_end=true` (the explicit rule in this problem statement), close when `expiry_date < as_of_business_date`; do not generate a period whose start is after expiry. This is separate from Odoo's documented automatic closing around unpaid invoices.
- If auto-close is false, do not auto-close solely because expiry date passes; this is a plan-level business choice. Staff can close or renew according to configured policy.
- A paused subscription is never billed.
- This MVP uses one plan cadence per subscription; add mixed-cadence subscription items only if explicitly required.
- On pause, retain `next_billing_date` and store `paused_at`.
- On resume, shift `next_billing_date` forward by the elapsed paused calendar days, clear `paused_at`, and append lifecycle event. MVP has no proration.

## 5. Discount eligibility and usage reservation

At invoice generation time, evaluate rules in a deterministic order (`priority ASC`, then `created_at ASC`):

1. `is_active=true`.
2. Current business date is between `starts_on` and `ends_on`, inclusive.
3. A redemption count is below `max_uses` (or max is null).
4. Invoice subtotal meets `minimum_purchase_amount`.
5. Required quantity meets `minimum_quantity`. For product scope, quantity is summed only for eligible products; for subscription scope, sum the plan quantity plus invoice product quantities.
6. For product scope, discount is limited to the product IDs in `discount_products`. For subscription scope, it applies to whole eligible subscription subtotal.

Only one discount rule is applied per invoice in the MVP. Lock the chosen discount row `FOR UPDATE` before counting/reserving usage. Insert `discount_redemptions` in the same transaction as the invoice. The unique `(discount_id, invoice_id)` constraint prevents duplicate redemption.

For a product discount, reduce eligible invoice line(s). For a subscription-wide discount, allocate its amount proportionally across lines by pre-discount subtotal; assign rounding remainder to the final eligible line so the allocations sum exactly to the header discount. Do not allow any line discount to exceed line subtotal.

A fixed discount applies the configured amount, capped at eligible subtotal. A percentage discount uses `eligible_subtotal * value / 100`, rounded to the currency minor unit.

## 6. Tax calculation

MVP rule: percentage, tax-exclusive, non-compound taxes.

- Build each invoice line from the plan fee or subscription product line.
- Determine applicable tax set from `plan_taxes` for plan line and `product_taxes` for product lines.
- Apply tax to `line_subtotal - line_discount`.
- Store each tax row in `invoice_line_taxes` with the tax name and rate copied at invoice time.
- Sum line tax amounts into `invoice_lines.tax_amount`; sum all lines into invoice header `tax_total`.
- Header totals: `subtotal = sum(line subtotal)`, `discount_total = sum(line discount)`, `tax_total = sum(line tax)`, `total = subtotal - discount_total + tax_total`.
- Use decimal arithmetic and deterministic rounding. Never calculate invoice money in JS binary floating point.

## 7. Invoice creation and status

- Create recurring invoices as `draft`; staff confirms them after checking.
- Due date = business invoice date + subscription `payment_terms_days`.
- `confirm` changes draft to confirmed; `cancel` changes draft/confirmed to cancelled if no payment exists.
- `paid` is set only by payment recording when amount paid equals total.
- Overdue is computed, not persisted: confirmed + positive balance + due date before business current date.

If an invoice is cancelled, keep the cancelled invoice for audit history. A replacement/reissue flow is a separate explicit action; do not let every daily scheduler run recreate an intentionally cancelled invoice automatically.

## 8. Reliability, retries and concurrent calls

- Unique index `uq_invoices_subscription_period` is the final idempotency guard.
- Lock subscription row with `FOR UPDATE SKIP LOCKED` before reading/advancing `next_billing_date`.
- Insert invoice, invoice lines, tax snapshots, discount redemption and billing-date advance atomically.
- The manual admin button and scheduled job must call the same billing engine.
- A unique conflict is a safe duplicate indication, not a fatal global job error.
- A single subscription error must not roll back invoices already committed for other subscriptions.
- Log job summary and per-subscription errors in `billing_runs`.

## 9. Manual run UX

Admin dashboard exposes `Run due billing`. It should show a confirmation/summary such as:

- subscriptions checked
- invoices created
- already-processed periods skipped
- expired subscriptions closed
- subscriptions with errors

It must invoke the exact same backend operation as the scheduled job, not a second implementation.
