begin;
do $$ declare actor uuid; target record; before_logs integer; begin
  select user_id into actor from public.platform_users where role='super_admin' and is_active limit 1;
  select id,lifecycle_status,plan_code into target from public.agencies limit 1;
  if actor is null or target.id is null then raise exception 'Platform admin and agency fixtures required'; end if;
  select count(*) into before_logs from public.platform_audit_logs where actor_user_id=actor and target_agency_id=target.id;
  perform public.platform_update_agency(actor,target.id,target.lifecycle_status,target.plan_code);
  if (select count(*) from public.platform_audit_logs where actor_user_id=actor and target_agency_id=target.id) <> before_logs + 1 then
    raise exception 'Platform action was not audit logged atomically';
  end if;
end $$;
rollback;
select 'platform admin action test passed' as result;
