begin;

do $$
declare
  target_agency uuid := (select id from public.agencies order by created_at limit 1);
  before_messages integer;
begin
  if target_agency is null then
    raise notice 'WhatsApp test skipped: no agency fixture';
    return;
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'whatsapp_webhook_events'
  ) then raise exception 'WhatsApp webhook event table missing'; end if;

  select coalesce(whatsapp_messages, 0) into before_messages
  from public.agency_usage_monthly
  where agency_id = target_agency and month_start = date_trunc('month', now())::date;
  before_messages := coalesce(before_messages, 0);

  perform public.record_whatsapp_usage(target_agency, 2);
  if not exists (
    select 1 from public.agency_usage_monthly
    where agency_id = target_agency
      and month_start = date_trunc('month', now())::date
      and whatsapp_messages >= before_messages + 2
  ) then raise exception 'WhatsApp usage was not accumulated'; end if;

  insert into public.whatsapp_webhook_events (provider_message_id, agency_id)
  values ('phase7-test-message', target_agency);
  begin
    insert into public.whatsapp_webhook_events (provider_message_id, agency_id)
    values ('phase7-test-message', target_agency);
    raise exception 'duplicate webhook event was accepted';
  exception when unique_violation then null;
  end;
end $$;

rollback;

select 'phase 7 WhatsApp foundation test passed' as result;
