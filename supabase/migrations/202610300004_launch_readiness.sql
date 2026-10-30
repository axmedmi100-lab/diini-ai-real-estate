begin;

create or replace function public.get_platform_launch_readiness()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  checks jsonb:='[]'::jsonb;
  passed_count integer;
  warning_count integer;
  failed_count integer;
  total_count integer;
  secured_tables integer;
  latest_status text;
  latest_time timestamptz;
  value_count integer;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;

  checks:=checks||jsonb_build_array(jsonb_build_object('key','database','category','Core','title','Database connectivity','status','passed','detail','Authenticated database RPC completed successfully.'));

  select count(*) into secured_tables from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any(array['agencies','agency_members','properties','leads','customers','conversations','viewings','follow_ups','notifications','property_transactions']) and c.relrowsecurity and c.relforcerowsecurity;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','tenant_rls','category','Security','title','Tenant isolation / RLS','status',case when secured_tables=10 then 'passed' else 'failed' end,'detail',secured_tables||' of 10 critical tenant tables enforce RLS.'));

  select status,completed_at into latest_status,latest_time from public.platform_worker_runs where worker_name='follow_up' order by created_at desc limit 1;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','follow_up_worker','category','Automation','title','Follow-up worker','status',case when latest_status='success' and latest_time>=now()-interval '10 minutes' then 'passed' when latest_time is null then 'failed' else 'warning' end,'detail',case when latest_time is null then 'No worker heartbeat recorded.' else 'Latest heartbeat: '||latest_time::text||' ('||coalesce(latest_status,'unknown')||').' end));

  latest_status:=null;latest_time:=null;
  select status,completed_at into latest_status,latest_time from public.platform_worker_runs where worker_name='finance' order by created_at desc limit 1;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','finance_worker','category','Automation','title','Finance worker','status',case when latest_status='success' and latest_time>=now()-interval '10 minutes' then 'passed' when latest_time is null then 'failed' else 'warning' end,'detail',case when latest_time is null then 'No worker heartbeat recorded.' else 'Latest heartbeat: '||latest_time::text||' ('||coalesce(latest_status,'unknown')||').' end));

  latest_status:=null;latest_time:=null;
  select status,coalesce(stored_at,generated_at) into latest_status,latest_time from public.platform_backup_runs order by created_at desc limit 1;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','backup','category','Recovery','title','Encrypted daily backup','status',case when latest_status='stored' and latest_time>=now()-interval '26 hours' then 'passed' when latest_time is null then 'failed' else 'warning' end,'detail',case when latest_time is null then 'No backup has been recorded.' else 'Latest backup: '||latest_status||' at '||latest_time::text end));

  select count(*) into value_count from public.push_subscriptions where platform_admin=true;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','admin_push','category','Alerts','title','Super Admin push device','status',case when value_count>0 then 'passed' else 'warning' end,'detail',value_count||' Super Admin device(s) registered.'));

  select count(*) into value_count from public.platform_alerts where status='open' and severity='critical';
  checks:=checks||jsonb_build_array(jsonb_build_object('key','critical_alerts','category','Alerts','title','Open critical alerts','status',case when value_count=0 then 'passed' else 'failed' end,'detail',value_count||' critical alert(s) require attention.'));

  select count(*) into value_count from public.integrations where status='error';
  checks:=checks||jsonb_build_array(jsonb_build_object('key','integrations','category','Channels','title','Agency integrations','status',case when value_count=0 then 'passed' else 'warning' end,'detail',value_count||' integration(s) currently report errors.'));

  select count(*) into value_count from public.platform_integration_providers where provider='openai' and is_enabled and secret_configured;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','openai','category','AI','title','OpenAI production configuration','status',case when value_count=1 then 'passed' else 'warning' end,'detail',case when value_count=1 then 'Managed OpenAI provider is enabled with a configured secret.' else 'OpenAI provider or encrypted secret is not fully configured.' end));

  select count(*) into value_count from public.agency_subscriptions where status in ('active','trialing');
  checks:=checks||jsonb_build_array(jsonb_build_object('key','billing','category','Billing','title','Active subscriptions','status',case when value_count>0 then 'passed' else 'warning' end,'detail',value_count||' active or trialing subscription(s).'));

  select count(*) into value_count from public.properties;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','properties','category','Workflow','title','Property inventory','status',case when value_count>0 then 'passed' else 'warning' end,'detail',value_count||' properties available in the platform.'));
  select count(*) into value_count from public.leads;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','leads','category','Workflow','title','Lead capture','status',case when value_count>0 then 'passed' else 'warning' end,'detail',value_count||' leads captured.'));
  select count(*) into value_count from public.viewings;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','viewings','category','Workflow','title','Viewing workflow','status',case when value_count>0 then 'passed' else 'warning' end,'detail',value_count||' viewings recorded.'));
  select count(*) into value_count from public.property_transactions;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','transactions','category','Workflow','title','Deal and transaction workflow','status',case when value_count>0 then 'passed' else 'warning' end,'detail',value_count||' property transactions recorded.'));
  select count(*) into value_count from public.transaction_payments;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','payments','category','Workflow','title','Payment history','status',case when value_count>0 then 'passed' else 'warning' end,'detail',value_count||' transaction payments recorded.'));

  select count(*) filter(where item->>'status'='passed'),count(*) filter(where item->>'status'='warning'),count(*) filter(where item->>'status'='failed'),count(*)
  into passed_count,warning_count,failed_count,total_count from jsonb_array_elements(checks) item;
  return jsonb_build_object('score',round(((passed_count+warning_count*0.5)::numeric/greatest(total_count,1))*100),'overall_status',case when failed_count>0 then 'blocked' when warning_count>0 then 'attention' else 'ready' end,'checked_at',now(),'checks',checks,'summary',jsonb_build_object('passed',passed_count,'warning',warning_count,'failed',failed_count,'total',total_count));
end; $$;

revoke all on function public.get_platform_launch_readiness() from public;
grant execute on function public.get_platform_launch_readiness() to authenticated;

commit;

