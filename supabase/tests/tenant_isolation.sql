begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tenant-a-test@diini.invalid', crypt('test-only', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tenant-b-test@diini.invalid', crypt('test-only', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now());

insert into public.agencies (id, created_by, name, slug) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Tenant A Test', 'tenant-a-test'),
  ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Tenant B Test', 'tenant-b-test');

insert into public.agency_members (agency_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'owner');

insert into public.properties (id, agency_id, title, property_type, purpose, district, price) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Tenant A Property', 'house', 'rent', 'Hodan', 600),
  ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Tenant B Property', 'villa', 'sale', 'Wadajir', 90000);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

do $$
declare
  affected integer;
begin
  if (select count(*) from public.properties) <> 1 then
    raise exception 'RLS failure: Tenant A did not see exactly one property';
  end if;

  if exists (
    select 1 from public.properties
    where agency_id = 'b0000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'RLS failure: Tenant A can read Tenant B property';
  end if;

  update public.properties
  set title = 'Cross-tenant update must fail'
  where id = 'b1000000-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'RLS failure: Tenant A modified Tenant B property';
  end if;

  begin
    insert into public.properties (
      agency_id, title, property_type, purpose, district, price
    ) values (
      'b0000000-0000-0000-0000-000000000002',
      'Cross-tenant insert must fail', 'house', 'rent', 'Hodan', 500
    );
    raise exception 'RLS failure: Tenant A inserted a Tenant B property';
  exception
    when insufficient_privilege then null;
  end;

  if not public.is_agency_member('a0000000-0000-0000-0000-000000000001') then
    raise exception 'Membership failure: Tenant A membership was not detected';
  end if;

  if public.is_agency_member('b0000000-0000-0000-0000-000000000002') then
    raise exception 'Membership failure: Tenant A was treated as Tenant B member';
  end if;
end;
$$;

reset role;
rollback;

select 'tenant isolation test passed' as result;
