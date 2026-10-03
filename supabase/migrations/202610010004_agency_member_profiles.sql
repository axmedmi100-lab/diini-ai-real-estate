begin;

create or replace function public.can_view_agency_profile(target_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select target_user_id = auth.uid() or exists (
    select 1
    from public.agency_members viewer
    join public.agency_members target on target.agency_id = viewer.agency_id
    where viewer.user_id = auth.uid()
      and viewer.is_active = true
      and target.user_id = target_user_id
      and target.is_active = true
  );
$$;

revoke all on function public.can_view_agency_profile(uuid) from public;
grant execute on function public.can_view_agency_profile(uuid) to authenticated;

drop policy if exists profiles_select on public.user_profiles;
create policy profiles_select on public.user_profiles for select to authenticated
  using (public.can_view_agency_profile(id));

commit;
