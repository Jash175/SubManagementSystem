# 07 — Test Plan and Hackathon Demo

## 1. Required test layers

- **Unit tests:** password validator, billing interval arithmetic, variant price, tax/discount calculation, overdue predicate and status transition rules.
- **Database tests:** CHECK/UNIQUE/FK constraints, RLS allow/deny cases, payment transaction and duplicate billing guard.
- **API tests:** role authorization, validation errors, customer scoping and workflow state conflicts.
- **End-to-end test:** one complete customer subscription-to-payment scenario.
- **Performance test:** core lists and dashboard using seeded thousands of rows.

## 2. Critical test matrix

| ID | Scenario | Expected result |
|---|---|---|
| T-01 | Register with 8-character password | Reject. |
| T-02 | Register with 9+ chars but missing uppercase/lowercase/special | Reject. |
| T-03 | Register duplicate email | Auth rejects duplicate account. |
| T-04 | Customer requests another customer's invoice UUID | 404/403; no data leakage. |
| T-05 | Staff attempts staff invitation | 403. |
| T-06 | Staff attempts to create discount | 403. |
| T-07 | Admin creates Odoo variant delta 560 | Selected option increases line unit price by exactly 560 currency units. |
| T-08 | Plan quantity below minimum | Reject. |
| T-09 | Plan unavailable on selected start date | Reject. |
| T-10 | Quotation confirmed after valid-until date | Reject. |
| T-11 | Early close requested when flag false | Reject. |
| T-12 | Pause requested when flag false | Reject. |
| T-13 | Paused subscription reaches billing date | No invoice generated. |
| T-14 | Monthly next date from Jan 31 | Calendar month arithmetic returns last valid day in February and preserves anchor for next cycle (Jan 31 → Feb 28/29 → Mar 31). |
| T-15 | Run billing twice for same period | Exactly one subscription invoice. |
| T-16 | Two workers process same subscription concurrently | Row lock/unique index allows one invoice only. |
| T-17 | Discount date expired | Discount not applied. |
| T-18 | Discount max uses reached | Discount not applied. |
| T-19 | Two jobs race for final discount redemption | At most one receives remaining use. |
| T-20 | Product-scoped discount | Only eligible invoice line(s) are discounted. |
| T-21 | Subscription-scoped discount | Eligible subscription subtotal receives discount once. |
| T-22 | Product/tax catalogue changed after invoice issued | Historical invoice snapshot stays unchanged. |
| T-23 | Partial payment | Payment links to invoice; balance decreases; status stays confirmed. |
| T-24 | Payment equals remaining balance | Invoice status becomes paid and balance is zero. |
| T-25 | Payment greater than remaining balance | Reject atomically; no payment row written. |
| T-26 | Payment on draft/cancelled invoice | Reject. |
| T-27 | Invoice due date is yesterday and balance > 0 | Included in overdue report. |
| T-28 | Invoice due date is today | Not overdue under `< current_date` rule. |
| T-29 | Finance dashboard collected revenue | Equals sum of recorded payments for selected range. |
| T-30 | 5,000+ subscriptions and invoices seeded | Core pages use pagination/indexes; p95 target <2 seconds. |

## 3. Demonstration story (4–6 minutes)

1. **Admin setup:** sign in as admin; show product `Team Workspace`, add Brand = Odoo with +560, create monthly plan with minimum quantity and pause/renew policy, configure tax and a percentage discount with an end date/use limit.
2. **Quotation:** sign in as staff; choose a quotation template, select a customer, set quantity, show calculated variant price and quote expiry; send and confirm.
3. **Subscription:** show unique subscription number, line items, start/expiry dates, payment terms and status changes to active.
4. **Billing:** press Run due billing; open generated invoice; verify customer details, line snapshots, tax and discount; press Run again and show no duplicate invoice.
5. **Payment:** record a UPI/bank transfer payment; show invoice amount paid/balance/status and dashboard collected revenue/outstanding amount refresh.
6. **Customer portal:** sign in as the customer; show only that customer's subscription and invoice. Try an unrelated ID only in a controlled test environment to prove isolation.
7. **Finance lead:** show active subscriptions, collected revenue, overdue invoices, filters and a paginated list.

## 4. Demo seed data checklist

- One admin and one staff test account.
- Three customer accounts with distinct login emails.
- One product with base price and Odoo variant +560.
- Monthly, weekly and yearly plans (daily plan also available in the configuration form and tested in unit tests).
- One valid percentage discount and one expired/used-up discount.
- At least one active, paused, closed and future-start subscription.
- One due subscription and one not-yet-due subscription.
- Draft, confirmed, partially-paid, fully-paid, cancelled and overdue invoices.
- Payments with different methods and dates.

Do not use real customer personal or financial data in the demo.
