begin;

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('81000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','team-owner@diini.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('82000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','team-manager@diini.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('83000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','team-agent@diini.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('84000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','other-owner@diini.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.agencies (id,created_by,name,slug) values
('8a000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','Team Tenant A','team-tenant-a'),
('8b000000-0000-0000-0000-000000000002','84000000-0000-0000-0000-000000000004','Team Tenant B','team-tenant-b');
insert into public.agency_members (id,agency_id,user_id,role) values
('8c000000-0000-0000-0000-000000000001','8a000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','owner'),
('8c000000-0000-0000-0000-000000000002','8a000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002','manager'),
('8c000000-0000-0000-0000-000000000003','8a000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000003','agent'),
('8c000000-0000-0000-0000-000000000004','8b000000-0000-0000-0000-000000000002','84000000-0000-0000-0000-000000000004','owner');
insert into public.ai_settings (agency_id) values ('8a000000-0000-0000-0000-000000000001'),('8b000000-0000-0000-0000-000000000002');
insert into public.conversations (id,agency_id,channel,status) values
('8d000000-0000-0000-0000-000000000001','8a000000-0000-0000-0000-000000000001','website','ai_active');

set local role authenticated;
set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000001';
select public.create_agency_invitation('new-agent@diini.invalid','agent','12345678901234567890123456789012');
do $$ begin
  if not exists (select 1 from public.get_agency_invitation_preview('12345678901234567890123456789012') where email='new-agent@diini.invalid') then
    raise exception 'owner invitation preview failed';
  end if;
end $$;

set local request.jwt.claim.sub = '82000000-0000-0000-0000-000000000002';
do $$ begin
  begin
    perform public.create_agency_invitation('blocked@diini.invalid','agent','22345678901234567890123456789012');
    raise exception 'manager created an invitation';
  exception when others then
    if sqlerrm='manager created an invitation' then raise; end if;
  end;
end $$;

select public.assign_conversation_agent('8d000000-0000-0000-0000-000000000001','8c000000-0000-0000-0000-000000000003');
do $$ begin
  if not exists (select 1 from public.conversations where id='8d000000-0000-0000-0000-000000000001' and status='human_active' and assigned_agent_id='8c000000-0000-0000-0000-000000000003') then raise exception 'assignment did not pause AI'; end if;
  if not exists (select 1 from public.notifications where entity_id='8d000000-0000-0000-0000-000000000001' and user_id='83000000-0000-0000-0000-000000000003') then raise exception 'targeted notification missing'; end if;
end $$;

set local request.jwt.claim.sub = '83000000-0000-0000-0000-000000000003';
do $$ begin
  begin
    perform public.assign_conversation_agent('8d000000-0000-0000-0000-000000000001','8c000000-0000-0000-0000-000000000004');
    raise exception 'cross-tenant assignment succeeded';
  exception when others then
    if sqlerrm='cross-tenant assignment succeeded' then raise; end if;
  end;
end $$;
select public.set_my_agency_availability('online');
do $$ begin if not exists (select 1 from public.agency_members where id='8c000000-0000-0000-0000-000000000003' and availability='online') then raise exception 'availability update failed'; end if; end $$;

reset role;
rollback;
select 'team invitations and handoff assignment test passed' as result;
