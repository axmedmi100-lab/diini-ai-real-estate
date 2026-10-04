begin;
do $$ declare target_agency uuid; begin
  select id into target_agency from public.agencies limit 1;
  if target_agency is null then raise exception 'Agency fixture required'; end if;
  perform public.record_ai_usage(target_agency, 120, 40);
  perform public.record_ai_usage(target_agency, 80, 20);
  if not exists (
    select 1 from public.agency_usage_monthly
    where agency_id=target_agency and month_start=date_trunc('month',now())::date
      and ai_conversations >= 2 and ai_input_tokens >= 200 and ai_output_tokens >= 60
  ) then raise exception 'AI usage was not accumulated'; end if;
end $$;
rollback;
select 'usage metering test passed' as result;
