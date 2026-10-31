# 01 — Product Requirements and Business Rules

## 1. Product definition

Brightloop Subscription Management System is a unified operational platform for a business that sells software/services on recurring plans. It replaces spreadsheet-based subscription tracking, manually remembered renewals, hand-written invoices, manual bank-statement matching and manually prepared revenue reports.

## 2. User roles and permissions

| Capability | Admin | Internal staff | Customer |
|---|---:|---:|---:|
| View operational dashboard | Yes | Yes | No (customer portal instead) |
| Create/edit products, variants, plans and tax rules | Yes | No | No |
| Create/edit discount rules | Yes | No | No |
| Invite/add internal staff | Yes | No | No |
| Manage customer records | Yes | Yes | Own profile only |
| Create quotation from template | Yes | Yes | No |
| Confirm/activate/close/pause/renew subscription | Yes | Yes, subject to rules | Only self-service actions explicitly enabled by plan |
| View subscriptions | All | All | Own only |
| Create/confirm/cancel/send/print invoices | Yes | Yes | View/print own invoices |
| Record payments | Yes | Yes | No (payment recording is staff-side in this scope) |
| View finance reports | Yes | Yes | No |

**Source requirement:** three roles exist; admin controls the whole system; staff have limited day-to-day access; customers see only their own subscriptions and invoices; only admin can add staff and create discount rules.

**Implementation interpretation:** staff may manage normal sales and billing operations but cannot change master configuration or create discounts. Customer pause/close/renew controls are shown only when the relevant plan permission allows them. The PDF does not explicitly say which customer actions must be self-service, so keep staff actions available and treat customer self-service actions as a controlled enhancement.

## 2A. Stakeholders and their outcomes

| Stakeholder | Main concern | Product outcome |
|---|---|---|
| Business administrator | Correct configuration and control | Safe master-data, pricing, tax, discount and staff administration. |
| Sales representative / internal staff | Customer and contract operations | Quick quotation creation, clear subscription status and low-effort billing operations. |
| Finance lead | Accurate, explainable financial position | Reconciled invoices/payments, outstanding and overdue views, collected-revenue reporting. |
| Customer / subscriber | Transparency and self-service | Secure portal to inspect and manage their own subscription and invoice records. |
| Operations / system owner (inferred) | Reliability and performance | Scheduled jobs, audit history, error visibility and responsive pages. |
| Hackathon evaluators (event context) | Working product and engineering quality | Real dynamic data, validation, clean UX, collaboration and a demonstrable end-to-end flow. |

The first four stakeholders are grounded in the supplied problem statement. Operations/system owner and evaluators are useful project-design stakeholders inferred from the need to operate and present the application.

## 3. Functional requirements

### FR-AUTH — Accounts and access

- Customer registration with email and password.
- Email is unique per account.
- Password length must be **more than 8 characters** (minimum 9) and contain uppercase, lowercase and special characters.
- Password reset link goes to registered email.
- Roles: `admin`, `staff`, `customer`.
- Only admin can create/invite staff.
- Customer data isolation: a customer can access only their own subscriptions and invoices.

### FR-CATALOG — Products, variants, plans and taxes

- Product fields: name, type, sales price, cost price and notes.
- Product variant support. Example in PDF: selecting brand `Odoo` adds `560` to the product price.
- Plan fields: price, billing frequency, minimum quantity, available-from and available-until dates.
- Required billing units: daily, weekly, monthly and yearly.
- Per-plan policy flags: automatic closure at end, early closure allowed, pause allowed, renewal allowed.
- Admin-configured tax rules applied automatically to invoices.

### FR-QUOTE-SUB — Quotations and subscriptions

- Quotation templates contain a default plan and predefined product lines.
- Template has a validity duration in days.
- Subscription has unique number, customer, plan, start date, expiry date, payment terms and line items.
- Line item fields: product, quantity, unit price, taxes and amount.
- Required status journey: `Draft → Quotation → Confirmed → Active → Closed`.
- Paused is an additional state needed to implement the explicitly requested pause operation.
- Team members can see current status.

### FR-BILLING — Recurring invoices

- Generate invoices from active subscriptions when their billing date is due.
- Invoice is prefilled with customer details, product/plan lines, taxes and totals.
- Automatically calculate taxes from configured rules.
- Staff can confirm, cancel, send or print invoices.
- Invoice states: `Draft → Confirmed → Paid`, with `Cancelled` as an operational terminal state because cancellation is explicitly allowed.
- No duplicate invoice for the same subscription billing period; no due period may silently be skipped.

### FR-DISCOUNT — Discounts

- Only admin creates rules.
- Types: fixed amount or percentage.
- Eligibility: minimum purchase and/or minimum quantity.
- Validity: start date and end date.
- Usage cap: maximum number of redemptions.
- Scope: specific product(s) or whole subscription.
- Automatically apply when an eligible next invoice is generated.
- Stop applying after expiry or exhaustion of allowed uses.

### FR-PAY — Payments

- Record method, amount, date and note.
- Link payment to the correct invoice.
- Show paid and outstanding invoices; make overdue invoices identifiable.
- Recommended implementation extension: allow partial payments and multiple payments per invoice. The PDF does not explicitly require partial payments, but the data model supports them.
- No payment gateway integration is required by the PDF.

### FR-REPORT — Reporting and performance

- Dashboard shows active subscriptions, revenue collected, payments and overdue invoices.
- Filters and summary view.
- Support thousands of subscriptions.
- Every page should respond in under two seconds.

## 4. Workflow and status definitions

### Subscription

