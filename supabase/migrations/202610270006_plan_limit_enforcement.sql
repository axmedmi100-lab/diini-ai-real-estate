begin;

update public.platform_plans
set limits = limits || case code
  when 'starter' then '{"leads":1000,"whatsapp_messages":1000}'::jsonb
  when 'pro' then '{"leads":10000,"whatsapp_messages":10000}'::jsonb
  else '{"leads":-1,"whatsapp_messages":-1}'::jsonb
end
where code in ('starter','pro','enterprise');

create or replace function public.get_agency_plan_entitlement(target_agency_id uuid, resource_name text)
returns table (allowed boolean, used bigint, limit_value bigint, plan_code text)
language plpgsql stable security definer set search_path = '' as $$
declare
  normalized_resource text := lower(trim(resource_name));
  target_plan text;
  configured_limit bigint;
  current_usage bigint;
begin
  if normalized_resource not in ('properties','users','leads','follow_ups','ai_conversations','whatsapp_messages') then
    raise exception 'invalid plan resource';
  end if;
  if auth.role() <> 'service_role' and not public.is_agency_member(target_agency_id) then
    raise exception 'unauthorized';
  end if;

  select a.plan_code, coalesce((p.limits ->> normalized_resource)::bigint, 0)
  into target_plan, configured_limit
  from public.agencies a join public.platform_plans p on p.code=a.plan_code and p.is_active
  where a.id=target_agency_id and a.lifecycle_status in ('trial','active');
  if target_plan is null then raise exception 'active agency plan not found'; end if;

  current_usage := case normalized_resource
    when 'properties' then (select count(*) from public.properties where agency_id=target_agency_id)
    when 'users' then (select count(*) from public.agency_members where agency_id=target_agency_id and is_active)
    when 'leads' then (select count(*) from public.leads where agency_id=target_agency_id)
    when 'follow_ups' then (select count(*) from public.follow_ups where agency_id=target_agency_id and created_at >= date_trunc('month',now()))
    when 'ai_conversations' then (select coalesce(ai_conversations,0) from public.agency_usage_monthly where agency_id=target_agency_id and month_start=date_trunc('month',now())::date)
    when 'whatsapp_messages' then (select coalesce(whatsapp_messages,0) from public.agency_usage_monthly where agency_id=target_agency_id and month_start=date_trunc('month',now())::date)
  end;
  current_usage := coalesce(current_usage,0);
  return query select configured_limit < 0 or current_usage < configured_limit, current_usage, configured_limit, target_plan;
end; $$;

create or replace function public.enforce_agency_plan_insert_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  resource_name text;
  entitlement record;
begin
  resource_name := case tg_table_name
    when 'properties' then 'properties'
    when 'agency_members' then 'users'
    when 'leads' then 'leads'
    when 'follow_ups' then 'follow_ups'
  end;
  select * into entitlement from public.get_agency_plan_entitlement(new.agency_id,resource_name);
  if not entitlement.allowed then
    raise exception 'plan_limit_reached:%:%',resource_name,entitlement.limit_value using errcode='P0001';
  end if;
  return new;
end; $$;

drop trigger if exists enforce_properties_plan_limit on public.properties;
create trigger enforce_properties_plan_limit before insert on public.properties for each row execute function public.enforce_agency_plan_insert_limit();
drop trigger if exists enforce_members_plan_limit on public.agency_members;
create trigger enforce_members_plan_limit before insert on public.agency_members for each row execute function public.enforce_agency_plan_insert_limit();
drop trigger if exists enforce_leads_plan_limit on public.leads;
create trigger enforce_leads_plan_limit before insert on public.leads for each row execute function public.enforce_agency_plan_insert_limit();
drop trigger if exists enforce_follow_ups_plan_limit on public.follow_ups;
create trigger enforce_follow_ups_plan_limit before insert on public.follow_ups for each row execute function public.enforce_agency_plan_insert_limit();

revoke all on function public.get_agency_plan_entitlement(uuid,text) from public;
revoke all on function public.enforce_agency_plan_insert_limit() from public;
grant execute on function public.get_agency_plan_entitlement(uuid,text) to authenticated,service_role;

commit;

