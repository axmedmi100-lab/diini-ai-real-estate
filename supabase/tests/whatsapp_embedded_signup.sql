do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'integration_secrets'
  ) then raise exception 'integration_secrets table missing'; end if;

  if has_table_privilege('authenticated', 'public.integration_secrets', 'select') then
    raise exception 'authenticated users must not read encrypted integration secrets';
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'integration_secrets'
      and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'integration_secrets RLS is not forced'; end if;
end $$;

select 'WhatsApp Embedded Signup security test passed' as result;
