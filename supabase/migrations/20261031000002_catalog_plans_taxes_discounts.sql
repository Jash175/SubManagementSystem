-- Brightloop Subscription Management System
-- Phase 2 Migration: Products, Product Variants, Taxes, Plans, and Discounts
-- Target: Supabase PostgreSQL

-- -----------------------------------------------------------------------------
-- 1. Products and Variants Tables
-- -----------------------------------------------------------------------------

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  name text not null,
  product_type text not null check (product_type in ('software', 'service', 'physical', 'addon', 'other')),
  sales_price numeric(14,2) not null check (sales_price >= 0),
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  currency_code char(3) not null default 'INR',
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_code on public.products(product_code);
create index if not exists idx_products_active on public.products(is_active);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  attribute_name text not null,
  attribute_value text not null,
  price_delta numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, attribute_name, attribute_value),
  unique (product_id, id)
);

create index if not exists idx_product_variants_product on public.product_variants(product_id, is_active);

-- -----------------------------------------------------------------------------
-- 2. Taxes and Product Taxes Tables
-- -----------------------------------------------------------------------------

create table if not exists public.taxes (
  id uuid primary key default gen_random_uuid(),
  tax_code text not null unique,
  name text not null,
  rate_percent numeric(7,4) not null check (rate_percent >= 0 and rate_percent <= 100),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_taxes_active on public.taxes(is_active);

create table if not exists public.product_taxes (
  product_id uuid not null references public.products(id) on delete cascade,
  tax_id uuid not null references public.taxes(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (product_id, tax_id)
);

-- -----------------------------------------------------------------------------
-- 3. Subscription Plans and Plan Taxes Tables
-- -----------------------------------------------------------------------------

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique,
  name text not null,
  description text,
  price numeric(14,2) not null check (price >= 0),
  currency_code char(3) not null default 'INR',
  billing_interval_unit text not null check (billing_interval_unit in ('daily', 'weekly', 'monthly', 'yearly')),
  billing_interval_count integer not null default 1 check (billing_interval_count > 0),
  minimum_quantity numeric(12,3) not null default 1 check (minimum_quantity > 0),
  available_from date,
  available_until date,
  auto_close_on_end boolean not null default false,
  allow_early_close boolean not null default true,
  allow_pause boolean not null default false,
  allow_renewal boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (available_until is null or available_from is null or available_until >= available_from)
);

create index if not exists idx_plans_active_dates on public.plans(is_active, available_from, available_until);

create table if not exists public.plan_taxes (
  plan_id uuid not null references public.plans(id) on delete cascade,
  tax_id uuid not null references public.taxes(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (plan_id, tax_id)
);

-- -----------------------------------------------------------------------------
-- 4. Discounts and Discount Products Tables
-- -----------------------------------------------------------------------------

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  discount_code text not null unique,
  name text not null,
  scope text not null check (scope in ('product', 'subscription')),
  discount_type text not null check (discount_type in ('fixed', 'percentage')),
  value numeric(14,2) not null check (value > 0),
  currency_code char(3) not null default 'INR',
  minimum_purchase_amount numeric(14,2) not null default 0 check (minimum_purchase_amount >= 0),
  minimum_quantity numeric(12,3) not null default 0 check (minimum_quantity >= 0),
  starts_on date not null,
  ends_on date not null,
  max_uses integer check (max_uses is null or max_uses > 0),
  priority integer not null default 100,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (discount_type <> 'percentage' or value <= 100)
);

create index if not exists idx_discounts_dates_active on public.discounts(is_active, starts_on, ends_on);

create table if not exists public.discount_products (
  discount_id uuid not null references public.discounts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (discount_id, product_id)
);

-- -----------------------------------------------------------------------------
-- 5. Row Level Security Policies
-- -----------------------------------------------------------------------------

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.taxes enable row level security;
alter table public.product_taxes enable row level security;
alter table public.plans enable row level security;
alter table public.plan_taxes enable row level security;
alter table public.discounts enable row level security;
alter table public.discount_products enable row level security;

-- Grant access on tables to authenticated
grant select, insert, update on public.products to authenticated;
grant select, insert, update on public.product_variants to authenticated;
grant select, insert, update on public.taxes to authenticated;
grant select, insert, update, delete on public.product_taxes to authenticated;
grant select, insert, update on public.plans to authenticated;
grant select, insert, update, delete on public.plan_taxes to authenticated;
grant select, insert, update on public.discounts to authenticated;
grant select, insert, update, delete on public.discount_products to authenticated;

grant all privileges on public.products to service_role;
grant all privileges on public.product_variants to service_role;
grant all privileges on public.taxes to service_role;
grant all privileges on public.product_taxes to service_role;
grant all privileges on public.plans to service_role;
grant all privileges on public.plan_taxes to service_role;
grant all privileges on public.discounts to service_role;
grant all privileges on public.discount_products to service_role;

-- Products Policies: Staff/Admin read, Admin write
create policy products_select on public.products
  for select to authenticated
  using (public.is_staff_or_admin());

create policy products_admin_insert on public.products
  for insert to authenticated
  with check (public.is_admin());

create policy products_admin_update on public.products
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Product Variants Policies: Staff/Admin read, Admin write
create policy product_variants_select on public.product_variants
  for select to authenticated
  using (public.is_staff_or_admin());

create policy product_variants_admin_insert on public.product_variants
  for insert to authenticated
  with check (public.is_admin());

create policy product_variants_admin_update on public.product_variants
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Taxes Policies: Staff/Admin read, Admin write
create policy taxes_select on public.taxes
  for select to authenticated
  using (public.is_staff_or_admin());

create policy taxes_admin_insert on public.taxes
  for insert to authenticated
  with check (public.is_admin());

create policy taxes_admin_update on public.taxes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Product Taxes Policies: Staff/Admin read, Admin write
create policy product_taxes_select on public.product_taxes
  for select to authenticated
  using (public.is_staff_or_admin());

create policy product_taxes_admin_manage on public.product_taxes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Plans Policies: Staff/Admin read, Admin write
create policy plans_select on public.plans
  for select to authenticated
  using (public.is_staff_or_admin());

create policy plans_admin_insert on public.plans
  for insert to authenticated
  with check (public.is_admin());

create policy plans_admin_update on public.plans
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Plan Taxes Policies: Staff/Admin read, Admin write
create policy plan_taxes_select on public.plan_taxes
  for select to authenticated
  using (public.is_staff_or_admin());

create policy plan_taxes_admin_manage on public.plan_taxes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Discounts Policies: Staff/Admin read, Admin write (Admin-only rule creation)
create policy discounts_select on public.discounts
  for select to authenticated
  using (public.is_staff_or_admin());

create policy discounts_admin_insert on public.discounts
  for insert to authenticated
  with check (public.is_admin());

create policy discounts_admin_update on public.discounts
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Discount Products Policies: Staff/Admin read, Admin write
create policy discount_products_select on public.discount_products
  for select to authenticated
  using (public.is_staff_or_admin());

create policy discount_products_admin_manage on public.discount_products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. Initial Seed Data (Includes required Odoo brand variant example: +560)
-- -----------------------------------------------------------------------------

-- Seed default taxes
insert into public.taxes (tax_code, name, rate_percent)
values
  ('GST-18', 'GST 18%', 18.0000),
  ('GST-05', 'GST 5%', 5.0000),
  ('VAT-12', 'Value Added Tax 12%', 12.0000)
on conflict (tax_code) do nothing;

-- Seed default product: Team Workspace
insert into public.products (product_code, name, product_type, sales_price, cost_price, currency_code, notes)
values (
  'PRD-WORKSPACE',
  'Team Workspace',
  'software',
  2000.00,
  700.00,
  'INR',
  'Core team collaboration and workspace platform'
)
on conflict (product_code) do nothing;

-- Seed required Odoo brand variant adding 560
insert into public.product_variants (product_id, attribute_name, attribute_value, price_delta)
select p.id, 'Brand', 'Odoo', 560.00
from public.products p
where p.product_code = 'PRD-WORKSPACE'
on conflict (product_id, attribute_name, attribute_value) do update
set price_delta = 560.00;

-- Additional variant for testing: Standard
insert into public.product_variants (product_id, attribute_name, attribute_value, price_delta)
select p.id, 'Brand', 'Standard', 0.00
from public.products p
where p.product_code = 'PRD-WORKSPACE'
on conflict (product_id, attribute_name, attribute_value) do nothing;

-- Link GST-18 to Team Workspace product
insert into public.product_taxes (product_id, tax_id)
select p.id, t.id
from public.products p, public.taxes t
where p.product_code = 'PRD-WORKSPACE' and t.tax_code = 'GST-18'
on conflict do nothing;

-- Seed default plans
insert into public.plans (
  plan_code, name, description, price, currency_code,
  billing_interval_unit, billing_interval_count, minimum_quantity,
  available_from, available_until, auto_close_on_end, allow_early_close,
  allow_pause, allow_renewal, is_active
)
values
  (
    'MONTHLY-TEAM',
    'Monthly Team Subscription',
    'Monthly recurring workspace subscription plan',
    2500.00,
    'INR',
    'monthly',
    1,
    1,
    '2026-01-01',
    null,
    false,
    true,
    true,
    true,
    true
  ),
  (
    'ANNUAL-ENTERPRISE',
    'Annual Enterprise Subscription',
    'Yearly recurring enterprise plan with volume licensing',
    25000.00,
    'INR',
    'yearly',
    1,
    5,
    '2026-01-01',
    null,
    false,
    true,
    false,
    true,
    true
  ),
  (
    'WEEKLY-SPRINT',
    'Weekly Sprint Plan',
    'Weekly short-cycle subscription for agile teams',
    750.00,
    'INR',
    'weekly',
    1,
    1,
    '2026-01-01',
    null,
    false,
    true,
    true,
    true,
    true
  )
on conflict (plan_code) do nothing;

-- Link GST-18 to Monthly Team plan
insert into public.plan_taxes (plan_id, tax_id)
select pl.id, t.id
from public.plans pl, public.taxes t
where pl.plan_code = 'MONTHLY-TEAM' and t.tax_code = 'GST-18'
on conflict do nothing;

-- Seed default discounts: 1 active percentage, 1 active fixed
insert into public.discounts (
  discount_code, name, scope, discount_type, value, currency_code,
  minimum_purchase_amount, minimum_quantity, starts_on, ends_on,
  max_uses, priority, is_active
)
values
  (
    'LAUNCH20',
    'Launch Celebration 20% Off',
    'subscription',
    'percentage',
    20.00,
    'INR',
    2000.00,
    1,
    '2026-01-01',
    '2027-12-31',
    500,
    10,
    true
  ),
  (
    'WELCOME500',
    'Welcome Fixed 500 Discount',
    'product',
    'fixed',
    500.00,
    'INR',
    1500.00,
    1,
    '2026-01-01',
    '2027-12-31',
    1000,
    20,
    true
  )
on conflict (discount_code) do nothing;

-- Link WELCOME500 to PRD-WORKSPACE
insert into public.discount_products (discount_id, product_id)
select d.id, p.id
from public.discounts d, public.products p
where d.discount_code = 'WELCOME500' and p.product_code = 'PRD-WORKSPACE'
on conflict do nothing;
