begin;

do $$
begin
  if to_regprocedure('public.can_view_agency_profile(uuid)') is null then
    raise exception 'profile visibility helper is missing';
  end if;

  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'profiles_select') <> 1 then
    raise exception 'profiles_select policy is missing or duplicated';
  end if;

  if not (
    has_table_privilege('authenticated', 'public.agencies', 'SELECT')
    and has_table_privilege('authenticated', 'public.agencies', 'INSERT')
    and has_table_privilege('authenticated', 'public.agencies', 'UPDATE')
    and has_table_privilege('authenticated', 'public.agencies', 'DELETE')
  ) then
    raise exception 'authenticated agency privileges are incomplete';
  end if;
end;
$$;

select 'agency dashboard test passed' as result;

rollback;
