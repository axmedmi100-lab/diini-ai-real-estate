begin;

create policy platform_admin_agencies_select on public.agencies for select to authenticated
  using (public.is_platform_super_admin());

create or replace function public.get_platform_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  select jsonb_build_object(
    'total_agencies', (select count(*) from public.agencies),
    'active_agencies', (select count(*) from public.agencies where lifecycle_status='active'),
    'trial_agencies', (select count(*) from public.agencies where lifecycle_status='trial'),
    'suspended_agencies', (select count(*) from public.agencies where lifecycle_status='suspended'),
    'total_properties', (select count(*) from public.properties),
    'total_leads', (select count(*) from public.leads),
    'total_conversations', (select count(*) from public.conversations),
    'monthly_ai_conversations', (select coalesce(sum(ai_conversations),0) from public.agency_usage_monthly where month_start=date_trunc('month',now())::date),
    'monthly_ai_cost_usd', (select coalesce(sum(estimated_ai_cost_usd),0) from public.agency_usage_monthly where month_start=date_trunc('month',now())::date)
  ) into result;
  return result;
end;
$$;

create or replace function public.platform_update_agency(
  target_agency_id uuid,
  new_lifecycle_status public.agency_lifecycle_status,
  new_plan_code text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  if new_plan_code not in ('starter','pro','enterprise') then raise exception 'invalid plan'; end if;
  update public.agencies set lifecycle_status=new_lifecycle_status, plan_code=new_plan_code where id=target_agency_id;
  if not found then raise exception 'agency not found'; end if;
  insert into public.platform_audit_logs (actor_user_id, action, target_agency_id, metadata)
  values (actor_id,'agency.lifecycle_updated',target_agency_id,jsonb_build_object('lifecycle_status',new_lifecycle_status,'plan_code',new_plan_code));
end;
$$;

revoke all on function public.get_platform_overview() from public;
revoke all on function public.platform_update_agency(uuid,public.agency_lifecycle_status,text) from public;
grant execute on function public.get_platform_overview() to authenticated;
grant execute on function public.platform_update_agency(uuid,public.agency_lifecycle_status,text) to authenticated;

commit;
