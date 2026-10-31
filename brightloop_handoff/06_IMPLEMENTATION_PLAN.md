# 06 — Phased Implementation Plan (Hackathon Time-Box)

## Guiding strategy

Build a real vertical slice end to end, then complete the remaining required CRUD/workflows. Avoid polishing the dashboard while billing still does not work. Keep one deployable app and seed enough data for the judge's demonstration.

The time allocations below are a suggested **~5-hour emergency plan**, not a promise. If the actual time is shorter, protect the critical business flow and simplify visual polish, not database integrity.

## Phase 0 — Repo, environments and database foundation (30 min)

**Build:**
- Create Next.js app with TypeScript, Tailwind and App Router.
- Create Supabase project, set environment variables.
- Apply `sql/001_initial_schema.sql` and verify tables exist.
- Set up Supabase browser/server clients and Next.js 16 `proxy.ts` session refresh.
- Create layout, route groups and shared navigation.

**Exit gate:** app boots locally, Supabase connection works, migration applies cleanly, and no secret is exposed to the browser.

## Phase 1 — Authentication, roles and shell (35 min)

**Build:**
- Login, customer sign-up, logout and forgot-password flows.
- Password validation: min 9, uppercase, lowercase, special character.
- Registration creates profile (auth trigger), customer record and customer-user link.
- Admin/staff/customer route guards and RLS isolation.
- Admin staff invitation route (or a protected seed-admin + invite flow).
- Admin, staff and customer navigation shells.

**Exit gate:** create a customer login, sign in, and prove it cannot read another customer's records; staff cannot access admin-only actions.

## Phase 2 — Catalogue, plans, tax and discounts (45 min)

**Build:**
- Admin CRUD for products, variants and taxes.
- Admin CRUD for plans with all four billing units, minimum quantity, availability dates and lifecycle flags.
- Assign taxes to plans/products.
- Admin CRUD for discounts and eligible product mapping.
- Seed the `Odoo` variant with `price_delta = 560` for visible proof.

**Exit gate:** selecting a variant shows computed price; plan and discount constraints are validated.

## Phase 3 — Quotation templates and subscription lifecycle (55 min)

**Build:**
- Quotation template list/form with plan, lines and validity days.
- Create quotation from template and copy prices/line descriptions into snapshots.
- Subscription detail and list with status, dates, terms and event timeline.
- Actions: send quotation, confirm, activate, pause, resume, close and renew.
- Validate plan availability, minimum quantity, quotation expiry and lifecycle flags.

**Exit gate:** create a quotation for a customer, confirm it and see an active subscription with a next billing date.

## Phase 4 — Recurring billing, invoice lifecycle and payments (75 min)

**Build:**
- Period calculation for daily/weekly/monthly/yearly, including month-end and leap-year cases.
- `generate_due_invoices` database function/service with row locking, discount eligibility, tax snapshots and unique period guard.
- Billing run log and admin **Run due billing** button.
- Invoice list/detail; confirm, cancel, print and send.
- Atomic `record_payment` RPC wired to payment form.
- Schedule daily `pg_cron` only after manual billing passes.

**Exit gate:** run billing twice; only one invoice for a subscription period exists. Add payment; invoice status/balance updates correctly.

## Phase 5 — Customer portal and finance dashboard (40 min)

**Build:**
- Customer overview, own subscriptions, subscription detail and own invoices.
- Customer self-service buttons only where plan flags allow.
- Finance KPIs: active subscriptions, collected revenue, outstanding amount, overdue count/amount.
- Date filter and summary charts/tables.
- Server pagination and search for the main lists.

**Exit gate:** customer sees only own data; dashboard totals reconcile to payment/invoice rows.

## Phase 6 — QA, demo data and deployment (40 min)

**Build:**
- Run acceptance tests in `07_TEST_AND_DEMO_PLAN.md`.
- Seed a realistic dataset: 1 admin, 2 staff, 5 customers, 3 plans (monthly/annual/weekly), products/variants, one valid and one expired discount, active/paused/closed subscriptions, draft/confirmed/paid/overdue invoices and payments.
- Deploy to Vercel; connect Supabase production project.
- Add production environment variables; configure email sender and daily cron if time permits.
- Rehearse demo from a fresh login.

**Exit gate:** deployed URL loads; complete scenario can be demonstrated without manually editing the database during judging.

## Prioritisation if time collapses

### P0 — Cannot submit without these

- Auth + roles + customer data isolation.
- Products/variants/plans.
- Quotation → subscription transitions.
- Recurring invoice generation with period idempotency.
- Taxes and discount auto-application.
- Payment recording and invoice status/balance.
- Basic finance dashboard.

### P1 — Complete if at all possible

- Email invoice sending, print invoice.
- Customer portal with own invoices/subscriptions.
- Pause/resume/close/renew controls and plan flags.
- Staff invitation and reset-password email configured end to end.
- Filters and pagination.

### P2 — polish only after P0/P1

- Audit timeline UI, charts, export, notification center, advanced search, advanced tax/discount stacking, dunning, payment-gateway collection.

**Important:** P1 features include explicit PDF requirements too. This prioritisation is only an emergency build-order decision, not permission to omit them from the final scope if enough time remains.

## Suggested team split (if multiple developers)

| Workstream | Owner | Parallel dependency |
|---|---|---|
| Schema, auth, RLS, billing functions | Backend/database lead | Must define types/API early. |
| Catalog, plan, discount and quotation UI | Frontend/product lead | Uses migrations and API contracts. |
| Subscription, invoice, payment UI | Full-stack lead | Depends on lifecycle/billing contract. |
| Dashboard, customer portal and QA | Integrator | Can use seed data and stable endpoints. |

Assign one integrator to own `main`, migrations, environment settings and final deployment. Avoid multiple people editing the same SQL migration.
