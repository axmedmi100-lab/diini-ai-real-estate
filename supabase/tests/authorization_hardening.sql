begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('41000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase2-owner@diini.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('42000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase2-manager@diini.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('43000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase2-agent@diini.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('44000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase2-admin@diini.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.agencies (id, created_by, name, slug) values
('4a000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','Phase 2 Tenant A','phase-2-tenant-a'),
('4b000000-0000-0000-0000-000000000002','44000000-0000-0000-0000-000000000004','Phase 2 Tenant B','phase-2-tenant-b');
insert into public.agency_members (agency_id,user_id,role) values
('4a000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','owner'),
('4a000000-0000-0000-0000-000000000001','42000000-0000-0000-0000-000000000002','manager'),
('4a000000-0000-0000-0000-000000000001','43000000-0000-0000-0000-000000000003','agent'),
('4b000000-0000-0000-0000-000000000002','44000000-0000-0000-0000-000000000004','owner');
insert into public.ai_settings (agency_id) values ('4a000000-0000-0000-0000-000000000001'),('4b000000-0000-0000-0000-000000000002');
insert into public.conversations (id,agency_id,channel,status) values ('4c000000-0000-0000-0000-000000000001','4a000000-0000-0000-0000-000000000001','manual','human_active');

set local role authenticated;
set local request.jwt.claim.sub = '43000000-0000-0000-0000-000000000003';
do $$ declare affected integer; begin
  update public.ai_settings set assistant_name='Escalation failed' where agency_id='4a000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Agent changed manager-only AI settings'; end if;
  if exists(select 1 from public.ai_settings where agency_id='4b000000-0000-0000-0000-000000000002') then raise exception 'Cross-tenant read succeeded'; end if;
  if public.is_platform_super_admin() then raise exception 'Normal agent became super admin'; end if;
  begin
    insert into public.messages (agency_id,conversation_id,sender_type,message)
    values ('4a000000-0000-0000-0000-000000000001','4c000000-0000-0000-0000-000000000001','ai','Spoofed AI message');
    raise exception 'Agent spoofed an AI message';
  exception when insufficient_privilege then null; end;
  insert into public.messages (agency_id,conversation_id,sender_type,sender_user_id,message)
  values ('4a000000-0000-0000-0000-000000000001','4c000000-0000-0000-0000-000000000001','agent','43000000-0000-0000-0000-000000000003','Valid agent message');
end $$;

set local request.jwt.claim.sub = '42000000-0000-0000-0000-000000000002';
do $$ declare affected integer; begin
  update public.agency_members set role='owner' where agency_id='4a000000-0000-0000-0000-000000000001' and user_id='42000000-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Manager escalated own role'; end if;
end $$;

reset role;
insert into public.platform_users (user_id) values ('44000000-0000-0000-0000-000000000004');
set local role authenticated;
set local request.jwt.claim.sub = '44000000-0000-0000-0000-000000000004';
do $$ begin if not public.is_platform_super_admin() then raise exception 'Super admin authorization failed'; end if; end $$;

reset role;
rollback;
select 'authorization hardening test passed' as result;
