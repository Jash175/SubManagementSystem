-- Brightloop Subscription Management System
-- Phase 4 Migration: Invoices, Invoice Lines, Taxes, Payments, Discount Redemptions, Billing Runs, and Audit Logs
-- Target: Supabase PostgreSQL

-- -----------------------------------------------------------------------------
-- 1. Invoices Table & Idempotency Key
-- -----------------------------------------------------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete restrict,
  billing_period_start date,
  billing_period_end date,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'partially_paid', 'paid', 'cancelled', 'void')),
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

-- The final database-level idempotency guard: one recurring invoice per subscription + period.
create unique index if not exists uq_invoices_subscription_period
  on public.invoices (subscription_id, billing_period_start, billing_period_end)
  where subscription_id is not null;

create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Invoice Lines & Line Tax Snapshots (Immutable financial records)
-- -----------------------------------------------------------------------------

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
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
  invoice_line_id uuid not null references public.invoice_lines(id) on delete cascade,
  tax_id uuid references public.taxes(id) on delete set null,
  tax_name_snapshot text not null,
  rate_percent_snapshot numeric(7,4) not null check (rate_percent_snapshot >= 0 and rate_percent_snapshot <= 100),
  tax_amount numeric(14,2) not null check (tax_amount >= 0)
);

-- -----------------------------------------------------------------------------
-- 3. Payments Table
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 4. Discount Redemptions, Billing Runs, and Audit Logs
-- -----------------------------------------------------------------------------

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete restrict,
  amount numeric(16,2) not null check (amount >= 0),
  redeemed_at timestamptz not null default now(),
  unique (discount_id, invoice_id)
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
-- 5. Indexes for Performance & Filtering
-- -----------------------------------------------------------------------------

create index if not exists idx_invoices_status_due on public.invoices(status, due_date);
create index if not exists idx_invoices_customer_issued on public.invoices(customer_id, issued_at desc);
create index if not exists idx_invoices_subscription on public.invoices(subscription_id);
create index if not exists idx_invoice_lines_invoice on public.invoice_lines(invoice_id);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_paid_at on public.payments(paid_at desc);
create index if not exists idx_discount_redemptions_discount on public.discount_redemptions(discount_id, redeemed_at);
create index if not exists idx_billing_runs_started on public.billing_runs(started_at desc);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

-- -----------------------------------------------------------------------------
-- 6. Helper Functions & Security Definers
-- -----------------------------------------------------------------------------

-- Helper: Customer invoice access verification
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

grant execute on function public.can_access_invoice(uuid) to authenticated;
revoke execute on function public.can_access_invoice(uuid) from public, anon;

-- Atomic Payment Recording RPC
-- Locks invoice row FOR UPDATE, prevents overpayment, updates amount_paid and status atomically.
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
  v_new_amount_paid numeric(16,2);
  v_new_status text;
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

  if v_invoice.status in ('draft', 'cancelled', 'void') then
    raise exception 'Payments cannot be recorded on draft, cancelled, or void invoices. Invoice must be confirmed first.';
  end if;

  if v_invoice.balance_due <= 0 then
    raise exception 'Invoice is already fully paid';
  end if;

  if p_amount > v_invoice.balance_due then
    raise exception 'Payment amount (%) exceeds outstanding invoice balance (%)', p_amount, v_invoice.balance_due;
  end if;

  insert into public.payments (
    invoice_id, amount, payment_method, paid_at, note, reference_number, recorded_by
  ) values (
    p_invoice_id, p_amount, p_payment_method, coalesce(p_paid_at, now()),
    p_note, p_reference_number, auth.uid()
  ) returning id into v_payment_id;

  v_new_amount_paid := v_invoice.amount_paid + p_amount;
  if v_new_amount_paid >= v_invoice.total then
    v_new_status := 'paid';
  else
    v_new_status := 'partially_paid';
  end if;

  update public.invoices
  set amount_paid = v_new_amount_paid,
      status = v_new_status,
      updated_at = now()
  where id = p_invoice_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_data)
  values (
    auth.uid(),
    'payment.recorded',
    'invoice',
    p_invoice_id,
    jsonb_build_object(
      'payment_id', v_payment_id,
      'amount', p_amount,
      'method', p_payment_method,
      'new_status', v_new_status,
      'remaining_balance', v_invoice.total - v_new_amount_paid
    )
  );

  return v_payment_id;
end;
$$;

grant execute on function public.record_payment(uuid, numeric, text, timestamptz, text, text) to authenticated;
revoke execute on function public.record_payment(uuid, numeric, text, timestamptz, text, text) from public, anon;

-- -----------------------------------------------------------------------------
-- 7. Row Level Security Policies
-- -----------------------------------------------------------------------------

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_line_taxes enable row level security;
alter table public.payments enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.billing_runs enable row level security;
alter table public.audit_logs enable row level security;

-- Invoices: Staff/Admin full access; Customers read own records
create policy invoices_scoped_read on public.invoices
  for select to authenticated
  using (public.is_staff_or_admin() or public.can_access_customer(customer_id));

create policy invoices_staff_insert on public.invoices
  for insert to authenticated
  with check (public.is_staff_or_admin());

create policy invoices_staff_update on public.invoices
  for update to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

create policy invoices_admin_delete on public.invoices
  for delete to authenticated
  using (public.is_admin());

-- Invoice lines: Scoped read; Staff/Admin write
create policy invoice_lines_scoped_read on public.invoice_lines
  for select to authenticated
  using (public.is_staff_or_admin() or public.can_access_invoice(invoice_id));

create policy invoice_lines_staff_manage on public.invoice_lines
  for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- Invoice line taxes: Scoped read; Staff/Admin write
create policy invoice_line_taxes_scoped_read on public.invoice_line_taxes
  for select to authenticated
  using (
    public.is_staff_or_admin()
    or exists (
      select 1 from public.invoice_lines il
      where il.id = invoice_line_id and (public.is_staff_or_admin() or public.can_access_invoice(il.invoice_id))
    )
  );

create policy invoice_line_taxes_staff_manage on public.invoice_line_taxes
  for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- Payments: Scoped read; Staff/Admin insert; Admin update/delete
create policy payments_scoped_read on public.payments
  for select to authenticated
  using (public.is_staff_or_admin() or public.can_access_invoice(invoice_id));

create policy payments_staff_insert on public.payments
  for insert to authenticated
  with check (public.is_staff_or_admin());

create policy payments_admin_manage on public.payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Discount redemptions: Scoped read; Staff/Admin insert
create policy discount_redemptions_scoped_read on public.discount_redemptions
  for select to authenticated
  using (public.is_staff_or_admin() or public.can_access_invoice(invoice_id));

create policy discount_redemptions_staff_insert on public.discount_redemptions
  for insert to authenticated
  with check (public.is_staff_or_admin());

-- Billing runs: Staff/Admin read & write
create policy billing_runs_staff_read on public.billing_runs
  for select to authenticated
  using (public.is_staff_or_admin());

create policy billing_runs_staff_write on public.billing_runs
  for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- Audit logs: Staff/Admin read; Staff/Admin insert
create policy audit_logs_staff_read on public.audit_logs
  for select to authenticated
  using (public.is_staff_or_admin());

create policy audit_logs_staff_insert on public.audit_logs
  for insert to authenticated
  with check (public.is_staff_or_admin());
