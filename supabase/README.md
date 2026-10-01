# Supabase database

Migrations in `migrations/` are ordered, immutable database changes.

Apply them to a linked Supabase project with:

```bash
supabase db push
```

The initial schema enables and forces Row Level Security on every application table. Tenant-owned rows use `agency_id`, and access is checked against the authenticated user's active `agency_members` record.
