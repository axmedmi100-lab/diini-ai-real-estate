begin;

alter table public.agency_subscriptions add column if not exists grace_period_end timestamptz;

create table public.subscription_automation_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  subscription_id uuid not null references public.agency_subscriptions(id) on delete cascade,
  event_key text not null check (event_key in ('renewal_7d','renewal_3d','renewal_1d','past_due','downgraded')),
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  unique(subscription_id,event_key,period_end)
);

alter table public.subscription_automation_events enable row level security;
alter table public.subscription_automation_events force row level security;
create policy subscription_events_tenant_select on public.subscription_automation_events for select to authenticated using (public.is_agency_member(agency_id));
create policy subscription_events_admin_select on public.subscription_automation_events for select to authenticated using (public.is_platform_super_admin());
create policy subscriptions_admin_select on public.agency_subscriptions for select to authenticated using (public.is_platform_super_admin());
revoke all on public.subscription_automation_events from anon,authenticated;
grant select on public.subscription_automation_events to authenticated;
grant all on public.subscription_automation_events to service_role;

create or replace function public.process_subscription_expiries()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  sub record;
  inserted_event uuid;
  reminder_count integer := 0;
  past_due_count integer := 0;
  downgraded_count integer := 0;
  days_left integer;
  event_name text;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;

  for sub in
    select s.id,s.agency_id,s.plan_code,s.status,s.current_period_end,s.grace_period_end
    from public.agency_subscriptions s
    where s.provider='manual' and s.current_period_end is not null and s.status in ('active','past_due')
    for update skip locked
  loop
    if sub.status='active' and sub.current_period_end > now() then
      days_left := ceil(extract(epoch from (sub.current_period_end-now()))/86400.0);
      event_name := case days_left when 7 then 'renewal_7d' when 3 then 'renewal_3d' when 1 then 'renewal_1d' else null end;
      if event_name is not null then
        inserted_event := null;
        insert into public.subscription_automation_events(agency_id,subscription_id,event_key,period_end)
        values(sub.agency_id,sub.id,event_name,sub.current_period_end)
        on conflict do nothing returning id into inserted_event;
        if inserted_event is not null then
          insert into public.notifications(agency_id,type,title,body,entity_type,entity_id)
          values(sub.agency_id,'subscription_renewal_reminder','Plan renewal ayaa soo dhow','Plan-ka '||sub.plan_code||' wuxuu dhacayaa '||days_left||' maalin gudahood. Fadlan cusboonaysii lacag-bixinta.','agency_subscription',sub.id);
          reminder_count := reminder_count+1;
        end if;
      end if;
    elsif sub.status='active' and sub.current_period_end <= now() then
      inserted_event := null;
      insert into public.subscription_automation_events(agency_id,subscription_id,event_key,period_end)
      values(sub.agency_id,sub.id,'past_due',sub.current_period_end)
      on conflict do nothing returning id into inserted_event;
      update public.agency_subscriptions set status='past_due',grace_period_end=sub.current_period_end+interval '7 days' where id=sub.id;
      if inserted_event is not null then
        insert into public.notifications(agency_id,type,title,body,entity_type,entity_id)
        values(sub.agency_id,'subscription_past_due','Subscription-ka wuu dhacay','Waxaad haysataa 7 maalmood oo grace period ah ka hor inta plan-ka Starter loogu celin.','agency_subscription',sub.id);
        insert into public.platform_audit_logs(action,target_agency_id,metadata)
        values('billing.subscription_past_due',sub.agency_id,jsonb_build_object('subscription_id',sub.id,'plan_code',sub.plan_code,'period_end',sub.current_period_end));
        past_due_count := past_due_count+1;
      end if;
    elsif sub.status='past_due' and coalesce(sub.grace_period_end,sub.current_period_end+interval '7 days') <= now() then
      inserted_event := null;
      insert into public.subscription_automation_events(agency_id,subscription_id,event_key,period_end)
      values(sub.agency_id,sub.id,'downgraded',sub.current_period_end)
      on conflict do nothing returning id into inserted_event;
      if inserted_event is not null then
        update public.agency_subscriptions set status='canceled',plan_code='starter' where id=sub.id;
        update public.agencies set plan_code='starter' where id=sub.agency_id;
        insert into public.notifications(agency_id,type,title,body,entity_type,entity_id)
        values(sub.agency_id,'subscription_downgraded','Plan-ka Starter ayaa laguu celiyey','Grace period-ku wuu dhammaaday. Lacag-bixin cusub dir si plan-kaaga dib loogu hawlgeliyo.','agency_subscription',sub.id);
        insert into public.platform_audit_logs(action,target_agency_id,metadata)
        values('billing.subscription_downgraded',sub.agency_id,jsonb_build_object('subscription_id',sub.id,'previous_plan',sub.plan_code));
        downgraded_count := downgraded_count+1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('reminders',reminder_count,'past_due',past_due_count,'downgraded',downgraded_count);
end; $$;

revoke all on function public.process_subscription_expiries() from public;
grant execute on function public.process_subscription_expiries() to service_role;

commit;

