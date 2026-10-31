-- Brightloop Subscription Management System
-- Phase 1 Migration: Authentication, Profiles, Roles, and Customer Data Isolation
-- Target: Supabase PostgreSQL (auth.users extension)

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Profiles Table (Extends Supabase auth.users)
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

-- Index for role-based lookups and active status
create index if not exists idx_profiles_role_active on public.profiles(role, is_active);

-- -----------------------------------------------------------------------------
-- 2. Customers and Customer-User Mapping Tables
-- -----------------------------------------------------------------------------

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

create index if not exists idx_customers_email on public.customers(email);

create table if not exists public.customer_users (
  customer_id uuid not null references public.customers(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (customer_id, user_id),
  unique (user_id)
);

-- -----------------------------------------------------------------------------
-- 3. Auth Trigger: Create Profile on Signup
-- User metadata may provide the display name, NEVER the role. Role is always 'customer'.
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
-- 4. Customer Onboarding RPC: Creates Customer and Maps User
-- -----------------------------------------------------------------------------

create or replace function public.create_customer_account(
  p_legal_name text,
  p_email text,
  p_company_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_customer_id uuid;
  v_customer_code text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure customer user link doesn't already exist
  if exists (select 1 from public.customer_users where user_id = v_user_id) then
    select customer_id into v_customer_id from public.customer_users where user_id = v_user_id;
    return v_customer_id;
  end if;

  -- Generate unique customer code
  v_customer_code := 'CUST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.customers (customer_code, legal_name, company_name, email)
  values (v_customer_code, coalesce(nullif(trim(p_legal_name), ''), 'Subscriber'), p_company_name, p_email)
  returning id into v_customer_id;

  insert into public.customer_users (customer_id, user_id, is_primary)
  values (v_customer_id, v_user_id, true);

  return v_customer_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Role & Permission Helper Functions (SECURITY DEFINER, empty search_path)
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

-- Grant execution to authenticated users
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_staff_or_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_customer(uuid) to authenticated;
grant execute on function public.create_customer_account(text, text, text) to authenticated;

revoke execute on function public.current_profile_role() from public, anon;
revoke execute on function public.is_staff_or_admin() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.can_access_customer(uuid) from public, anon;
revoke execute on function public.create_customer_account(text, text, text) from public, anon;

-- -----------------------------------------------------------------------------
-- 6. Row Level Security Policies
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_users enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert on public.customer_users to authenticated;

grant all privileges on all tables in schema public to service_role;
revoke all privileges on all tables in schema public from anon;

-- Profiles Policies
create policy profiles_select_self_or_staff on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff_or_admin());

create policy profiles_update_self_safe on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_profile_role());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Revoke general column updates on profiles: users can only update their own full_name.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Customers Policies
create policy customers_select on public.customers
  for select to authenticated
  using (public.is_staff_or_admin() or public.can_access_customer(id));

create policy customers_insert on public.customers
  for insert to authenticated
  with check (public.is_staff_or_admin());

create policy customers_update on public.customers
  for update to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- Customer Users Policies
create policy customer_users_select on public.customer_users
  for select to authenticated
  using (public.is_staff_or_admin() or user_id = auth.uid());

create policy customer_users_admin_staff on public.customer_users
  for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());
