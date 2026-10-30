begin;

alter table public.push_subscriptions alter column agency_id drop not null;
alter table public.push_subscriptions add column platform_admin boolean not null default false;
create index push_subscriptions_platform_admin_idx on public.push_subscriptions(platform_admin) where platform_admin=true;

create table public.platform_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  severity text not null check(severity in ('warning','critical')),
  title text not null,
  body text not null,
  source text not null,
  dedupe_key text not null unique,
  status text not null default 'open' check(status in ('open','acknowledged')),
  occurrence_count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  push_processed_at timestamptz,
  push_error text,
  created_at timestamptz not null default now()
);
alter table public.platform_alerts enable row level security;
alter table public.platform_alerts force row level security;
create policy platform_alerts_admin_select on public.platform_alerts for select to authenticated using(public.is_platform_super_admin());
create policy platform_alerts_admin_update on public.platform_alerts for update to authenticated using(public.is_platform_super_admin()) with check(public.is_platform_super_admin());
revoke all on public.platform_alerts from anon,authenticated;
grant select,update on public.platform_alerts to authenticated;
grant all on public.platform_alerts to service_role;
grant update(agency_id,platform_admin,updated_at) on public.push_subscriptions to service_role;
create index platform_alerts_status_last_seen_idx on public.platform_alerts(status,last_seen_at desc);

create or replace function public.process_platform_alerts()
returns jsonb language plpgsql security definer set search_path='' as $$
declare generated integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;

  insert into public.platform_alerts(alert_type,severity,title,body,source,dedupe_key,metadata)
  select 'worker_unhealthy','critical',initcap(replace(expected.name,'_',' '))||' worker unhealthy',
    case when latest.worker_name is null then 'Worker heartbeat has never been recorded.' when latest.status='failed' then coalesce(latest.error_message,'Worker failed.') else 'Worker heartbeat is older than 10 minutes.' end,
    'worker','worker:'||expected.name,jsonb_build_object('worker',expected.name)
  from (values('follow_up'),('finance')) expected(name)
  left join lateral(select worker_name,status,error_message,completed_at from public.platform_worker_runs where worker_name=expected.name order by created_at desc limit 1) latest on true
  where latest.worker_name is null or latest.status='failed' or latest.completed_at<now()-interval '10 minutes'
  on conflict(dedupe_key) do update set last_seen_at=now(),occurrence_count=public.platform_alerts.occurrence_count+1,body=excluded.body,metadata=excluded.metadata;
  get diagnostics generated=row_count;

  insert into public.platform_alerts(alert_type,severity,title,body,source,dedupe_key,metadata)
  select 'backup_unhealthy','critical','Encrypted backup attention required',
    case when latest.id is null then 'No encrypted backup has been recorded.' else 'Latest backup is not stored or is older than 26 hours.' end,
    'backup','backup:daily',jsonb_build_object('latest_status',latest.status,'generated_at',latest.generated_at)
  from (select 1) seed left join lateral(select id,status,generated_at,stored_at from public.platform_backup_runs order by created_at desc limit 1) latest on true
  where latest.id is null or latest.status<>'stored' or coalesce(latest.stored_at,latest.generated_at)<now()-interval '26 hours'
  on conflict(dedupe_key) do update set last_seen_at=now(),occurrence_count=public.platform_alerts.occurrence_count+1,body=excluded.body,metadata=excluded.metadata;

  insert into public.platform_alerts(alert_type,severity,title,body,source,dedupe_key,metadata)
  select 'integration_error','warning',initcap(i.provider)||' integration error',coalesce(i.last_error,'Agency integration reports an error.'),'integration',
    'integration:'||i.id::text,jsonb_build_object('agency_id',i.agency_id,'provider',i.provider)
  from public.integrations i where i.status='error'
  on conflict(dedupe_key) do update set last_seen_at=now(),occurrence_count=public.platform_alerts.occurrence_count+1,body=excluded.body,metadata=excluded.metadata;

  insert into public.platform_alerts(alert_type,severity,title,body,source,dedupe_key,metadata)
  select 'payment_failure','critical','Subscription payment attention',a.name||' subscription is '||s.status||'.','billing',
    'billing:'||s.agency_id::text,jsonb_build_object('agency_id',s.agency_id,'status',s.status)
  from public.agency_subscriptions s join public.agencies a on a.id=s.agency_id where s.status in ('past_due','unpaid')
  on conflict(dedupe_key) do update set last_seen_at=now(),occurrence_count=public.platform_alerts.occurrence_count+1,body=excluded.body,metadata=excluded.metadata;

  insert into public.platform_alerts(alert_type,severity,title,body,source,dedupe_key,metadata)
  select 'high_ai_cost','warning','High monthly AI cost',a.name||' estimated AI cost reached $'||u.estimated_ai_cost_usd::text||'.','usage',
    'ai-cost:'||u.agency_id::text||':'||u.month_start::text,jsonb_build_object('agency_id',u.agency_id,'cost_usd',u.estimated_ai_cost_usd)
  from public.agency_usage_monthly u join public.agencies a on a.id=u.agency_id
  where u.month_start=date_trunc('month',current_date)::date and u.estimated_ai_cost_usd>=50
  on conflict(dedupe_key) do update set last_seen_at=now(),occurrence_count=public.platform_alerts.occurrence_count+1,body=excluded.body,metadata=excluded.metadata;

  return jsonb_build_object('generated',generated,'open_alerts',(select count(*) from public.platform_alerts where status='open'));
end; $$;
revoke all on function public.process_platform_alerts() from public;
grant execute on function public.process_platform_alerts() to service_role;

commit;

