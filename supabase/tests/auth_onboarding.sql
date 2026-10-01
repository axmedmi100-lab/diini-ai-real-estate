begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '30000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'auth-onboarding-test@diini.invalid',
  crypt('test-only', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Auth Test","agency_name":"Auth Test Agency","preferred_language":"so"}'::jsonb,
  now(),
  now()
);

do $$
declare
  test_agency_id uuid;
begin
  if (select count(*) from public.user_profiles where id = '30000000-0000-0000-0000-000000000003') <> 1 then
    raise exception 'Auth onboarding failure: user profile was not created';
  end if;

  select id into test_agency_id
  from public.agencies
  where created_by = '30000000-0000-0000-0000-000000000003';

  if test_agency_id is null then
    raise exception 'Auth onboarding failure: agency was not created';
  end if;

  if (select count(*) from public.agency_members where agency_id = test_agency_id and user_id = '30000000-0000-0000-0000-000000000003' and role = 'owner') <> 1 then
    raise exception 'Auth onboarding failure: owner membership was not created';
  end if;

  if (select count(*) from public.ai_settings where agency_id = test_agency_id) <> 1 then
    raise exception 'Auth onboarding failure: default AI settings were not created';
  end if;
end;
$$;

rollback;

select 'auth onboarding test passed' as result;
