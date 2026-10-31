# Instructions for AI Coding Agents — Brightloop Subscription Management System

Brightloop is a full-stack subscription management platform being developed for the Odoo × Lucknow Hackathon. Multiple AI coding agents implement this project incrementally. All agents MUST adhere strictly to the conventions and rules documented below.

---

## 1. Finalized Technology Stack

- **Framework**: Next.js 16 with App Router (React 19, TypeScript in strict mode)
- **Styling**: Tailwind CSS (v4) with CSS variables
- **UI Components**: shadcn/ui components (`components/ui/`) + Lucide React icons
- **State & Forms**: React Hook Form with Zod validation schemas
- **Database & Auth**: Supabase PostgreSQL and Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`)
- **Package Manager**: npm

---

## 2. Project Folder Structure

```text
├── app/                  # Next.js App Router: layouts, pages, and API routes
├── components/
│   ├── ui/               # Reusable atomic UI components (shadcn/ui)
│   ├── layout/           # Application shell, sidebar, top navbar, mobile nav
│   └── shared/           # Shared reusable presentation components
├── features/             # Business domain feature modules
│   ├── auth/             # Authentication & session guards
│   ├── products/         # Products and variants catalog
│   ├── plans/            # Subscription plans & billing intervals
│   ├── customers/        # Customer profiles and user associations
│   ├── quotations/       # Quotation templates & quotation workflow
│   ├── subscriptions/    # Subscription lifecycle & state transitions
│   ├── billing/          # Recurring invoice generation engine
│   ├── payments/         # Payment recording & invoice settlement
│   ├── discounts/        # Discount rules & coupon eligibility
│   └── dashboard/        # Dashboard metrics and reports
├── lib/                  # Shared utilities and configuration
│   ├── supabase/         # Supabase browser, server, and admin clients
│   └── utils.ts          # Utility functions (e.g. cn)
├── types/                # Shared TypeScript types and interfaces
├── public/               # Static assets
└── docs/                 # Project documentation and specifications
```

---

## 3. Separation of Business Modules & Domain Logic Rules

1. **Business logic placement**:
   - All domain rules, validations, financial calculations, state transitions, and database queries MUST be encapsulated inside the corresponding `features/<module>` directory or in server-side services (`lib/`).
   - Do NOT place business logic or database queries directly inside React UI components or generic utility files.
2. **Server-only security boundaries**:
   - Client components MUST NEVER access sensitive environment variables.
   - `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `CRON_SECRET` must strictly remain server-only (`server-only` import or API route handlers / Server Actions).
   - Never trust input from the client: validate all request bodies with Zod schemas on the server.
3. **Financial and Transactional Invariants**:
   - Never use IEEE 754 floating point arithmetic for money. Use PostgreSQL `NUMERIC` and decimal-safe calculations.
   - Issued invoice lines and tax snapshots must be immutable once created.
   - Billing runs must be transactional and idempotent, using row locking and period uniqueness to prevent duplicate invoices.
   - Payment recording and invoice settlement must be atomic to prevent overpayment.
4. **Offline / Safe Runnable State**:
   - The application must boot and run even when Supabase credentials are not configured in local environment variables (graceful fallback/indicators).

---

## 4. Coding Workflow

1. Inspect existing files before generating or replacing code.
2. Maintain strict TypeScript types without using `any`.
3. Run linting (`npm run lint`) and build (`npm run build`) before considering any task or phase complete.
4. Keep `.env.local` strictly out of version control; only commit changes to `.env.example`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
