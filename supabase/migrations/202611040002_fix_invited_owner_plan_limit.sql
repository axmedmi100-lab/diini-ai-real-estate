begin;

create or replace function public.enforce_agency_plan_insert_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  resource_name text;
  entitlement record;
  configured_limit bigint;
  current_usage bigint;
begin
  resource_name := case tg_table_name
    when 'properties' then 'properties'
    when 'agency_members' then 'users'
    when 'leads' then 'leads'
    when 'follow_ups' then 'follow_ups'
  end;

  if tg_table_name = 'agency_members' then
    select coalesce((p.limits ->> 'users')::bigint, 0)
    into configured_limit
    from public.agencies a
    join public.platform_plans p on p.code = a.plan_code and p.is_active
    where a.id = new.agency_id and a.lifecycle_status in ('trial','active');

    if configured_limit is null then raise exception 'active agency plan not found'; end if;
    select count(*) into current_usage
    from public.agency_members
    where agency_id = new.agency_id and is_active;

    if configured_limit >= 0 and current_usage >= configured_limit then
      raise exception 'plan_limit_reached:users:%', configured_limit using errcode='P0001';
    end if;
    return new;
  end if;

  select * into entitlement
  from public.get_agency_plan_entitlement(new.agency_id, resource_name);
  if not entitlement.allowed then
    raise exception 'plan_limit_reached:%:%', resource_name, entitlement.limit_value using errcode='P0001';
  end if;
  return new;
end;
$$;

commit;

