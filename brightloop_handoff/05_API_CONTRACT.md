# 05 — API Contract

**Base path:** `/api/v1`  
**Transport:** JSON over HTTPS. The browser uses the Supabase-authenticated session cookie. Route handlers verify the user and role before invoking a domain service. All IDs are UUIDs. All monetary amounts are decimal strings or JSON numbers parsed into decimal-safe values; never use JS floating point for financial calculations.

## 1. Response convention

Success:

```json
{ "data": {}, "meta": { "requestId": "..." } }
```

Error:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

Use HTTP status codes consistently: `200` read/update, `201` create, `204` successful delete/deactivation, `400` validation/business-rule failure, `401` unauthenticated, `403` unauthorized, `404` not found, `409` state/uniqueness conflict, `500` unexpected error.

List endpoints accept `page`, `pageSize` (cap 100), `q`, `sort`, and relevant filters. Return `meta.total`, `meta.page`, `meta.pageSize`.

## 2. Authentication

Supabase Auth SDK handles identity endpoints; do not duplicate passwords in application tables.

| Operation | Implementation |
|---|---|
| Register | Supabase `signUp`; server validates password policy; after confirmation/session, call `rpc/create_customer_account` to create customer contact and mapping. |
| Login/logout | Supabase Auth `signInWithPassword` / `signOut`. |
| Forgot password | Supabase Auth `resetPasswordForEmail`; email must be registered. |
| Update password | Supabase Auth `updateUser` after reset link/session. |
| Add staff | `POST /admin/staff/invite`; admin-only; server-side Supabase Auth Admin invitation and trusted role assignment. |
| Current user | `GET /auth/me`; returns profile role and customer identity if linked. |

## 3. Endpoint matrix

| Method + path | Role | Purpose |
|---|---|---|
| `GET /auth/me` | Any signed-in | Current profile and allowed app area. |
| `POST /admin/staff/invite` | Admin | Invite staff; never public self-registration as staff. |
| `GET/POST /customers` | Staff/Admin | Customer list/create. |
| `GET/PATCH /customers/:id` | Staff/Admin; customer reads own | Customer detail/update. |
| `GET/POST /products` | Admin write; staff read | Product catalogue. |
| `GET/PATCH /products/:id` | Admin write; staff read | Product detail/edit. |
| `POST /products/:id/variants` | Admin | Add variant and price delta. |
| `GET/POST /plans` | Admin write; staff read | Recurring plan configuration. |
| `GET/PATCH /plans/:id` | Admin write; staff read | Plan policy and cadence. |
| `GET/POST /taxes` | Admin write; staff read | Tax rules. |
| `PUT /products/:id/taxes` | Admin | Assign product taxes. |
| `PUT /plans/:id/taxes` | Admin | Assign plan taxes. |
| `GET/POST /quotation-templates` | Admin write; staff read | Template management. |
| `POST /subscriptions/from-template` | Staff/Admin | Create subscription quotation from template. |
| `GET /subscriptions` | Staff/Admin; customer own | Filtered subscription list. |
| `GET /subscriptions/:id` | Staff/Admin; customer own | Detail, lines and event timeline. |
| `POST /subscriptions/:id/send-quotation` | Staff/Admin | Mark/send quotation and set validity. |
| `POST /subscriptions/:id/confirm` | Staff/Admin | Confirm a still-valid quotation. |
| `POST /subscriptions/:id/activate` | Staff/Admin/system | Activate when start date is reached. |
| `POST /subscriptions/:id/pause` | Staff/Admin; customer if plan permits | Pause; store pause timestamp. |
| `POST /subscriptions/:id/resume` | Staff/Admin; customer if plan permits | Resume and shift next billing date. |
| `POST /subscriptions/:id/close` | Staff/Admin; customer if plan permits | Close subject to plan flags. |
| `POST /subscriptions/:id/renew` | Staff/Admin; customer if plan permits | Create linked renewal subscription. |
| `GET/POST /discounts` | Admin write; staff read | Discount rule management. |
| `PATCH /discounts/:id` | Admin | Edit/deactivate rule. |
| `GET /invoices` | Staff/Admin; customer own | Invoice list and filters. |
| `GET /invoices/:id` | Staff/Admin; customer own | Invoice detail, lines, taxes and payment summary. |
| `POST /invoices/:id/confirm` | Staff/Admin | Confirm generated draft invoice. |
| `POST /invoices/:id/cancel` | Staff/Admin | Cancel with reason; prevent cancellation when paid. |
| `POST /invoices/:id/send` | Staff/Admin | Email invoice using Resend and log result. |
| `GET /invoices/:id/print` | Staff/Admin; customer own | Print-optimised invoice page. |
| `POST /invoices/:id/payments` | Staff/Admin | Call atomic `record_payment` RPC. |
| `GET /payments` | Staff/Admin | Payment search/history. |
| `GET /reports/summary` | Staff/Admin | KPI aggregates with date filters. |
| `GET /reports/overdue-invoices` | Staff/Admin | Overdue invoice list. |
| `POST /billing/run` | Admin | Manual billing trigger; same idempotent service as scheduler. |
| `GET /billing/runs` | Staff/Admin | Billing execution history. |
| `GET /api/cron/billing` or DB Cron function | Scheduler secret / database | Protected daily scheduled billing. Do not expose as an unprotected public action. |

