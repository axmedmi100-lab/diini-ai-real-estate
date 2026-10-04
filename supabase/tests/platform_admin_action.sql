begin;
do $$ declare actor uuid; target record; before_logs integer; begin
  select user_id into actor from public.platform_users where role='super_admin' and is_active limit 1;
  select id,lifecycle_status,plan_code into target from public.agencies limit 1;
  if actor is null or target.id is null then raise exception 'Platform admin and agency fixtures required'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*) into before_logs from public.platform_audit_logs where actor_user_id=actor and target_agency_id=target.id;
  perform public.get_platform_overview();
  perform public.platform_update_agency(target.id,target.lifecycle_status,target.plan_code);
  if (select count(*) from public.platform_audit_logs where actor_user_id=actor and target_agency_id=target.id) <> before_logs + 1 then
    raise exception 'Platform action was not audit logged atomically';
  end if;
end $$;
rollback;
select 'platform admin action test passed' as result;
