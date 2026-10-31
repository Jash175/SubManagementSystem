-- Brightloop Subscription Management System
-- Phase 3 Migration: Quotation Templates, Subscriptions, Lines, Events, and Lifecycle
-- Target: Supabase PostgreSQL

-- 1. Helper Function for Calendar-Safe Billing Dates

-- Monthly/yearly plans preserve the original start-day anchor:
-- Jan 31 -> Feb 28/29 -> Mar 31 (not Mar 28).
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
v_target_month := (
date_trunc('month', p_current_date::timestamp)
+ make_interval(months => p_interval_count)
)::date;
when 'yearly' then
v_target_month := make_date(
extract(year from p_current_date)::integer + p_interval_count,
p_anchor_month,
1
);
else
raise exception 'Unsupported billing interval unit: %', p_interval_unit;
end case;

v_last_day := extract(
day from (
date_trunc('month', v_target_month::timestamp)
+ interval '1 month - 1 day'
)
)::integer;

return date_trunc('month', v_target_month::timestamp)::date
+ (least(p_anchor_day::integer, v_last_day) - 1);
end;
$$;

grant execute on function
public.calculate_next_billing_date(date, text, integer, smallint, smallint)
to authenticated;

revoke execute on function
public.calculate_next_billing_date(date, text, integer, smallint, smallint)
from public, anon;

-- 2. Quotation Templates and Lines

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
unit_price_override numeric(14,2)
check (unit_price_override is null or unit_price_override >= 0),
created_at timestamptz not null default now(),
foreign key (product_id, variant_id)
references public.product_variants(product_id, id) on delete restrict
);

-- 3. Subscriptions, Lines, and Events

create table if not exists public.subscriptions (
id uuid primary key default gen_random_uuid(),
subscription_number text not null unique,
customer_id uuid not null references public.customers(id) on delete restrict,
plan_id uuid not null references public.plans(id) on delete restrict,
plan_name_snapshot text not null,
quotation_template_id uuid
references public.quotation_templates(id) on delete set null,
renewed_from_subscription_id uuid
references public.subscriptions(id) on delete restrict,
status text not null default 'draft'
check (status in ('draft', 'quotation', 'confirmed', 'active', 'paused', 'closed')),
start_date date not null,
expiry_date date,
quotation_valid_until date,
payment_terms_days integer not null default 0 check (payment_terms_days >= 0),
plan_price_snapshot numeric(14,2) not null check (plan_price_snapshot >= 0),
plan_quantity numeric(12,3) not null default 1 check (plan_quantity > 0),
currency_code char(3) not null default 'INR',
next_billing_date date,
billing_anchor_day smallint
generated always as (extract(day from start_date)::smallint) stored,
billing_anchor_month smallint
generated always as (extract(month from start_date)::smallint) stored,
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
subscription_id uuid not null
references public.subscriptions(id) on delete cascade,
product_id uuid not null references public.products(id) on delete restrict,
variant_id uuid,
description_snapshot text not null,
quantity numeric(12,3) not null check (quantity > 0),
unit_price numeric(14,2) not null check (unit_price >= 0),
line_subtotal numeric(16,2)
generated always as (round(quantity * unit_price, 2)) stored,
created_at timestamptz not null default now(),
foreign key (product_id, variant_id)
references public.product_variants(product_id, id) on delete restrict
);

create table if not exists public.subscription_events (
id uuid primary key default gen_random_uuid(),
subscription_id uuid not null
references public.subscriptions(id) on delete cascade,
from_status text,
to_status text not null,
action text not null,
note text,
actor_id uuid references public.profiles(id) on delete set null,
created_at timestamptz not null default now()
);

-- Create this helper only after public.subscriptions exists.
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
where s.id = p_subscription_id
and cu.user_id = auth.uid()
);
$$;

grant execute on function public.can_access_subscription(uuid) to authenticated;
revoke execute on function public.can_access_subscription(uuid) from public, anon;

-- Shared trigger function used to maintain updated_at timestamps.
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


-- 4. Triggers and Indexes

drop trigger if exists trg_quotation_templates_updated_at
on public.quotation_templates;

create trigger trg_quotation_templates_updated_at
before update on public.quotation_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated_at
on public.subscriptions;

create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create index if not exists idx_templates_active
on public.quotation_templates(is_active, name);

create index if not exists idx_template_lines_template
on public.quotation_template_lines(template_id);

create index if not exists idx_subscriptions_status_next_bill
on public.subscriptions(status, next_billing_date);

create index if not exists idx_subscriptions_customer_created
on public.subscriptions(customer_id, created_at desc);

