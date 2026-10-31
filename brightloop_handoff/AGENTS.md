# Instructions for AI Coding Agents

You are continuing the Brightloop Subscription Management System hackathon implementation. Read `README.md`, `01_PRODUCT_REQUIREMENTS.md`, `02_ARCHITECTURE.md`, `03_DATABASE_DESIGN.md`, `04_TECH_STACK.md`, `05_API_CONTRACT.md`, `06_IMPLEMENTATION_PLAN.md` and `07_TEST_AND_DEMO_PLAN.md` before changing core code.

## Source-of-truth hierarchy

1. The user-provided `Subscription_Management_System.pdf` is authoritative for required features and conditions.
2. `01_PRODUCT_REQUIREMENTS.md` is the structured transcription of that brief. If it conflicts with the PDF, flag the conflict and follow the PDF.
3. `03_DATABASE_DESIGN.md` and `sql/001_initial_schema.sql` define the data model/invariants.
4. Other documents define recommended implementation choices. Do not silently turn recommendations into organizer requirements.

## Non-negotiable implementation rules

- Use TypeScript + Next.js App Router; use Supabase Auth/PostgreSQL.
- Keep a modular monolith. Do not introduce microservices, Kafka, Kubernetes, Celery or Redis without explicit approval. Keep the Supabase local stack option documented for an offline fallback.
- All business logic belongs in server-only domain modules/database functions, not React components.
- Do not trust roles, product prices, taxes, discounts, totals, customer IDs or permissions sent by the browser.
- Customer requests must derive their customer scope from the authenticated user's `customer_users` relation.
- Only admin may invite staff or create/edit discount rules.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` or cron secrets to the browser.
- Keep RLS enabled and test both allowed and denied access for admin, staff and customer.
- Never use floating point for money. Use PostgreSQL `NUMERIC` and decimal-safe arithmetic.
- Do not mutate issued invoice line/tax snapshots when product names/prices/tax rates change.
- Recurring invoice generation must be transactional, lock the subscription row, write the invoice and advance next billing date in one transaction, and rely on the unique subscription-period index as the final duplicate guard.
- A failed subscription's billing error must not stop other due subscriptions.
- Payment creation and invoice balance/status update must be one atomic operation. Prevent overpayment.
- All lifecycle state changes must be validated by a central transition function and recorded in `subscription_events`.
- Use server pagination for large lists; do not fetch all thousands of records to the browser.
- Never mark a feature complete while it is a static/mock button. Every visible action must work or be clearly disabled with a reason.

## Coding workflow

1. Inspect the existing repository before generating or replacing files.
2. Keep migrations additive. Never rewrite an already-applied migration; create a new migration.
3. Implement a vertical slice and test it before moving to the next module.
4. Run lint, type-check, unit tests and relevant database/RLS tests after each phase.
5. Keep `.env.local` out of Git. Update `.env.example` with variable names but no secrets.
6. Add realistic seed data only in a dedicated seed script; never hard-code demo credentials in production code.
7. Report what was actually implemented, what is incomplete, and any assumptions. Do not claim untested performance or security.

## Required build order

Follow `06_IMPLEMENTATION_PLAN.md`: foundation → auth/RBAC → catalogue/plans/taxes/discounts → quotations/subscriptions → billing/invoices/payments → customer portal/reports → tests/deploy.
