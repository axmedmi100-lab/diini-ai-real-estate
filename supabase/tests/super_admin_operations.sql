begin;
do $$
declare actor uuid; agency_id uuid; created_id uuid; denied boolean := false;
begin
  select user_id into actor from public.platform_users where role='super_admin' and is_active limit 1;
  select id into agency_id from public.agencies limit 1;
  if actor is null or agency_id is null then raise exception 'Platform admin and agency fixtures required'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform public.get_platform_agency_detail(agency_id);
  perform public.get_platform_system_health();
  perform public.platform_update_plan('starter','Starter',0,'{"properties":50}'::jsonb,true);
  created_id := public.platform_create_agency('Operations Test Agency','operations-test-agency','ops-test@example.com','starter','trial');
  if not exists (select 1 from public.platform_audit_logs where target_agency_id=created_id and action='agency.created') then raise exception 'Agency creation was not audit logged'; end if;

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform public.get_platform_system_health();
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Non-admin accessed platform operations'; end if;
end $$;
rollback;
select 'super admin operations test passed' as result;
