begin;

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('88000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase8-owner@diini.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('88000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase8-other@diini.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.agencies (id,created_by,name,slug) values
('88000000-0000-0000-0000-000000000011','88000000-0000-0000-0000-000000000001','Phase 8 A','phase-8-a'),
('88000000-0000-0000-0000-000000000012','88000000-0000-0000-0000-000000000002','Phase 8 B','phase-8-b');
insert into public.agency_members (agency_id,user_id,role) values
('88000000-0000-0000-0000-000000000011','88000000-0000-0000-0000-000000000001','owner'),
('88000000-0000-0000-0000-000000000012','88000000-0000-0000-0000-000000000002','owner');
insert into public.customers (id,agency_id,name,follow_up_opted_out) values
('88000000-0000-0000-0000-000000000021','88000000-0000-0000-0000-000000000011','Customer A',false),
('88000000-0000-0000-0000-000000000022','88000000-0000-0000-0000-000000000011','Customer Opted Out',true);
insert into public.leads (id,agency_id,customer_id,name,source) values
('88000000-0000-0000-0000-000000000031','88000000-0000-0000-0000-000000000011','88000000-0000-0000-0000-000000000021','Lead A','manual'),
('88000000-0000-0000-0000-000000000032','88000000-0000-0000-0000-000000000011','88000000-0000-0000-0000-000000000022','Lead B','manual');
insert into public.conversations (id,agency_id,lead_id,channel,status,external_thread_id) values
('88000000-0000-0000-0000-000000000041','88000000-0000-0000-0000-000000000011','88000000-0000-0000-0000-000000000031','whatsapp','ai_active','252611111111');
insert into public.follow_ups (id,agency_id,lead_id,conversation_id,channel,scheduled_for,message_template,max_attempts) values
('88000000-0000-0000-0000-000000000051','88000000-0000-0000-0000-000000000011','88000000-0000-0000-0000-000000000031','88000000-0000-0000-0000-000000000041','whatsapp',now()-interval '1 minute','Test WhatsApp',2),
('88000000-0000-0000-0000-000000000052','88000000-0000-0000-0000-000000000011','88000000-0000-0000-0000-000000000032',null,'manual',now()-interval '1 minute','Must opt out',3);

do $$ declare claimed_count integer; begin
  select count(*) into claimed_count from public.claim_due_follow_ups(10);
  if claimed_count <> 2 then raise exception 'expected two claimed jobs, got %',claimed_count; end if;
  if not exists(select 1 from public.follow_ups where id='88000000-0000-0000-0000-000000000051' and status='processing' and attempt_count=1) then raise exception 'claim state invalid'; end if;
end $$;
select public.opt_out_claimed_follow_up('88000000-0000-0000-0000-000000000052');
select public.fail_follow_up_delivery('88000000-0000-0000-0000-000000000051','temporary provider failure',1);
do $$ begin
  if not exists(select 1 from public.follow_ups where id='88000000-0000-0000-0000-000000000051' and status='pending' and last_error like 'temporary%') then raise exception 'retry state missing'; end if;
  if not exists(select 1 from public.follow_ups where id='88000000-0000-0000-0000-000000000052' and status='opted_out') then raise exception 'opt-out state missing'; end if;
end $$;

update public.follow_ups set scheduled_for=now()-interval '1 minute' where id='88000000-0000-0000-0000-000000000051';
select * from public.claim_due_follow_ups(10);
select public.fail_follow_up_delivery('88000000-0000-0000-0000-000000000051','permanent provider failure',1);
do $$ begin
  if not exists(select 1 from public.follow_ups where id='88000000-0000-0000-0000-000000000051' and status='failed' and attempt_count=2) then raise exception 'permanent failed state missing'; end if;
  if not exists(select 1 from public.notifications where entity_id='88000000-0000-0000-0000-000000000051' and type='follow_up_failed') then raise exception 'failure notification missing'; end if;
end $$;

set local role authenticated;
set local request.jwt.claim.sub='88000000-0000-0000-0000-000000000002';
do $$ begin
  begin
    perform public.retry_failed_follow_up('88000000-0000-0000-0000-000000000051','88000000-0000-0000-0000-000000000011');
    raise exception 'cross-tenant retry succeeded';
  exception when others then if sqlerrm='cross-tenant retry succeeded' then raise; end if; end;
end $$;

set local request.jwt.claim.sub='88000000-0000-0000-0000-000000000001';
select public.retry_failed_follow_up('88000000-0000-0000-0000-000000000051','88000000-0000-0000-0000-000000000011');
do $$ begin if not exists(select 1 from public.follow_ups where id='88000000-0000-0000-0000-000000000051' and status='pending' and attempt_count=0) then raise exception 'authorized retry failed'; end if; end $$;

reset role;
rollback;
select 'phase 8 follow-up delivery test passed' as result;
