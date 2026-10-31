# 10 — Requirement Traceability Matrix

This matrix connects the PDF's scope to the implementation so no feature is lost between planning and coding. It is a development aid; requirement wording remains in `01_PRODUCT_REQUIREMENTS.md`.

| Requirement group | Main data tables | API / service | Main screen | Acceptance coverage |
|---|---|---|---|---|
| AUTH: unique email, password policy, reset | `auth.users`, `profiles` | Supabase Auth; password-policy validator | Login, Register, Forgot/Reset Password | T-01–T-03 |
| RBAC: admin/staff/customer; admin-only staff invite | `profiles`, `customer_users`, `audit_logs` | `/admin/staff/invite`, auth guards | Staff Management | T-04–T-06 |
| Customer profile and isolation | `customers`, `customer_users` | `/customers`, `create_customer_account` | Customers, Customer Portal | T-04 |
| Product name/type/sales/cost/notes | `products` | `/products` | Product Catalogue | General CRUD/API validation |
| Product variants and +560 price delta | `product_variants`, `subscription_lines` | Product variant service / quote calculator | Product form, Quotation builder | T-07 |
| Plans: price/cycle/min qty/availability/flags | `plans`, `plan_taxes`, `subscriptions` | `/plans`, plan eligibility service | Plan Management | T-08, T-09, T-11, T-12 |
| Quotation templates and validity | `quotation_templates`, `quotation_template_lines`, `subscriptions` | `/quotations`, create-from-template service | Quotation Templates, Quotation Builder | T-10 |
| Subscription identifiers, dates, payment terms, lines, statuses | `subscriptions`, `subscription_lines`, `subscription_events` | `/subscriptions`, lifecycle transition service, `customer_subscription_action` | Subscription List/Detail, Portal | T-10–T-12 |
| Recurring invoices and duplicate protection | `invoices`, `invoice_lines`, `invoice_line_taxes`, `billing_runs` | Billing engine / `generate_due_invoices()` | Billing Run, Invoice List/Detail | T-13–T-16 |
| Taxes | `taxes`, `product_taxes`, `plan_taxes`, `invoice_line_taxes` | Tax calculation service | Tax Rules, Invoice Detail | T-22 plus invoice calculation tests |
| Discounts: type, minimums, dates, max uses, scopes | `discounts`, `discount_products`, `discount_redemptions` | Discount eligibility/reservation service | Discount Management, Invoice Detail | T-17–T-21 |
| Invoice actions: confirm/cancel/send/print | `invoices`, `invoice_lines`, `audit_logs` | Invoice service, Resend adapter, print view | Invoice Detail | T-26 plus send/print smoke tests |
| Payment method/amount/date/note; invoice balance | `payments`, `invoices` | `record_payment(...)` RPC | Payment Form, Invoice Detail | T-23–T-25 |
| Finance summary, filters, overdue | `subscriptions`, `invoices`, `payments` | `/reports/summary`, `/reports/overdue-invoices` | Finance Dashboard, Reports | T-27–T-29 |
| Scale / under-two-second page target | Indexes on listed tables; aggregate queries | Paginated query services, DB aggregates | All list pages and Dashboard | T-30 |

## Requirement-to-role quick check

| Action | Admin | Staff | Customer |
|---|---:|---:|---:|
| Configure products/plans/taxes | Yes | Read | No |
| Add staff | Yes | No | No |
| Create discount rules | Yes | No | No |
| Create quotations / manage subscriptions | Yes | Yes | View and permitted self-service actions |
| Confirm/cancel/send/print invoices | Yes | Yes | View/print own invoices |
| Record payments | Yes | Yes | No |
| View dashboard and reports | Yes | Yes | Own portal summary only |

## Completion tracking

Update this matrix as implementation proceeds. A requirement is complete only when all three exist:

1. Real backend behavior (not static JSON or a decorative button).
2. Correct authorization and data validation.
3. A passing automated test or a repeatable manual acceptance test.
