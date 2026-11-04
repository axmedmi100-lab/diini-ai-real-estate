begin;

alter table public.agency_invitations
  drop constraint if exists agency_invitations_role_check;

create or replace function public.platform_create_agency_with_owner_invite(
  agency_name text,
  agency_slug text,
  owner_email text,
  agency_plan text,
  agency_status public.agency_lifecycle_status,
  raw_token text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  new_id uuid;
  normalized_email text := lower(trim(owner_email));
begin
  if actor_id is null or not public.is_platform_super_admin() then
    raise exception 'unauthorized platform actor';
  end if;
  if not exists (select 1 from public.platform_plans where code=agency_plan and is_active) then
    raise exception 'invalid plan';
  end if;
  if char_length(trim(agency_name)) < 2 or agency_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid agency';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid owner email';
  end if;
  if char_length(raw_token) < 32 then raise exception 'invalid invitation token'; end if;

  insert into public.agencies (created_by,name,slug,email,plan_code,lifecycle_status)
  values (actor_id,trim(agency_name),agency_slug,normalized_email,agency_plan,agency_status)
  returning id into new_id;

  insert into public.agency_invitations (agency_id,email,role,token_hash,invited_by)
  values (new_id,normalized_email,'owner',encode(extensions.digest(raw_token,'sha256'),'hex'),actor_id);

  insert into public.platform_audit_logs(actor_user_id,action,target_agency_id,metadata)
  values(actor_id,'agency.created_with_owner_invite',new_id,jsonb_build_object(
    'plan_code',agency_plan,'lifecycle_status',agency_status,'owner_email',normalized_email
  ));
  return new_id;
end;
$$;

revoke all on function public.platform_create_agency_with_owner_invite(text,text,text,text,public.agency_lifecycle_status,text) from public;
grant execute on function public.platform_create_agency_with_owner_invite(text,text,text,text,public.agency_lifecycle_status,text) to authenticated;

commit;

