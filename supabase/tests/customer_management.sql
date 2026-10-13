begin;

insert into auth.users (id, email) values
('10000000-0000-4000-8000-000000000001','customer-owner-a@example.com'),
('10000000-0000-4000-8000-000000000002','customer-owner-b@example.com');
insert into public.agencies (id,created_by,name,slug) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Customer A','customer-a'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Customer B','customer-b');
insert into public.agency_members (id,agency_id,user_id,role) values
('21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
('21000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','owner');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.leads (id,agency_id,name,phone,email,source) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Ahmed','+252 61 000 0000','ahmed@example.com','manual');
insert into public.properties (id,agency_id,title,property_type,purpose,district,price) values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Ahmed Home','house','sale','Hodan',100000);

do $$ begin
  if exists(select 1 from public.customers where agency_id='20000000-0000-4000-8000-000000000001') then raise exception 'lead was prematurely converted to customer'; end if;
end $$;

select public.create_property_transaction('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','deposit',100000,15000,current_date,'pending','21000000-0000-4000-8000-000000000001','Deposit received');

do $$ begin
  if not exists(select 1 from public.property_transactions t join public.leads l on l.id=t.lead_id and l.agency_id=t.agency_id where t.agency_id='20000000-0000-4000-8000-000000000001' and t.total_price=100000 and t.deposit=15000 and t.remaining_balance=85000 and t.transaction_type='deposit' and l.customer_id=t.customer_id and l.status='won') then raise exception 'customer conversion transaction is incomplete'; end if;
  if not exists(select 1 from public.properties where id='40000000-0000-4000-8000-000000000001' and status='reserved') then raise exception 'property status was not updated'; end if;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.property_transactions where agency_id='20000000-0000-4000-8000-000000000001') then raise exception 'cross tenant transaction leak'; end if;
  if exists(select 1 from public.customers where agency_id='20000000-0000-4000-8000-000000000001') then raise exception 'cross tenant customer leak'; end if;
end $$;
update public.property_transactions set notes='Hacked' where agency_id='20000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin
  if exists(select 1 from public.property_transactions where agency_id='20000000-0000-4000-8000-000000000001' and notes='Hacked') then raise exception 'cross tenant transaction update succeeded'; end if;
end $$;

rollback;
select 'customer transaction management test passed' as result;