create index if not exists idx_subscriptions_plan_status
on public.subscriptions(plan_id, status);

create index if not exists idx_subscription_lines_subscription
on public.subscription_lines(subscription_id);

create index if not exists idx_subscription_events_subscription_created
on public.subscription_events(subscription_id, created_at desc);

-- 5. Row-Level Security

alter table public.quotation_templates enable row level security;
alter table public.quotation_template_lines enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_lines enable row level security;
alter table public.subscription_events enable row level security;

grant select, insert, update, delete
on public.quotation_templates to authenticated;

grant select, insert, update, delete
on public.quotation_template_lines to authenticated;

grant select, insert, update, delete
on public.subscriptions to authenticated;

grant select, insert, update, delete
on public.subscription_lines to authenticated;

grant select, insert
on public.subscription_events to authenticated;

-- Quotation templates: Admin write, Staff read
drop policy if exists templates_staff_read on public.quotation_templates;
create policy templates_staff_read on public.quotation_templates
for select to authenticated
using (public.is_staff_or_admin());

drop policy if exists templates_admin_write on public.quotation_templates;
create policy templates_admin_write on public.quotation_templates
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Quotation template lines: Admin write, Staff read
drop policy if exists template_lines_staff_read on public.quotation_template_lines;
create policy template_lines_staff_read on public.quotation_template_lines
for select to authenticated
using (public.is_staff_or_admin());

drop policy if exists template_lines_admin_write on public.quotation_template_lines;
create policy template_lines_admin_write on public.quotation_template_lines
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Subscriptions: Staff/Admin access; customers access their own records
drop policy if exists subscriptions_scoped_read on public.subscriptions;
create policy subscriptions_scoped_read on public.subscriptions
for select to authenticated
using (
public.is_staff_or_admin()
or public.can_access_customer(customer_id)
);

drop policy if exists subscriptions_staff_insert on public.subscriptions;
create policy subscriptions_staff_insert on public.subscriptions
for insert to authenticated
with check (public.is_staff_or_admin());

drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_update on public.subscriptions
for update to authenticated
using (
public.is_staff_or_admin()
or (
public.can_access_customer(customer_id)
and status in ('active', 'paused', 'closed')
)
)
with check (
public.is_staff_or_admin()
or (
public.can_access_customer(customer_id)
and status in ('active', 'paused', 'closed')
)
);

drop policy if exists subscriptions_admin_delete on public.subscriptions;
create policy subscriptions_admin_delete on public.subscriptions
for delete to authenticated
using (public.is_admin());

-- Subscription lines: Staff/Admin write; customers read their own
drop policy if exists subscription_lines_scoped_read on public.subscription_lines;
create policy subscription_lines_scoped_read on public.subscription_lines
for select to authenticated
using (
public.is_staff_or_admin()
or public.can_access_subscription(subscription_id)
);

drop policy if exists subscription_lines_staff_write on public.subscription_lines;
create policy subscription_lines_staff_write on public.subscription_lines
for all to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

-- Subscription events: scoped read; staff or owning customer may insert
drop policy if exists subscription_events_scoped_read on public.subscription_events;
create policy subscription_events_scoped_read on public.subscription_events
for select to authenticated
using (
public.is_staff_or_admin()
or public.can_access_subscription(subscription_id)
);

drop policy if exists subscription_events_insert on public.subscription_events;
create policy subscription_events_insert on public.subscription_events
for insert to authenticated
with check (
public.is_staff_or_admin()
or public.can_access_subscription(subscription_id)
);

-- 6. Seed Data (Templates and Example Demonstration Records)

do $$
declare
v_plan_id uuid;
v_product_id uuid;
v_variant_id uuid;
v_template_id uuid;
begin
select id into v_plan_id
from public.plans
where plan_code = 'MONTHLY-TEAM'
limit 1;

select id into v_product_id
from public.products
where product_code = 'PRD-WORKSPACE'
limit 1;

if v_product_id is not null then
select id into v_variant_id
from public.product_variants
where product_id = v_product_id
and attribute_name = 'Brand'
and attribute_value = 'Odoo'
limit 1;
end if;

if v_plan_id is not null then
insert into public.quotation_templates (name, plan_id, validity_days, is_active)
values ('Team Workspace Onboarding', v_plan_id, 30, true)
on conflict do nothing
returning id into v_template_id;

if v_template_id is not null and v_product_id is not null then
insert into public.quotation_template_lines (
template_id,
product_id,
variant_id,
description,
quantity
)
values (
v_template_id,
v_product_id,
v_variant_id,
'Team Workspace with Odoo Brand Suite',
1
);
end if;
end if;
end;
$$;