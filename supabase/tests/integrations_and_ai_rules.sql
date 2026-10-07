begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_settings' and column_name = 'qualification_fields'
  ) then raise exception 'qualification_fields missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_settings' and column_name = 'hot_lead_rules'
  ) then raise exception 'hot_lead_rules missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_settings' and column_name = 'handoff_rules'
  ) then raise exception 'handoff_rules missing'; end if;
end $$;

do $$
declare missing_count integer;
begin
  select count(*) into missing_count
  from public.agencies a
  cross join (values ('website_ai'), ('email'), ('whatsapp'), ('voice'), ('facebook'), ('instagram')) p(provider)
  where not exists (
    select 1 from public.integrations i where i.agency_id = a.id and i.provider = p.provider
  );
  if missing_count <> 0 then raise exception 'default integration rows missing: %', missing_count; end if;
end $$;

rollback;
