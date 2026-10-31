# Prompt for a coding AI continuing Brightloop

You are the senior full-stack engineer taking over the Odoo × Lucknow Hackathon project **Brightloop Subscription Management System**. Read every file in this handoff before coding, especially `AGENTS.md`, `01_PRODUCT_REQUIREMENTS.md`, `02_ARCHITECTURE.md`, `03_DATABASE_DESIGN.md`, `sql/001_initial_schema.sql`, `05_API_CONTRACT.md`, `06_IMPLEMENTATION_PLAN.md`, `08_BILLING_ALGORITHM.md`, `09_PROJECT_STRUCTURE.md`, and `10_TRACEABILITY_MATRIX.md`.

The supplied four-page problem statement is the source of truth. Implement all its explicit requirements. Do not silently drop any conditions. Treat recommendations/assumptions in the docs as implementation choices, not organizer requirements. The product is a real business application, not a static prototype.

**Final stack:** Next.js 16 App Router + TypeScript + Tailwind + shadcn/ui + Supabase Auth/PostgreSQL + Supabase Cron + Resend (invoice mail). Use the schema migration supplied. Do not introduce additional infrastructure unless a hard blocker requires it.

**First action:** inspect the existing repo. If empty, scaffold it as specified in `04_TECH_STACK.md`. Then apply the database migration and verify it. Work phase by phase in the order specified in `06_IMPLEMENTATION_PLAN.md`; do not generate the whole codebase blindly in one pass.

**Critical correctness requirements:**
- Only admin creates staff and discount rules.
- Customers see only their own data; enforce this on the server and with RLS.
- Password is minimum 9 characters and contains uppercase, lowercase and special characters.
- Product variant delta affects the persisted quote/subscription price.
- Keep issued invoice line/tax snapshots immutable.
- Recurring invoices are transactional and idempotent by subscription + billing period; use row locks and the unique period index.
- A paused subscription is not billed; expired plans follow their close policy.
- Discount usage limits are reserved atomically.
- Payment and invoice balance/status update are atomic; prevent overpayment.
- Money is decimal/NUMERIC, not JS floating point.
- Main pages are paginated; performance target is under 2 seconds.

Build a working vertical slice early: admin setup → staff quotation → active subscription → billing run → invoice → payment → dashboard → customer portal. Keep all user-visible controls functional. Run lint, type-check, tests and build after each phase. Report exactly what works, what remains, and which tests were actually run. Never claim untested security or performance.
