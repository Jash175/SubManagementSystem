# SQL migrations

## Target

This migration targets Supabase PostgreSQL, because it references `auth.users`, `auth.uid()`, and Supabase roles (`anon`, `authenticated`, `service_role`). It is not a plain PostgreSQL migration for an arbitrary database without Supabase Auth.

## Apply

1. Create a Supabase project or start the local Supabase stack (`supabase start`).
2. Apply `001_initial_schema.sql` from the Supabase SQL editor or place it in `supabase/migrations/<timestamp>_initial_schema.sql` and run `supabase db push`.
3. Verify all tables and policies exist.
4. Register the first account through the app; the auth trigger creates its profile with role `customer`.
5. In a trusted SQL editor, promote only the intended first admin:

```sql
update public.profiles
set role = 'admin'
where email = 'the-admin-email@example.com';
```

Do not expose this update in an HTTP endpoint or commit a real admin email/credential.

## Important before production

- `generate_due_invoices()` is a documented implementation requirement but is not yet included in this schema baseline. Implement and test it according to `../08_BILLING_ALGORITHM.md` before scheduling it.
- `record_payment(...)`, `create_customer_account(...)`, `customer_subscription_action(...)` and `calculate_next_billing_date(...)` are included.
- Run RLS tests for admin, staff and at least two distinct customers. Supabase recommends testing allowed and denied SELECT/INSERT/UPDATE/DELETE access, not simply checking that policies exist.
- Service-role credentials bypass RLS and must remain server-only.
