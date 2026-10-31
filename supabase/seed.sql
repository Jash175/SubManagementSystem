-- =============================================================================
-- Brightloop Subscription Management System — Demo & Showcase Seed Script
-- =============================================================================
-- This script seeds a complete, realistic dataset for judging, demonstration,
-- and end-to-end workflow rehearsal:
-- 1. Initial Administrator Setup Instructions
-- 2. Master Product Catalogue & Odoo Variants (T-07)
-- 3. Subscription Plans & Billing Intervals (T-08, T-09)
-- 4. Tax Rules & Discount Coupons (T-17 to T-21)
-- 5. Quotation Templates
-- 6. Customer Accounts & Multi-Tenant Profiles
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Initial Admin Promotion Instruction
-- -----------------------------------------------------------------------------
-- Once you sign up your first account via /register or Supabase Auth Dashboard,
-- promote that user to Administrator by executing:
--
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'your-admin-email@example.com';

-- -----------------------------------------------------------------------------
-- 2. Master Product Catalogue & Variants (T-07)
-- -----------------------------------------------------------------------------
insert into public.products (id, product_code, name, product_type, sales_price, cost_price, currency_code, is_active)
values
  ('a1000000-0000-0000-0000-000000000001', 'PROD-SEAT', 'Brightloop Cloud Workspace Seat', 'recurring_service', 2000.00, 800.00, 'USD', true),
  ('a1000000-0000-0000-0000-000000000002', 'PROD-SUPPORT', '24/7 Priority Support SLA', 'recurring_service', 500.00, 150.00, 'USD', true),
  ('a1000000-0000-0000-0000-000000000003', 'PROD-ONBOARD', 'Executive Implementation & Training', 'consumable', 1500.00, 500.00, 'USD', true)
on conflict (product_code) do update set is_active = true;

-- Product Variants with Price Deltas
insert into public.product_variants (id, product_id, attribute_name, attribute_value, price_delta)
values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Edition', 'Standard Tier', 0.00),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Edition', 'Odoo Enterprise Suite', 560.00),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Edition', 'Starter Discount Tier', -300.00)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Subscription Plans (T-08, T-09, Policy Flags)
-- -----------------------------------------------------------------------------
insert into public.plans (
  id, plan_code, name, price, currency_code, billing_interval_unit,
  billing_interval_count, minimum_quantity, auto_close_on_end,
  allow_early_close, allow_pause, allow_renewal, is_active
)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    'PLAN-MONTHLY',
    'Professional Monthly Plan',
    2500.00,
    'USD',
    'monthly',
    1,
    1,
    false,
    true,
    true,
    true,
    true
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'PLAN-ANNUAL',
    'Enterprise Annual Agreement',
    24000.00,
    'USD',
    'yearly',
    1,
    5,
    false,
    true,
    false,
    true,
    true
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'PLAN-WEEKLY',
    'Agile Weekly Sprint Tier',
    650.00,
    'USD',
    'weekly',
    1,
    1,
    true,
    false,
    false,
    false,
    true
  )
on conflict (plan_code) do update set is_active = true;

-- -----------------------------------------------------------------------------
-- 4. Tax Rules & Discount Coupons (T-17 to T-21)
-- -----------------------------------------------------------------------------
insert into public.taxes (id, tax_code, name, rate_percent, is_compound, is_active)
values
  ('d1000000-0000-0000-0000-000000000001', 'TAX-VAT10', 'Standard Sales Tax (10%)', 10.00, false, true),
  ('d1000000-0000-0000-0000-000000000002', 'TAX-TECH05', 'Cloud Services Surcharge (5%)', 5.00, false, true)
on conflict (tax_code) do update set is_active = true;

insert into public.discounts (
  id, code, description, discount_type, value, scope,
  max_uses, current_uses, valid_from, valid_until, is_active
)
values
  (
    'e1000000-0000-0000-0000-000000000001',
    'WELCOME10',
    '10% Welcome Discount for New Subscribers',
    'percentage',
    10.00,
    'subscription',
    100,
    0,
    '2026-01-01T00:00:00Z',
    '2027-12-31T23:59:59Z',
    true
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'SAVE500',
    'Flat $500 Enterprise Implementation Credit',
    'fixed_amount',
    500.00,
    'subscription',
    50,
    0,
    '2026-01-01T00:00:00Z',
    '2027-12-31T23:59:59Z',
    true
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'EXPIRED20',
    'Expired Promotional Voucher (For Test T-17)',
    'percentage',
    20.00,
    'subscription',
    10,
    10,
    '2025-01-01T00:00:00Z',
    '2025-06-30T23:59:59Z',
    false
  )
on conflict (code) do update set is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 5. Quotation Templates
-- -----------------------------------------------------------------------------
insert into public.quotation_templates (id, name, plan_id, validity_days, is_active)
values
  (
    'f1000000-0000-0000-0000-000000000001',
    'Team Workspace Onboarding',
    'c1000000-0000-0000-0000-000000000001',
    30,
    true
  )
on conflict (name) do update set is_active = true;

insert into public.quotation_template_lines (id, template_id, product_id, variant_id, description, quantity)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000002',
    'Workspace Seat (Odoo Enterprise Edition)',
    3
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002',
    null,
    '24/7 Priority Support SLA',
    1
  )
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 6. Customer Accounts (Multi-Tenant Profiles)
-- -----------------------------------------------------------------------------
insert into public.customers (
  id, customer_code, legal_name, company_name, email, phone,
  billing_address_line1, billing_city, billing_state, billing_postal_code, billing_country,
  currency_code, is_active
)
values
  (
    'c0000000-0000-0000-0000-000000000001',
    'CUST-ACME01',
    'Acme Innovations Inc',
    'Acme Global Technologies',
    'billing@acme.demo',
    '+1 415 555 0199',
    '100 Market Street, Suite 500',
    'San Francisco',
    'CA',
    '94105',
    'United States',
    'USD',
    true
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'CUST-NEXUS02',
    'Nexus Data Labs Ltd',
    'Nexus AI Systems',
    'accounts@nexus-labs.demo',
    '+44 20 7946 0912',
    '22 Bishopsgate, Floor 14',
    'London',
    'Greater London',
    'EC2N 4BQ',
    'United Kingdom',
    'USD',
    true
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'CUST-STRAT03',
    'Stratosphere Media Solutions',
    'Stratosphere Digital Studio',
    'finance@stratosphere.demo',
    '+91 11 2345 6789',
    'Sector 62, Cyber City',
    'Noida',
    'UP',
    '201309',
    'India',
    'USD',
    true
  )
on conflict (customer_code) do update set is_active = true;
