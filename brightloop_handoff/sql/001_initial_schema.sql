-- Brightloop Subscription Management System
-- Target: Supabase PostgreSQL. Apply after creating a Supabase project.
-- Supabase Auth owns auth.users. This migration extends it with application profiles.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Identity and company settings
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'customer' check (role in ('admin', 'staff', 'customer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  id smallint primary key default 1 check (id = 1),
  company_name text not null default 'Brightloop Software',
  currency_code char(3) not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  invoice_prefix text not null default 'INV',
  subscription_prefix text not null default 'SUB',
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null unique,
  legal_name text not null,
  company_name text,
  email text not null unique,
  phone text,
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_state text,
  billing_postal_code text,
  billing_country text,
  currency_code char(3) not null default 'INR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_users (
  customer_id uuid not null references public.customers(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (customer_id, user_id),
  unique (user_id)
);

-- -----------------------------------------------------------------------------
-- Catalogue, taxes and recurring plans
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

create table if not exists public.product_taxes (
  product_id uuid not null references public.products(id) on delete restrict,
  tax_id uuid not null references public.taxes(id) on delete restrict,
  primary key (product_id, tax_id)
);

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

create table if not exists public.plan_taxes (
  plan_id uuid not null references public.plans(id) on delete restrict,
  tax_id uuid not null references public.taxes(id) on delete restrict,
  primary key (plan_id, tax_id)
);

-- -----------------------------------------------------------------------------
-- Quotation templates and subscription lifecycle
-- -----------------------------------------------------------------------------

create table if not exists public.quotation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_id uuid not null references public.plans(id) on delete restrict,
  validity_days integer not null check (validity_days > 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_template_lines (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.quotation_templates(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid,
  description text,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price_override numeric(14,2) check (unit_price_override is null or unit_price_override >= 0),
  created_at timestamptz not null default now(),
  foreign key (product_id, variant_id) references public.product_variants(product_id, id) on delete restrict
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscription_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  plan_name_snapshot text not null,
  quotation_template_id uuid references public.quotation_templates(id) on delete set null,
  renewed_from_subscription_id uuid references public.subscriptions(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'quotation', 'confirmed', 'active', 'paused', 'closed')),
  start_date date not null,
  expiry_date date,
  quotation_valid_until date,
  payment_terms_days integer not null default 0 check (payment_terms_days >= 0),
  plan_price_snapshot numeric(14,2) not null check (plan_price_snapshot >= 0),
  plan_quantity numeric(12,3) not null default 1 check (plan_quantity > 0),
  currency_code char(3) not null default 'INR',
  next_billing_date date,
  billing_anchor_day smallint generated always as (extract(day from start_date)::smallint) stored,
  billing_anchor_month smallint generated always as (extract(month from start_date)::smallint) stored,
  paused_at timestamptz,
  closed_at timestamptz,
  closure_reason text,
  confirmed_at timestamptz,
  activated_at timestamptz,
  auto_close_on_end boolean not null default false,
  allow_early_close boolean not null default true,
  allow_pause boolean not null default false,
  allow_renewal boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date is null or expiry_date >= start_date)
);

create table if not exists public.subscription_lines (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid,
  description_snapshot text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_subtotal numeric(16,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now(),
  foreign key (product_id, variant_id) references public.product_variants(product_id, id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Discounts
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
  check (ends_on >= starts_on),
  check (discount_type <> 'percentage' or value <= 100)
);

create table if not exists public.discount_products (
  discount_id uuid not null references public.discounts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  primary key (discount_id, product_id)
);

-- -----------------------------------------------------------------------------
-- Invoices, immutable line snapshots and payments
-- -----------------------------------------------------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete restrict,
  billing_period_start date,
  billing_period_end date,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'paid', 'cancelled')),
  issued_at timestamptz not null default now(),
  due_date date not null,
  currency_code char(3) not null default 'INR',
  subtotal numeric(16,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(16,2) not null default 0 check (discount_total >= 0),
  tax_total numeric(16,2) not null default 0 check (tax_total >= 0),
  total numeric(16,2) not null default 0 check (total >= 0),
  amount_paid numeric(16,2) not null default 0 check (amount_paid >= 0),
  balance_due numeric(16,2) generated always as (round(total - amount_paid, 2)) stored,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_total <= subtotal),
  check (amount_paid <= total),
  check (total = round(subtotal - discount_total + tax_total, 2)),
  check (
    (subscription_id is null and billing_period_start is null and billing_period_end is null)
    or
    (subscription_id is not null and billing_period_start is not null and billing_period_end is not null and billing_period_end > billing_period_start)
  )
);

-- The final idempotency guard: one recurring invoice for a subscription + period.
create unique index if not exists uq_invoices_subscription_period
  on public.invoices (subscription_id, billing_period_start, billing_period_end)
  where subscription_id is not null;

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  variant_id uuid,
  line_type text not null check (line_type in ('plan', 'product', 'other')),
  description_snapshot text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  subtotal numeric(16,2) generated always as (round(quantity * unit_price, 2)) stored,
  discount_amount numeric(16,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(16,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(16,2) generated always as (round(quantity * unit_price - discount_amount + tax_amount, 2)) stored,
  check (discount_amount <= round(quantity * unit_price, 2)),
  foreign key (product_id, variant_id) references public.product_variants(product_id, id) on delete restrict
);

create table if not exists public.invoice_line_taxes (
  id uuid primary key default gen_random_uuid(),
  invoice_line_id uuid not null references public.invoice_lines(id) on delete restrict,
  tax_id uuid references public.taxes(id) on delete set null,
  tax_name_snapshot text not null,
  rate_percent_snapshot numeric(7,4) not null check (rate_percent_snapshot >= 0 and rate_percent_snapshot <= 100),
  tax_amount numeric(14,2) not null check (tax_amount >= 0)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(16,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'bank_transfer', 'upi', 'card', 'cheque', 'other')),
  paid_at timestamptz not null default now(),
  note text,
  reference_number text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete restrict,
  amount numeric(16,2) not null check (amount >= 0),
  redeemed_at timestamptz not null default now(),
  unique (discount_id, invoice_id)
);

-- -----------------------------------------------------------------------------
-- Lifecycle, billing run and audit history
-- -----------------------------------------------------------------------------

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  from_status text,
  to_status text not null,
  action text not null,
  note text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null check (trigger_source in ('scheduled', 'manual', 'retry')),
  status text not null default 'running' check (status in ('running', 'completed', 'completed_with_errors', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  subscriptions_checked integer not null default 0,
  invoices_created integer not null default 0,
  invoices_skipped integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  initiated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes for common filters, joins and RLS checks
-- -----------------------------------------------------------------------------

create index if not exists idx_customer_users_user on public.customer_users(user_id);
create index if not exists idx_customers_name on public.customers using btree (legal_name);
create index if not exists idx_products_active_name on public.products(is_active, name);
create index if not exists idx_variants_product on public.product_variants(product_id, is_active);
create index if not exists idx_plans_active on public.plans(is_active, billing_interval_unit);
create index if not exists idx_templates_active on public.quotation_templates(is_active, name);
create index if not exists idx_subscriptions_status_next_bill on public.subscriptions(status, next_billing_date);
create index if not exists idx_subscriptions_customer_created on public.subscriptions(customer_id, created_at desc);
create index if not exists idx_subscriptions_plan_status on public.subscriptions(plan_id, status);
create index if not exists idx_subscription_lines_subscription on public.subscription_lines(subscription_id);
create index if not exists idx_discounts_active_dates on public.discounts(is_active, starts_on, ends_on);
create index if not exists idx_discount_redemptions_discount_date on public.discount_redemptions(discount_id, redeemed_at);
create index if not exists idx_invoices_status_due on public.invoices(status, due_date);
create index if not exists idx_invoices_customer_issued on public.invoices(customer_id, issued_at desc);
create index if not exists idx_invoices_subscription on public.invoices(subscription_id);
create index if not exists idx_invoice_lines_invoice on public.invoice_lines(invoice_id);
create index if not exists idx_invoice_line_taxes_line on public.invoice_line_taxes(invoice_line_id);
create index if not exists idx_payments_invoice_paid on public.payments(invoice_id, paid_at);
create index if not exists idx_payments_paid_at on public.payments(paid_at);
create index if not exists idx_subscription_events_subscription_created on public.subscription_events(subscription_id, created_at desc);
create index if not exists idx_billing_runs_started on public.billing_runs(started_at desc);
create index if not exists idx_audit_logs_entity_created on public.audit_logs(entity_type, entity_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Updated-at trigger
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Attach only to tables with updated_at.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'company_settings', 'customers', 'products', 'taxes', 'plans',
    'quotation_templates', 'subscriptions', 'invoices'
  ] loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end;
$$;

-- Calendar-safe next billing date. Monthly/yearly plans preserve the original
-- start-day anchor: Jan 31 -> Feb 28/29 -> Mar 31 (not Mar 28).
create or replace function public.calculate_next_billing_date(
  p_current_date date,
  p_interval_unit text,
  p_interval_count integer,
  p_anchor_day smallint,
  p_anchor_month smallint
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_target_month date;
  v_last_day integer;
begin
  if p_interval_count is null or p_interval_count <= 0 then
    raise exception 'Billing interval count must be positive';
  end if;
  case p_interval_unit
    when 'daily' then
      return p_current_date + p_interval_count;
    when 'weekly' then
      return p_current_date + (7 * p_interval_count);
    when 'monthly' then
      v_target_month := (date_trunc('month', p_current_date::timestamp)
        + make_interval(months => p_interval_count))::date;
    when 'yearly' then
      v_target_month := make_date(
        extract(year from p_current_date)::integer + p_interval_count,
        p_anchor_month,
        1
      );
    else
      raise exception 'Unsupported billing interval unit: %', p_interval_unit;
  end case;

  v_last_day := extract(day from (date_trunc('month', v_target_month::timestamp)
    + interval '1 month - 1 day'))::integer;
  return date_trunc('month', v_target_month::timestamp)::date
    + (least(p_anchor_day::integer, v_last_day) - 1);
end;
$$;

-- -----------------------------------------------------------------------------
-- Auth signup trigger. User metadata may fill the display name, never the role.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- RLS helper functions. SECURITY DEFINER avoids policy recursion; search_path is
-- pinned to empty and every object reference is schema-qualified.
-- -----------------------------------------------------------------------------

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true
  limit 1;
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_profile_role() in ('admin', 'staff'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

create or replace function public.can_access_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.customer_users cu
    where cu.customer_id = p_customer_id and cu.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_subscription(p_subscription_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.customer_users cu on cu.customer_id = s.customer_id
    where s.id = p_subscription_id and cu.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_invoice(p_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.invoices i
    join public.customer_users cu on cu.customer_id = i.customer_id
    where i.id = p_invoice_id and cu.user_id = auth.uid()
  );
$$;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_staff_or_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_customer(uuid) to authenticated;
grant execute on function public.can_access_subscription(uuid) to authenticated;
grant execute on function public.can_access_invoice(uuid) to authenticated;
grant execute on function public.calculate_next_billing_date(date, text, integer, smallint, smallint) to authenticated;
revoke execute on function public.current_profile_role() from public, anon;
revoke execute on function public.is_staff_or_admin() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.can_access_customer(uuid) from public, anon;
revoke execute on function public.can_access_subscription(uuid) from public, anon;
revoke execute on function public.can_access_invoice(uuid) from public, anon;
revoke execute on function public.calculate_next_billing_date(date, text, integer, smallint, smallint) from public, anon;

-- -----------------------------------------------------------------------------
-- Enable RLS on all public business tables
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.customers enable row level security;
alter table public.customer_users enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.taxes enable row level security;
alter table public.product_taxes enable row level security;
alter table public.plans enable row level security;
alter table public.plan_taxes enable row level security;
alter table public.quotation_templates enable row level security;
alter table public.quotation_template_lines enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_lines enable row level security;
alter table public.discounts enable row level security;
alter table public.discount_products enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_line_taxes enable row level security;
alter table public.payments enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.billing_runs enable row level security;
alter table public.audit_logs enable row level security;

-- RLS filters rows; SQL grants still control which operations are possible.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
revoke all privileges on all tables in schema public from anon;

-- Profiles: users read/update their own non-role profile fields; admins manage all.
create policy profiles_select_self_or_staff on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff_or_admin());
create policy profiles_update_self_safe on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_profile_role());
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Restrict direct authenticated profile edits to display name only; role, email and
-- active status are changed only by trusted server/admin operations.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Company settings.
create policy company_settings_staff_read on public.company_settings
  for select to authenticated using (public.is_staff_or_admin());
create policy company_settings_admin_write on public.company_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Customers and customer-user mapping.
create policy customers_scoped_read on public.customers
  for select to authenticated using (public.is_staff_or_admin() or public.can_access_customer(id));
create policy customers_staff_insert on public.customers
  for insert to authenticated with check (public.is_staff_or_admin());
create policy customers_staff_update on public.customers
  for update to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy customers_admin_delete on public.customers
  for delete to authenticated using (public.is_admin());
create policy customer_users_scoped_read on public.customer_users
  for select to authenticated using (public.is_staff_or_admin() or user_id = auth.uid());
create policy customer_users_staff_manage on public.customer_users
  for all to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- Catalogue/configuration: staff may read; only admin can write.
create policy products_staff_read on public.products for select to authenticated using (public.is_staff_or_admin());
create policy products_admin_write on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy variants_staff_read on public.product_variants for select to authenticated using (public.is_staff_or_admin());
create policy variants_admin_write on public.product_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy taxes_staff_read on public.taxes for select to authenticated using (public.is_staff_or_admin());
create policy taxes_admin_write on public.taxes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_taxes_staff_read on public.product_taxes for select to authenticated using (public.is_staff_or_admin());
create policy product_taxes_admin_write on public.product_taxes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy plans_staff_read on public.plans for select to authenticated using (public.is_staff_or_admin());
create policy plans_admin_write on public.plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy plan_taxes_staff_read on public.plan_taxes for select to authenticated using (public.is_staff_or_admin());
create policy plan_taxes_admin_write on public.plan_taxes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy templates_staff_read on public.quotation_templates for select to authenticated using (public.is_staff_or_admin());
create policy templates_admin_write on public.quotation_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy template_lines_staff_read on public.quotation_template_lines for select to authenticated using (public.is_staff_or_admin());
create policy template_lines_admin_write on public.quotation_template_lines for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Subscriptions and their lines.
create policy subscriptions_scoped_read on public.subscriptions
  for select to authenticated using (public.is_staff_or_admin() or public.can_access_customer(customer_id));
create policy subscriptions_staff_insert on public.subscriptions
  for insert to authenticated with check (public.is_staff_or_admin());
create policy subscriptions_staff_update on public.subscriptions
  for update to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy subscriptions_admin_delete on public.subscriptions
  for delete to authenticated using (public.is_admin());
create policy subscription_lines_scoped_read on public.subscription_lines
  for select to authenticated using (public.is_staff_or_admin() or public.can_access_subscription(subscription_id));
create policy subscription_lines_staff_write on public.subscription_lines
  for all to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- Discounts: staff can inspect/apply but only admin can configure.
create policy discounts_staff_read on public.discounts for select to authenticated using (public.is_staff_or_admin());
create policy discounts_admin_write on public.discounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy discount_products_staff_read on public.discount_products for select to authenticated using (public.is_staff_or_admin());
create policy discount_products_admin_write on public.discount_products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Invoices, lines, tax snapshots and payments.
create policy invoices_scoped_read on public.invoices
  for select to authenticated using (public.is_staff_or_admin() or public.can_access_customer(customer_id));
create policy invoices_staff_insert on public.invoices
  for insert to authenticated with check (public.is_staff_or_admin());
create policy invoices_staff_update on public.invoices
  for update to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy invoices_admin_delete on public.invoices
  for delete to authenticated using (public.is_admin());
create policy invoice_lines_scoped_read on public.invoice_lines
  for select to authenticated using (public.is_staff_or_admin() or public.can_access_invoice(invoice_id));
create policy invoice_lines_staff_write on public.invoice_lines
  for all to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy invoice_line_taxes_scoped_read on public.invoice_line_taxes
  for select to authenticated using (
    public.is_staff_or_admin() or exists (
      select 1 from public.invoice_lines il
      where il.id = invoice_line_taxes.invoice_line_id
        and public.can_access_invoice(il.invoice_id)
    )
  );
create policy invoice_line_taxes_staff_write on public.invoice_line_taxes
  for all to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy payments_scoped_read on public.payments
  for select to authenticated using (public.is_staff_or_admin() or public.can_access_invoice(invoice_id));
create policy payments_staff_insert on public.payments
  for insert to authenticated with check (public.is_staff_or_admin());

-- Redemptions and operational history.
create policy discount_redemptions_staff_read on public.discount_redemptions
  for select to authenticated using (public.is_staff_or_admin());
create policy discount_redemptions_admin_write on public.discount_redemptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy subscription_events_scoped_read on public.subscription_events
  for select to authenticated using (public.is_staff_or_admin() or public.can_access_subscription(subscription_id));
create policy subscription_events_staff_insert on public.subscription_events
  for insert to authenticated with check (public.is_staff_or_admin());
create policy billing_runs_staff_read on public.billing_runs
  for select to authenticated using (public.is_staff_or_admin());
create policy billing_runs_admin_write on public.billing_runs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated using (public.is_admin());
create policy audit_logs_staff_insert on public.audit_logs
  for insert to authenticated with check (public.is_staff_or_admin());

-- -----------------------------------------------------------------------------


-- Safe customer self-onboarding. Auth trigger has already created a customer
-- profile. This function creates exactly one customer record and links only the
-- currently authenticated user; it never accepts a user_id or role from client.
create or replace function public.create_customer_account(
  p_legal_name text,
  p_company_name text default null,
  p_phone text default null,
  p_billing_address_line1 text default null,
  p_billing_city text default null,
  p_billing_state text default null,
  p_billing_postal_code text default null,
  p_billing_country text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_email text;
begin
  if auth.uid() is null or coalesce(public.current_profile_role(), '') <> 'customer' then
    raise exception 'Only an authenticated customer can create a customer account' using errcode = '42501';
  end if;

  if exists (select 1 from public.customer_users cu where cu.user_id = auth.uid()) then
    raise exception 'This login is already linked to a customer account';
  end if;

  select p.email into v_email from public.profiles p where p.id = auth.uid();
  if v_email is null or length(trim(p_legal_name)) = 0 then
    raise exception 'A registered email and legal name are required';
  end if;

  insert into public.customers (
    customer_code, legal_name, company_name, email, phone,
    billing_address_line1, billing_city, billing_state,
    billing_postal_code, billing_country
  ) values (
    'CUS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    trim(p_legal_name), nullif(trim(p_company_name), ''), v_email, p_phone,
    p_billing_address_line1, p_billing_city, p_billing_state,
    p_billing_postal_code, p_billing_country
  ) returning id into v_customer_id;

  insert into public.customer_users (customer_id, user_id, is_primary)
  values (v_customer_id, auth.uid(), true);

  return v_customer_id;
end;
$$;

grant execute on function public.create_customer_account(text, text, text, text, text, text, text, text) to authenticated;
revoke execute on function public.create_customer_account(text, text, text, text, text, text, text, text) from public, anon;

-- Customer self-service actions. The function derives customer ownership from
-- auth.uid(), checks plan policy flags, and writes lifecycle history atomically.
create or replace function public.customer_subscription_action(
  p_subscription_id uuid,
  p_action text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_new_id uuid;
  v_new_start date;
  v_new_expiry date;
  v_paused_days integer;
begin
  if auth.uid() is null or coalesce(public.current_profile_role(), '') <> 'customer' then
    raise exception 'Only a customer account can use customer self-service actions' using errcode = '42501';
  end if;

  select s.* into v_sub
  from public.subscriptions s
  join public.customer_users cu on cu.customer_id = s.customer_id
  where s.id = p_subscription_id and cu.user_id = auth.uid()
  for update of s;

  if not found then
    raise exception 'Subscription not found' using errcode = 'P0002';
  end if;

  if p_action = 'pause' then
    if not v_sub.allow_pause or v_sub.status <> 'active' then
      raise exception 'This subscription cannot be paused';
    end if;
    update public.subscriptions set status = 'paused', paused_at = now() where id = v_sub.id;
    insert into public.subscription_events (subscription_id, from_status, to_status, action, actor_id)
    values (v_sub.id, v_sub.status, 'paused', 'customer_pause', auth.uid());
    return v_sub.id;

  elsif p_action = 'resume' then
    if v_sub.status <> 'paused' or v_sub.paused_at is null then
      raise exception 'This subscription is not paused';
    end if;
    v_paused_days := greatest(current_date - v_sub.paused_at::date, 0);
    update public.subscriptions
    set status = 'active',
        next_billing_date = case when next_billing_date is null then null else next_billing_date + v_paused_days end,
        paused_at = null
    where id = v_sub.id;
    insert into public.subscription_events (subscription_id, from_status, to_status, action, actor_id)
    values (v_sub.id, v_sub.status, 'active', 'customer_resume', auth.uid());
    return v_sub.id;

  elsif p_action = 'close' then
    if v_sub.status not in ('confirmed', 'active', 'paused') then
      raise exception 'This subscription cannot be closed from its current state';
    end if;
    if not v_sub.allow_early_close and (v_sub.expiry_date is null or v_sub.expiry_date >= current_date) then
      raise exception 'The plan does not allow early closure';
    end if;
    update public.subscriptions
    set status = 'closed', closed_at = now(), closure_reason = 'Customer requested closure', next_billing_date = null
    where id = v_sub.id;
    insert into public.subscription_events (subscription_id, from_status, to_status, action, actor_id)
    values (v_sub.id, v_sub.status, 'closed', 'customer_close', auth.uid());
    return v_sub.id;

  elsif p_action = 'renew' then
    if not v_sub.allow_renewal or v_sub.status not in ('active', 'closed') then
      raise exception 'This subscription cannot be renewed';
    end if;
    if v_sub.status = 'active' and v_sub.expiry_date is not null and v_sub.expiry_date >= current_date then
      v_new_start := v_sub.expiry_date + 1;
    elsif v_sub.status = 'active' then
      v_new_start := coalesce(v_sub.next_billing_date, current_date);
    else
      v_new_start := current_date;
    end if;
    if v_sub.expiry_date is null then
      v_new_expiry := null;
    else
      v_new_expiry := v_new_start + (v_sub.expiry_date - v_sub.start_date);
    end if;
    if exists (
      select 1 from public.plans p
      where p.id = v_sub.plan_id and (
        not p.is_active
        or v_sub.plan_quantity < p.minimum_quantity
        or (p.available_from is not null and v_new_start < p.available_from)
        or (p.available_until is not null and v_new_start > p.available_until)
      )
    ) then
      raise exception 'The plan is not available for the renewal start date';
    end if;

    insert into public.subscriptions (
      subscription_number, customer_id, plan_id, plan_name_snapshot,
      renewed_from_subscription_id, status, start_date, expiry_date,
      quotation_valid_until, payment_terms_days, plan_price_snapshot,
      plan_quantity, currency_code, auto_close_on_end, allow_early_close,
      allow_pause, allow_renewal, created_by
    ) values (
      'SUB-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      v_sub.customer_id, v_sub.plan_id, v_sub.plan_name_snapshot,
      v_sub.id, 'quotation', v_new_start, v_new_expiry,
      current_date + 7, v_sub.payment_terms_days, v_sub.plan_price_snapshot,
      v_sub.plan_quantity, v_sub.currency_code, v_sub.auto_close_on_end,
      v_sub.allow_early_close, v_sub.allow_pause, v_sub.allow_renewal, auth.uid()
    ) returning id into v_new_id;

    insert into public.subscription_lines (
      subscription_id, product_id, variant_id, description_snapshot, quantity, unit_price
    )
    select v_new_id, sl.product_id, sl.variant_id, sl.description_snapshot, sl.quantity, sl.unit_price
    from public.subscription_lines sl
    where sl.subscription_id = v_sub.id;

    insert into public.subscription_events (subscription_id, from_status, to_status, action, actor_id, note)
    values (v_new_id, null, 'quotation', 'customer_renewal_created', auth.uid(), 'Renewal quotation generated from prior subscription');
    return v_new_id;

  else
    raise exception 'Unsupported customer subscription action';
  end if;
end;
$$;

grant execute on function public.customer_subscription_action(uuid, text) to authenticated;
revoke execute on function public.customer_subscription_action(uuid, text) from public, anon;

-- Atomic payment recording. Call through authenticated Supabase RPC.
-- This function intentionally runs as invoker so table RLS remains in force.
-- -----------------------------------------------------------------------------

create or replace function public.record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_paid_at timestamptz default now(),
  p_note text default null,
  p_reference_number text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_payment_id uuid;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Only staff or admin can record payments' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_invoice.status not in ('confirmed', 'paid') then
    raise exception 'Only confirmed invoices can receive payments';
  end if;
  if p_amount > v_invoice.balance_due then
    raise exception 'Payment exceeds invoice balance';
  end if;
  if v_invoice.balance_due <= 0 then
    raise exception 'Invoice is already fully paid';
  end if;

  insert into public.payments (
    invoice_id, amount, payment_method, paid_at, note, reference_number, recorded_by
  ) values (
    p_invoice_id, p_amount, p_payment_method, coalesce(p_paid_at, now()),
    p_note, p_reference_number, auth.uid()
  ) returning id into v_payment_id;

  update public.invoices
  set amount_paid = amount_paid + p_amount,
      status = case when amount_paid + p_amount >= total then 'paid' else 'confirmed' end
  where id = p_invoice_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_data)
  values (
    auth.uid(), 'payment.recorded', 'invoice', p_invoice_id,
    jsonb_build_object('payment_id', v_payment_id, 'amount', p_amount, 'method', p_payment_method)
  );

  return v_payment_id;
end;
$$;

grant execute on function public.record_payment(uuid, numeric, text, timestamptz, text, text) to authenticated;
revoke execute on function public.record_payment(uuid, numeric, text, timestamptz, text, text) from public, anon;

-- IMPORTANT: Apply RLS policies and test them in Supabase. Admin-only background
-- billing should use a protected server-side function/worker; never expose the
-- service-role key to a browser. Implement generate_due_invoices() as one atomic
-- transaction per subscription billing period before enabling the cron schedule.