| State | Meaning | Typical allowed next states |
|---|---|---|
| `draft` | Internal record being prepared | `quotation`, `closed` |
| `quotation` | Offer sent/available to customer; has validity date | `confirmed`, `closed` |
| `confirmed` | Customer accepted; start date may be in future | `active`, `closed` |
| `active` | Recurring billing can occur | `paused`, `closed` |
| `paused` | Temporarily suspended; billing is suppressed | `active`, `closed` |
| `closed` | Terminal; no future billing | — |

Status changes must happen through domain actions, not arbitrary edits from a generic form. Record each transition in `subscription_events`.

**Rules recommended for the MVP:**
- Confirmation is allowed only while quotation validity has not elapsed.
- A confirmed subscription becomes active when `start_date <= today`.
- Paused subscriptions are not billed.
- On resume, shift the next billing date forward by the paused duration; do not charge for the paused interval. No proration in the MVP.
- If plan policy permits automatic close and `expiry_date < today`, close the subscription before attempting billing.
- Early close, pause and renewal are rejected if their plan flags are false.
- Renewal creates a new subscription linked to the previous one, rather than reopening a closed financial history.

### Invoice

| State | Meaning |
|---|---|
| `draft` | Generated/prepared but not confirmed |
| `confirmed` | Issued and awaiting payment; may be partially paid |
| `paid` | Fully settled |
| `cancelled` | Voided; no further payment allocation |

An invoice is overdue when `status = confirmed`, `balance_due > 0`, and `due_date < current_date`. Do not store `overdue` as a separate status because it is time-derived.

## 5. Pricing, tax and discount calculation policy

These details are not fully specified by the PDF; the following deterministic MVP rules avoid ambiguity:

1. Product line price at quote time = product sales price + selected variant price delta, unless an authorized staff member explicitly overrides the price.
2. Persist the agreed unit price on the subscription line. Later catalogue price changes must not rewrite existing subscriptions or historical invoices.
3. Plan base price is a separate recurring invoice line; optional product/add-on lines are additional invoice lines.
4. Quantity must be at least the plan's `minimum_quantity`.
5. Compute discounts before tax. A product-scoped discount reduces only eligible product line(s); a subscription-scoped discount reduces the eligible invoice subtotal.
6. Use one discount rule per invoice in the MVP (no stacking). If multiple rules qualify, choose the highest-priority rule or the earliest-created eligible rule; use one deterministic ordering everywhere.
7. A fixed discount cannot reduce an eligible line/subtotal below zero. A percentage discount is clamped to 0–100%.
8. Tax rules are tax-exclusive percentage rates for the MVP. Store the tax name and rate on each invoice line as a historical snapshot.
9. Use `NUMERIC`, never floating-point types, for money. Round to the configured currency's minor unit.
10. Lock the discount row while reserving a redemption and enforce its usage cap within the same database transaction as invoice creation.

## 6. Explicit assumptions / questions not answered by the PDF

Do not claim these are PDF requirements. They are implementation defaults that can be changed if organizers clarify otherwise:

- Currency is not stated; make it configurable (INR is a sensible demo default).
- Tax jurisdictions, inclusive/exclusive rules, compound tax and tax rounding are not defined; MVP uses percentage, tax-exclusive rules.
- The exact meaning of plan price versus product line prices is not defined; this design models plan base price as a recurring line plus optional product lines.
- Customer self-service actions are not enumerated; restrict actions by plan flags.
- Pause/resume billing-date treatment is not specified; MVP freezes the schedule by shifting next bill date by pause duration.
- Proration, trials, refunds, chargebacks, auto-card collection, dunning and multi-currency FX are outside required scope.
- A customer may make a partial payment in the recommended data model, but the PDF only says record payments against invoices.

## 7. Acceptance criteria (minimum demoable)

- Duplicate registration email is rejected; invalid password is rejected; reset flow can send a reset email.
- Customer cannot load another customer's subscription/invoice by changing an ID in the URL or API payload.
- Staff cannot create staff or discounts; admin can.
- Product variant changes the displayed and persisted line price by its configured delta (demo with +560).
- Each supported plan cadence can calculate the next billing date correctly, including month-end dates.
- Plan minimum quantity and availability dates are enforced.
- Quotation template prepopulates plan and product lines; quotation expires after configured validity days.
- Subscription status transitions follow the documented state machine and are visible to staff.
- Pause prevents invoice generation; resume restores schedule.
- Two concurrent/retried billing runs cannot create two invoices for the same subscription period.
- One due period generates one invoice with correct customer, price, quantity, discount, tax and total snapshots.
- Expired/exhausted discounts are not applied; a valid redemption is counted exactly once.
- Invoice can be confirmed, cancelled, printed and sent by email.
- Payment is linked to the right invoice; fully paid invoice becomes `paid`; partial balance remains outstanding.
- Dashboard totals reconcile with invoice/payment records and overdue calculation.
- Key pages are paginated and use indexed query paths; test with at least 5,000 subscriptions/invoices and target p95 below 2 seconds in the chosen demo environment.


## 8. Competition delivery criteria (external research, not PDF requirements)

The official Odoo × FLUX Lucknow Hackathon '26 page additionally lists these event-level expectations:

- Must have: dynamic/real-time data rather than relying on static JSON beyond initial prototyping; responsive clean UI; robust input validation; intuitive navigation; proper Git/version-control collaboration.
- Nice to have: backend APIs and data modelling/local database; offline or local alternatives rather than depending entirely on cloud connectivity; understand/adapt AI-generated code; avoid technologies that add no practical value.
- It states that all programming languages are welcome; it does not mandate implementing the product inside Odoo.

These are hackathon delivery/judging guidance, not extra features in the subscription problem statement. Confirm the exact event instructions/email if the organisers provided a team-specific submission checklist.
