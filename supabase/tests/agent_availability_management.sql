begin;

do $$
declare
  agency_one uuid := gen_random_uuid();
  agency_two uuid := gen_random_uuid();
  owner_one uuid := gen_random_uuid();
  manager_one uuid := gen_random_uuid();
  agent_one uuid := gen_random_uuid();
  owner_two uuid := gen_random_uuid();
  target_member uuid;
begin
  insert into auth.users (id,email) values
    (owner_one,'availability-owner@example.com'),
    (manager_one,'availability-manager@example.com'),
    (agent_one,'availability-agent@example.com'),
    (owner_two,'availability-other@example.com');
  insert into public.agencies (id,created_by,name,slug) values
    (agency_one,owner_one,'Availability One','availability-one'),
    (agency_two,owner_two,'Availability Two','availability-two');
  insert into public.agency_members (agency_id,user_id,role) values
    (agency_one,owner_one,'owner'),(agency_one,manager_one,'manager'),
    (agency_one,agent_one,'agent'),(agency_two,owner_two,'owner');
  select id into target_member from public.agency_members where agency_id=agency_one and user_id=agent_one;

  perform set_config('request.jwt.claim.sub',manager_one::text,true);
  perform public.set_agency_member_availability(target_member,'available');
  if not exists(select 1 from public.agency_members where id=target_member and availability='available') then
    raise exception 'manager update failed';
  end if;

  perform set_config('request.jwt.claim.sub',owner_two::text,true);
  begin
    perform public.set_agency_member_availability(target_member,'offline');
    raise exception 'cross tenant update unexpectedly succeeded';
  exception when others then
    if sqlerrm='cross tenant update unexpectedly succeeded' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',agent_one::text,true);
  perform public.set_my_agency_availability('busy');
  if not exists(select 1 from public.agency_members where id=target_member and availability='busy') then
    raise exception 'self update failed';
  end if;
end $$;

reset role;
rollback;
select 'agent availability management test passed' as result;
