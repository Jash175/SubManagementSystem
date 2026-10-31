-- Brightloop Subscription Management System
-- Phase 3 Fixes Migration: Customer Provisioning, Default Template Reactivation, and Template Permissions
-- Target: Supabase PostgreSQL

-- -----------------------------------------------------------------------------
-- 1. Reactivate the Default Quotation Template: "Team Workspace Onboarding"
-- -----------------------------------------------------------------------------

update public.quotation_templates
set is_active = true, updated_at = now()
where name = 'Team Workspace Onboarding';

-- -----------------------------------------------------------------------------
-- 2. Backfill Existing Registered Customer Profiles into public.customers
-- -----------------------------------------------------------------------------

do $$
declare
  r record;
  v_customer_id uuid;
  v_customer_code text;
begin
  for r in
    select p.id as user_id, p.email, p.full_name
    from public.profiles p
    left join public.customer_users cu on cu.user_id = p.id
    where p.role = 'customer' and cu.customer_id is null
  loop
    v_customer_code := 'CUST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    insert into public.customers (customer_code, legal_name, email, is_active)
    values (
      v_customer_code,
      coalesce(nullif(trim(r.full_name), ''), 'Subscriber'),
      r.email,
      true
    )
    returning id into v_customer_id;

    insert into public.customer_users (customer_id, user_id, is_primary)
    values (v_customer_id, r.user_id, true)
    on conflict do nothing;
  end loop;
end;
$$;

-- Seed a standard Enterprise demonstration customer account if no customers exist
insert into public.customers (customer_code, legal_name, company_name, email, phone, is_active)
values (
  'CUST-DEMO01',
  'Acme Global Corp',
  'Acme Technologies Pvt Ltd',
  'billing@acme-global.demo',
  '+91 98765 43210',
  true
)
on conflict (customer_code) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Update Auth Trigger to Automatically Provision Customer Accounts on Signup
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_customer_code text;
  v_full_name text;
  v_company_name text;
begin
  v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  v_company_name := nullif(trim(new.raw_user_meta_data ->> 'company_name'), '');

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    'customer'
  )
  on conflict (id) do nothing;

  -- Automatically provision customer account and mapping for customer role users
  v_customer_code := 'CUST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.customers (customer_code, legal_name, company_name, email, is_active)
  values (
    v_customer_code,
    coalesce(nullif(trim(v_full_name), ''), 'Subscriber'),
    v_company_name,
    coalesce(new.email, ''),
    true
  )
  returning id into v_customer_id;

  insert into public.customer_users (customer_id, user_id, is_primary)
  values (v_customer_id, new.id, true)
  on conflict do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Enable Staff & Admin to Update Template Activation Status
-- -----------------------------------------------------------------------------

drop policy if exists templates_admin_write on public.quotation_templates;
drop policy if exists templates_staff_admin_write on public.quotation_templates;

create policy templates_staff_admin_write on public.quotation_templates
  for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());
