begin;

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='timeline') then raise exception 'lead timeline missing'; end if;
  if to_regclass('public.lead_property_matches') is null then raise exception 'lead_property_matches missing'; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_property_matches' and policyname='match_select') then raise exception 'match tenant select policy missing'; end if;
  if not exists (select 1 from pg_proc where proname='set_widget_lead_timeline') then raise exception 'widget timeline function missing'; end if;
end $$;

rollback;
