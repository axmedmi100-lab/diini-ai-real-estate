begin;

do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'leads' and indexname = 'leads_agency_status_idx') then
    raise exception 'lead status index is missing';
  end if;

  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname like 'tenant_%') <> 4 then
    raise exception 'lead tenant policies are incomplete';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'customer_id'
  ) then
    raise exception 'lead customer linkage is missing';
  end if;
end;
$$;

select 'lead CRM test passed' as result;

rollback;
