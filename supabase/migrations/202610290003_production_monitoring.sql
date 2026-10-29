begin;

create table public.platform_worker_runs (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null check (worker_name in ('follow_up','finance')),
  status text not null check (status in ('success','failed')),
  request_id text not null unique,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  duration_ms integer not null check (duration_ms >= 0),
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.platform_worker_runs enable row level security;
alter table public.platform_worker_runs force row level security;
create policy platform_worker_runs_admin_select on public.platform_worker_runs for select to authenticated using (public.is_platform_super_admin());
revoke all on public.platform_worker_runs from anon,authenticated;
grant select on public.platform_worker_runs to authenticated;
grant all on public.platform_worker_runs to service_role;
create index platform_worker_runs_worker_created_idx on public.platform_worker_runs(worker_name,created_at desc);
create index platform_worker_runs_status_created_idx on public.platform_worker_runs(status,created_at desc);

create or replace function public.record_platform_worker_run(
  target_worker_name text,
  target_status text,
  target_request_id text,
  target_started_at timestamptz,
  target_duration_ms integer,
  target_result jsonb default '{}'::jsonb,
  target_error_message text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  if target_worker_name not in ('follow_up','finance') or target_status not in ('success','failed') or target_duration_ms<0 then raise exception 'invalid worker run'; end if;
  insert into public.platform_worker_runs(worker_name,status,request_id,started_at,duration_ms,result,error_message)
  values(target_worker_name,target_status,target_request_id,target_started_at,target_duration_ms,coalesce(target_result,'{}'::jsonb),target_error_message)
  on conflict(request_id) do nothing;
  delete from public.platform_worker_runs where created_at<now()-interval '90 days';
end; $$;

create or replace function public.get_platform_operational_health()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  select jsonb_build_object(
    'metrics',jsonb_build_object(
      'integration_connected',(select count(*) from public.integrations where status='connected'),
      'integration_errors',(select count(*) from public.integrations where status='error'),
      'failed_follow_ups',(select count(*) from public.follow_ups where status='failed'),
      'pending_follow_ups',(select count(*) from public.follow_ups where status='pending'),
      'open_conversations',(select count(*) from public.conversations where status in ('open','ai_active','human_active')),
      'worker_failures_24h',(select count(*) from public.platform_worker_runs where status='failed' and created_at>=now()-interval '24 hours')
    ),
    'workers',(select coalesce(jsonb_agg(to_jsonb(latest) order by latest.worker_name),'[]'::jsonb) from (
      select distinct on (worker_name) worker_name,status,started_at,completed_at,duration_ms,result,error_message,
        extract(epoch from (now()-completed_at))::integer age_seconds
      from public.platform_worker_runs order by worker_name,created_at desc
    ) latest),
    'recent_failures',(select coalesce(jsonb_agg(to_jsonb(failures) order by failures.created_at desc),'[]'::jsonb) from (
      select worker_name,error_message,request_id,created_at from public.platform_worker_runs where status='failed' order by created_at desc limit 20
    ) failures)
  ) into result;
  return result;
end; $$;

revoke all on function public.record_platform_worker_run(text,text,text,timestamptz,integer,jsonb,text) from public;
revoke all on function public.get_platform_operational_health() from public;
grant execute on function public.record_platform_worker_run(text,text,text,timestamptz,integer,jsonb,text) to service_role;
grant execute on function public.get_platform_operational_health() to authenticated;

commit;

