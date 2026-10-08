begin;

alter table public.agency_members
  drop constraint if exists agency_members_availability_check;

alter table public.agency_members
  add constraint agency_members_availability_check
  check (availability in ('available', 'online', 'busy', 'away', 'offline'));

create or replace function public.set_my_agency_availability(new_availability text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if new_availability not in ('available','online','busy','away','offline') then
    raise exception 'invalid availability';
  end if;
  update public.agency_members set availability=new_availability
  where user_id=auth.uid() and is_active;
  if not found then raise exception 'active membership not found'; end if;
end;
$$;

create or replace function public.set_agency_member_availability(target_member_id uuid, new_availability text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_member public.agency_members%rowtype;
  caller_member public.agency_members%rowtype;
begin
  if new_availability not in ('available','online','busy','away','offline') then
    raise exception 'invalid availability';
  end if;

  select * into target_member from public.agency_members
  where id=target_member_id and is_active;
  if target_member.id is null then raise exception 'active member not found'; end if;

  select * into caller_member from public.agency_members
  where agency_id=target_member.agency_id and user_id=auth.uid() and is_active;
  if caller_member.id is null or caller_member.role not in ('owner','admin','manager') then
    raise exception 'unauthorized';
  end if;

  update public.agency_members set availability=new_availability where id=target_member.id;
  insert into public.audit_logs (agency_id,user_id,action,entity_type,entity_id,metadata)
  values (target_member.agency_id,auth.uid(),'member.availability_updated','agency_member',target_member.id,
    jsonb_build_object('availability',new_availability));
end;
$$;

revoke all on function public.set_agency_member_availability(uuid,text) from public;
grant execute on function public.set_agency_member_availability(uuid,text) to authenticated;

commit;
