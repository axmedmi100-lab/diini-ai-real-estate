begin;

create or replace function public.get_platform_operational_health()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  metrics_value jsonb;
  workers_value jsonb;
  failures_value jsonb;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;

  select jsonb_build_object(
    'integration_connected',(select count(*) from public.integrations where status='connected'),
    'integration_errors',(select count(*) from public.integrations where status='error'),
    'failed_follow_ups',(select count(*) from public.follow_ups where status='failed'),
    'pending_follow_ups',(select count(*) from public.follow_ups where status='pending'),
    'open_conversations',(select count(*) from public.conversations where status in ('open','ai_active','human_active')),
    'worker_failures_24h',(select count(*) from public.platform_worker_runs where status='failed' and created_at>=now()-interval '24 hours')
  ) into metrics_value;

  select coalesce(jsonb_agg(jsonb_build_object(
    'worker_name',latest.worker_name,
    'status',latest.status,
    'started_at',latest.started_at,
    'completed_at',latest.completed_at,
    'duration_ms',latest.duration_ms,
    'result',latest.result,
    'error_message',latest.error_message,
    'age_seconds',extract(epoch from (now()-latest.completed_at))::integer
  ) order by latest.worker_name),'[]'::jsonb) into workers_value
  from (
    select distinct on (worker_name) worker_name,status,started_at,completed_at,duration_ms,result,error_message
    from public.platform_worker_runs
    order by worker_name,created_at desc
  ) latest;

  select coalesce(jsonb_agg(jsonb_build_object(
    'worker_name',recent.worker_name,
    'error_message',recent.error_message,
    'request_id',recent.request_id,
    'created_at',recent.created_at
  ) order by recent.created_at desc),'[]'::jsonb) into failures_value
  from (
    select worker_name,error_message,request_id,created_at
    from public.platform_worker_runs
    where status='failed'
    order by created_at desc
    limit 20
  ) recent;

  return jsonb_build_object('metrics',metrics_value,'workers',workers_value,'recent_failures',failures_value);
end; $$;

revoke all on function public.get_platform_operational_health() from public;
grant execute on function public.get_platform_operational_health() to authenticated;

commit;

