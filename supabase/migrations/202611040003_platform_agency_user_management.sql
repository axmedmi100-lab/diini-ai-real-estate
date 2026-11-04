begin;

create or replace function public.get_platform_agency_members(target_agency_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role public.agency_role,
  is_active boolean,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_super_admin() then
    raise exception 'unauthorized platform actor';
  end if;

  return query
  select m.id, m.user_id, u.email::text, p.full_name, m.role, m.is_active, m.created_at
  from public.agency_members m
  join auth.users u on u.id = m.user_id
  left join public.user_profiles p on p.id = m.user_id
  where m.agency_id = target_agency_id
  order by m.is_active desc, m.created_at;
end;
$$;

create or replace function public.platform_update_agency_member(
  target_agency_id uuid,
  target_membership_id uuid,
  new_role public.agency_role,
  new_is_active boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  current_member public.agency_members%rowtype;
  configured_limit bigint;
  active_users bigint;
begin
  if actor_id is null or not public.is_platform_super_admin() then
    raise exception 'unauthorized platform actor';
  end if;

  select * into current_member
  from public.agency_members
  where id = target_membership_id and agency_id = target_agency_id
  for update;
  if current_member.id is null then raise exception 'agency member not found'; end if;

  if current_member.role = 'owner' and current_member.is_active
     and (new_role <> 'owner' or not new_is_active)
     and not exists (
       select 1 from public.agency_members
       where agency_id = target_agency_id
         and id <> target_membership_id
         and role = 'owner'
         and is_active
     ) then
    raise exception 'last active owner cannot be changed or disabled';
  end if;

  if new_is_active and not current_member.is_active then
    select coalesce((p.limits ->> 'users')::bigint, 0)
    into configured_limit
    from public.agencies a
    join public.platform_plans p on p.code = a.plan_code and p.is_active
    where a.id = target_agency_id;
    select count(*) into active_users from public.agency_members where agency_id = target_agency_id and is_active;
    if configured_limit >= 0 and active_users >= configured_limit then
      raise exception 'plan_limit_reached:users:%', configured_limit;
    end if;
  end if;

  update public.agency_members
  set role = new_role, is_active = new_is_active, updated_at = now()
  where id = target_membership_id and agency_id = target_agency_id;

  insert into public.platform_audit_logs(actor_user_id, action, target_agency_id, metadata)
  values(actor_id, 'agency.member_updated', target_agency_id, jsonb_build_object(
    'membership_id', target_membership_id,
    'user_id', current_member.user_id,
    'previous_role', current_member.role,
    'new_role', new_role,
    'previous_is_active', current_member.is_active,
    'new_is_active', new_is_active
  ));
end;
$$;

revoke all on function public.get_platform_agency_members(uuid) from public;
revoke all on function public.platform_update_agency_member(uuid,uuid,public.agency_role,boolean) from public;
grant execute on function public.get_platform_agency_members(uuid) to authenticated;
grant execute on function public.platform_update_agency_member(uuid,uuid,public.agency_role,boolean) to authenticated;

commit;

