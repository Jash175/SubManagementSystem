# 09 — Recommended Source-Code Structure

Use this layout in the Next.js App Router project. Keep route components thin and place domain rules in server-only modules.

```text
brightloop/
├── AGENTS.md
├── AI_HANDOFF_PROMPT.md
├── README.md
├── .env.example
├── .gitignore
├── next.config.ts
├── proxy.ts                         # Next.js 16 Supabase cookie/session refresh
├── package.json
├── tsconfig.json
├── vercel.json                      # only if using Vercel Cron endpoint
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── seed.sql
│   └── tests/                       # RLS/pgTAP tests
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (admin)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── products/page.tsx
│   │   │   ├── plans/page.tsx
│   │   │   ├── taxes/page.tsx
│   │   │   ├── discounts/page.tsx
│   │   │   ├── staff/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── (workspace)/
│   │   │   ├── layout.tsx
│   │   │   ├── customers/page.tsx
│   │   │   ├── quotations/page.tsx
│   │   │   ├── subscriptions/page.tsx
│   │   │   ├── invoices/page.tsx
│   │   │   ├── payments/page.tsx
│   │   │   └── reports/page.tsx
│   │   ├── portal/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── subscriptions/page.tsx
│   │   │   └── invoices/page.tsx
│   │   ├── api/v1/
│   │   │   ├── auth/me/route.ts
│   │   │   ├── admin/staff/invite/route.ts
│   │   │   ├── customers/route.ts
│   │   │   ├── products/route.ts
│   │   │   ├── plans/route.ts
│   │   │   ├── taxes/route.ts
│   │   │   ├── discounts/route.ts
│   │   │   ├── quotations/route.ts
│   │   │   ├── subscriptions/route.ts
│   │   │   ├── invoices/route.ts
│   │   │   ├── payments/route.ts
│   │   │   ├── reports/summary/route.ts
│   │   │   └── billing/run/route.ts
│   │   ├── api/cron/billing/route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # role-aware landing/redirect
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── layout/                  # sidebar, header, breadcrumbs
│   │   ├── data-table/              # paginated table primitives
│   │   ├── forms/                   # shared form controls
│   │   └── invoices/                # invoice view and print stylesheet
│   ├── modules/
│   │   ├── auth/
│   │   ├── customers/
│   │   ├── catalog/
│   │   ├── plans/
│   │   ├── quotations/
│   │   ├── subscriptions/
│   │   ├── discounts/
│   │   ├── billing/
│   │   ├── invoices/
│   │   ├── payments/
│   │   ├── reports/
│   │   └── audit/
│   ├── lib/
│   │   ├── supabase/browser.ts
│   │   ├── supabase/server.ts
│   │   ├── supabase/admin.ts         # server-only; service key
│   │   ├── auth/guards.ts
│   │   ├── auth/password-policy.ts
│   │   ├── env.ts
│   │   ├── http/response.ts
│   │   ├── money/decimal.ts
│   │   └── utils.ts
│   └── types/
│       ├── database.types.ts         # generated from Supabase schema
│       └── domain.ts
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Module internal convention

Example `src/modules/billing/`:

```text
billing/
├── schemas.ts       # Zod input schemas
├── queries.ts       # due subscription and billing-run read queries
├── service.ts       # orchestration and error handling (server-only)
├── calculations.ts  # dates/discount/tax domain helpers (decimal-safe)
├── repository.ts    # database/RPC calls
└── types.ts
```

Use the same convention only where it provides value. Do not create empty files for every module on day one.

## Route and screen ownership

- `(admin)` is for master configuration and staff administration; admin-only UI should also be protected server-side.
- `(workspace)` is the internal team workspace for sales, subscriptions and finance.
- `/portal` is customer-facing and must be customer-scoped in the query and RLS policy.
- `/api/v1` is the stable application API boundary. It should not call arbitrary client-supplied SQL or accept computed totals.
- `/api/cron/billing` is only for an external scheduler if used. If Supabase Cron directly calls a database function, the route is unnecessary.

## Data loading convention

Prefer Server Components for initial page loads and Route Handlers/Server Actions for mutations. Use Client Components only where interaction is required. Every list is paginated server-side. Keep the Supabase service-role client in `lib/supabase/admin.ts` and mark the module server-only.
