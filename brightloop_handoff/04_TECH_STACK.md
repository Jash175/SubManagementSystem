# 04 — Final Technology Stack

## 1. Selected stack

| Layer | Choice | Use |
|---|---|---|
| Full-stack framework | **Next.js 16 App Router + React + TypeScript** | One application for UI, server rendering and API routes. |
| UI styling | **Tailwind CSS** | Fast, consistent responsive styling. |
| UI components | **shadcn/ui + Lucide React** | Accessible building blocks; keep components in the repository. |
| Forms and validation | **React Hook Form + Zod** | Typed forms and identical validation rules at client/server boundary. |
| Data access / auth SDK | **Supabase JS + `@supabase/ssr`** | Auth sessions, user-scoped server client and database queries/RPC. |
| Relational database | **Supabase PostgreSQL** | Durable source of truth, FK/CHECK/UNIQUE constraints, indexes, transactions and reporting queries. |
| Background schedule | **Supabase Cron (`pg_cron`)** | Daily job for due invoice generation/expiry processing. |
| Charts | **Recharts** | Finance dashboard visualisations. |
| Dates | **date-fns** | Billing date display/calculation helpers; database billing logic remains authoritative. |
| Email | **Resend** | Invoice sending; Supabase Auth handles reset/invitation email flow. |
| Invoice print | **Print-optimised invoice page** | Browser Print / Save as PDF. Avoid adding a heavyweight PDF engine unless required. |
| Testing | **Vitest + Playwright** | Domain/unit tests and end-to-end user journey tests. |
| Hosting | **Vercel + Supabase** | Deploy the Next.js app and managed Postgres/Auth. |

## 2. Why this stack

- **Fastest coherent full-stack route:** one TypeScript repository avoids coordinating separate React and Python deployments.
- **Managed foundation:** Supabase supplies full PostgreSQL, Auth, RLS and scheduled jobs, reducing infrastructure work.
- **Relational correctness:** subscriptions, invoices, invoice lines, taxes, discounts and payments have strong relationships and transactional rules; PostgreSQL is a better fit than a document-only database.
- **AI-friendly:** TypeScript types, route handlers, OpenAPI-like request boundaries and SQL migrations are easy for coding agents to navigate.
- **Demo-friendly:** Vercel and Supabase provide a straightforward deployment path; local development remains possible.

## 3. Required project dependencies

Core:

```bash
npx create-next-app@latest brightloop --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd brightloop
npm install @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers date-fns recharts lucide-react resend
npx shadcn@latest init
```

Testing (add after the basic app boots):

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom playwright @playwright/test
```

Use the current stable versions selected by the package manager at setup time; do not hard-pin stale version numbers in generated instructions.

## 4. Environment variables

Create `.env.local` (never commit it):

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only; never NEXT_PUBLIC_
RESEND_API_KEY=                     # server only
INVOICE_FROM_EMAIL=
CRON_SECRET=                         # protect any externally invoked cron route
```

Use the publishable/anon key in the browser client. Service-role key must only be imported by a server-only module for admin invitation or controlled scheduled tasks. Prefer user-session clients and RLS for normal user operations.

## 5. Supabase setup

1. Create a Supabase project.
2. Enable email/password authentication.
3. Set minimum password length to 9 if the project setting allows it; application-side validation must enforce uppercase, lowercase and special character as well.
4. Configure email delivery for password reset and staff invite.
5. Apply SQL migrations from `sql/` through Supabase CLI or SQL editor.
6. Register the initial admin account through the app, then promote that exact profile once using a trusted Supabase SQL editor session (see `sql/README.md`). Never expose this bootstrap operation in a public route.
7. For local/offline fallback, install Docker and Supabase CLI, run `supabase start`, then point Next.js environment variables at the local Supabase URL/keys. Pull the Docker images and npm dependencies before the event if internet reliability is uncertain.
8. Verify RLS and test every role policy.
9. Enable the `pg_cron` extension and schedule a daily call to the billing/expiry database function once that function is implemented.
10. Keep a manual **Run due billing** admin action for hackathon demonstration and recovery.

## 6. Important implementation notes

- In Next.js 16, use `proxy.ts` for Supabase session refresh; consult the current Supabase SSR guide because its API and Next.js file convention can change.
- `@supabase/ssr` uses cookie-based sessions. Verify the user on the server; do not treat `getSession()` alone as server-side identity verification.
- All customer-facing reads must be protected by RLS and explicit customer scoping.
- Do not use the service-role client for routine user requests; it bypasses RLS.
- Use Postgres RPC functions for atomic multi-row work (payment and recurring bill generation).
- The `pg_cron` function should process one subscription per transaction or in a small bounded batch. Record failures and retry safely.
- Invoice `send` action uses Resend and logs success/failure; invoice `print` action uses a print CSS view.
- No Stripe/Razorpay integration is included. Add only if organisers explicitly require online charge collection.

## 7. Free-tier and scheduling reality

The project can use hosted Supabase for fast collaboration/deployment and the Supabase CLI local stack as an offline fallback. Prepare and verify the local stack before relying on it during the event. Supabase Cron is the selected scheduler because its documented model can execute SQL/functions directly in PostgreSQL. Always expose an admin manual billing action for a reliable live demo; the scheduled job is an additional automation path. The official Odoo × FLUX event page also recommends planning for local/offline operation as a nice-to-have.

## 8. Official documentation checked (31 Oct 2026)

- Next.js App Router: https://nextjs.org/docs/app
- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Next.js Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Supabase Next.js Auth tutorial: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- Supabase SSR Auth: https://supabase.com/docs/guides/auth/server-side
- Supabase database: https://supabase.com/docs/guides/database/overview
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Cron: https://supabase.com/docs/guides/cron
- Odoo × FLUX Lucknow Hackathon '26 expectations: https://hackathon.odoo.com/event/odoo-x-flux-lucknow-hackathon-26-36/register
- PostgreSQL constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