## 4. Important request payloads

### Create product

```json
{
  "productCode": "PRD-001",
  "name": "Team Workspace",
  "productType": "software",
  "salesPrice": "2000.00",
  "costPrice": "700.00",
  "currencyCode": "INR",
  "notes": "Team collaboration product"
}
```

### Create product variant

```json
{
  "attributeName": "Brand",
  "attributeValue": "Odoo",
  "priceDelta": "560.00"
}
```

### Create plan

```json
{
  "planCode": "MONTHLY-TEAM",
  "name": "Monthly Team",
  "price": "2500.00",
  "currencyCode": "INR",
  "billingIntervalUnit": "monthly",
  "billingIntervalCount": 1,
  "minimumQuantity": 1,
  "availableFrom": "2026-10-01",
  "availableUntil": null,
  "autoCloseOnEnd": false,
  "allowEarlyClose": true,
  "allowPause": true,
  "allowRenewal": true,
  "taxIds": []
}
```

### Create quotation from template

```json
{
  "customerId": "uuid",
  "templateId": "uuid",
  "startDate": "2026-11-01",
  "expiryDate": "2027-10-31",
  "planQuantity": 5,
  "paymentTermsDays": 15,
  "lines": [
    { "productId": "uuid", "variantId": "uuid-or-null", "quantity": 5, "unitPriceOverride": null }
  ]
}
```

The server must load the template, product, variant and plan from the database. Never trust a client-provided computed price, role, discount amount or tax amount.

### Record payment

```json
{
  "amount": "1000.00",
  "paymentMethod": "upi",
  "paidAt": "2026-10-31T10:30:00+05:30",
  "note": "First instalment",
  "referenceNumber": "BANK-REF-123"
}
```

### Report filters

`GET /reports/summary?from=2026-10-01&to=2026-10-31` returns active subscription count, collected revenue, invoiced total, outstanding amount and overdue invoice count/amount. Define timezone based on `company_settings.timezone`.

## 5. Service-layer rules

- Every write validates input using Zod on the server.
- Every route calls `requireUser()` and one of `requireAdmin()` / `requireStaffOrAdmin()` / `requireCustomerScope()`.
- For customer requests, derive customer ID from `customer_users` using the authenticated user. Never accept arbitrary `customerId` from the portal client.
- Price, tax and discount values are recalculated from stored configuration and persisted snapshots.
- All subscription status changes call a single state-transition service and insert `subscription_events`.
- All payments call the atomic database RPC; do not insert payment and update invoice in two independent API calls.
- Billing route and manual button call the same billing service/function.
