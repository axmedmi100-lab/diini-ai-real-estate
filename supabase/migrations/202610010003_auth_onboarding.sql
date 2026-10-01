begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_agency_id uuid;
  agency_name text;
  agency_slug text;
begin
  insert into public.user_profiles (id, full_name, preferred_language)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case
      when new.raw_user_meta_data ->> 'preferred_language' = 'en' then 'en'
      else 'so'
    end
  )
  on conflict (id) do nothing;

  agency_name := nullif(trim(new.raw_user_meta_data ->> 'agency_name'), '');

  if agency_name is not null then
    agency_slug := trim(both '-' from regexp_replace(lower(agency_name), '[^a-z0-9]+', '-', 'g'));

    if agency_slug = '' then
      agency_slug := 'agency';
    end if;

    agency_slug := agency_slug || '-' || left(replace(new.id::text, '-', ''), 8);

    insert into public.agencies (created_by, name, slug)
    values (new.id, agency_name, agency_slug)
    returning id into new_agency_id;

    insert into public.agency_members (agency_id, user_id, role)
    values (new_agency_id, new.id, 'owner');

    insert into public.ai_settings (agency_id)
    values (new_agency_id);
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
