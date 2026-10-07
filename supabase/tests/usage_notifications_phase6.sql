begin;

do $$
declare
  target_agency uuid := (select id from public.agencies order by created_at limit 1);
  before_cost numeric;
begin
  if target_agency is null then
    raise notice 'usage/notification test skipped: no agency fixture';
    return;
  end if;

  select coalesce(estimated_ai_cost_usd, 0) into before_cost
  from public.agency_usage_monthly
  where agency_id = target_agency and month_start = date_trunc('month', now())::date;
  before_cost := coalesce(before_cost, 0);

  perform public.record_ai_usage(target_agency, 100, 50, 0.0123);

  if not exists (
    select 1 from public.agency_usage_monthly
    where agency_id = target_agency
      and month_start = date_trunc('month', now())::date
      and estimated_ai_cost_usd >= before_cost + 0.0123
  ) then raise exception 'estimated AI cost was not accumulated'; end if;

  insert into public.notifications (agency_id, type, title, body)
  values (target_agency, 'phase6_test', 'Phase 6 test', 'Rollback-only notification fixture');

  if not exists (select 1 from public.notifications where agency_id = target_agency and type = 'phase6_test') then
    raise exception 'notification was not created';
  end if;
end $$;

rollback;

select 'phase 6 usage and notifications test passed' as result;
