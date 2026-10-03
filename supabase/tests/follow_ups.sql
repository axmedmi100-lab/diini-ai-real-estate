begin;
do $$
begin
  if to_regclass('public.follow_up_rules') is null then raise exception 'follow_up_rules missing'; end if;
  if to_regprocedure('public.process_due_follow_ups(integer)') is null then raise exception 'follow-up processor missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'follow_up_opted_out') then raise exception 'customer opt-out missing'; end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'follow_up_rules') then raise exception 'follow-up rule RLS missing'; end if;
end;
$$;
select 'follow-up automation database test passed' as result;
rollback;
