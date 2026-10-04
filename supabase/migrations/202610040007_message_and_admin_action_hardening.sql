begin;

drop policy if exists tenant_insert on public.messages;
create policy tenant_insert on public.messages for insert to authenticated
  with check (
    public.has_agency_role(agency_id, array['owner','admin','manager','agent','receptionist']::public.agency_role[])
    and sender_type = 'agent'
    and sender_user_id = auth.uid()
  );

create or replace function public.platform_update_agency(
  actor_id uuid,
  target_agency_id uuid,
  new_lifecycle_status public.agency_lifecycle_status,
  new_plan_code text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_users where user_id=actor_id and role='super_admin' and is_active) then
    raise exception 'unauthorized platform actor';
  end if;
  if new_plan_code not in ('starter','pro','enterprise') then raise exception 'invalid plan'; end if;

  update public.agencies set lifecycle_status=new_lifecycle_status, plan_code=new_plan_code
  where id=target_agency_id;
  if not found then raise exception 'agency not found'; end if;

  insert into public.platform_audit_logs (actor_user_id, action, target_agency_id, metadata)
  values (actor_id, 'agency.lifecycle_updated', target_agency_id, jsonb_build_object('lifecycle_status',new_lifecycle_status,'plan_code',new_plan_code));
end;
$$;

revoke all on function public.platform_update_agency(uuid,uuid,public.agency_lifecycle_status,text) from public;
grant execute on function public.platform_update_agency(uuid,uuid,public.agency_lifecycle_status,text) to service_role;

commit;
