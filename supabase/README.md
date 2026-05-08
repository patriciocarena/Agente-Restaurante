# Supabase migrations

This project does NOT use the Supabase CLI (Docker not available locally — see
RESEARCH.md A3, line 745). Migrations are applied manually via the Supabase
Dashboard SQL Editor.

## How to apply migration 0001

1. Open https://supabase.com/dashboard -> select project
2. Go to SQL Editor
3. Click "+ New query"
4. Paste the entire contents of `migrations/0001_initial_schema.sql`
5. Click "Run"
6. Expected output: 10 CREATE TABLE notices, 10 ALTER TABLE notices, 10 CREATE
   POLICY notices, 1 CREATE FUNCTION notice, 5 GRANT/REVOKE notices.

## How to enable the Custom Access Token Hook

After applying the migration:

1. Dashboard -> Authentication -> Hooks
2. Section "Custom Access Token"
3. Toggle "Enable"
4. Schema: `public`, Function: `custom_access_token_hook`
5. Save

This hook injects `restaurant_id` into the JWT `app_metadata` at login time,
enabling RLS policies to filter rows per tenant automatically.

## Additional dashboard configuration

### Email verification

- Dashboard -> Authentication -> Providers -> Email
- Confirm "Confirm email" toggle = ON (it should be ON by default)

### URL configuration

- Dashboard -> Authentication -> URL Configuration
- Site URL: `http://localhost:5173` (update to production URL after Plan 05 deploys)
- Redirect URLs: add `http://localhost:5173/auth/callback`

## How to verify (run in SQL Editor after applying migration 0001)

### 1. Verify all 10 tables have RLS enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'restaurants', 'menu_categories', 'menu_items',
    'option_groups', 'option_items', 'orders',
    'order_items', 'restaurant_counters',
    'restaurant_hours', 'subscriptions'
  )
ORDER BY tablename;
-- Expected: 10 rows, all with rowsecurity = true
```

### 2. Verify the Custom Access Token Hook function exists

```sql
SELECT proname FROM pg_proc WHERE proname = 'custom_access_token_hook';
-- Expected: 1 row
```

### 3. Verify tenant_isolation policies exist on all 10 tables

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
-- Expected: 10 rows, all with policyname = 'tenant_isolation'
```

## RLS isolation test

Run `tests/rls-tenant-isolation.sql` in the SQL Editor:

1. Run the SETUP block — it prints two UUIDs via `RAISE NOTICE`
2. Copy those UUIDs
3. Replace `<REST_A_UUID>` and `<REST_B_UUID>` placeholders in the ASSERTION blocks
4. Run the ASSERTION blocks
5. Every row must show `result = 'PASS'`
6. Run the CLEANUP block to remove test rows

## Environment variables (captured after project creation)

Store these in `.env.local` (git-ignored). Do NOT commit them.

| Variable | Where to find it |
|----------|------------------|
| `SUPABASE_URL` | Dashboard -> Project Settings -> API -> Project URL |
| `SUPABASE_ANON_KEY` | Dashboard -> Project Settings -> API -> anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard -> Project Settings -> API -> service_role secret |

Frontend uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (with `VITE_` prefix).
Backend (Railway) uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (no `VITE_` prefix).
The service_role key must NEVER appear in frontend code or the Vite bundle.
