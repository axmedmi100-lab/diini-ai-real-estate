begin;

alter table public.agency_members
  add column if not exists availability text not null default 'offline'
  check (availability in ('online', 'away', 'offline'));

create table public.agency_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  email text not null,
  role public.agency_role not null,
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (role <> 'owner'),
  check (email = lower(trim(email)))
);

alter table public.agency_invitations enable row level security;
alter table public.agency_invitations force row level security;

create policy invitations_select on public.agency_invitations for select to authenticated
  using (public.has_agency_role(agency_id, array['owner']::public.agency_role[]));

create index agency_invitations_agency_created_idx
  on public.agency_invitations (agency_id, created_at desc);
create unique index agency_invitations_pending_email_idx
  on public.agency_invitations (agency_id, email)
  where accepted_at is null and revoked_at is null;
create index conversations_handoff_queue_idx
  on public.conversations (agency_id, status, assigned_agent_id, updated_at desc);

create or replace function public.create_agency_invitation(
  target_email text,
  target_role public.agency_role,
  raw_token text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  caller_agency_id uuid;
  invitation_id uuid;
  normalized_email text := lower(trim(target_email));
begin
  select m.agency_id into caller_agency_id
  from public.agency_members m
  join public.agencies a on a.id = m.agency_id
  where m.user_id = auth.uid() and m.is_active and m.role = 'owner'
    and a.lifecycle_status in ('trial', 'active')
  limit 1;

  if caller_agency_id is null then raise exception 'only an active agency owner can invite members'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid email'; end if;
  if target_role = 'owner' then raise exception 'owner role cannot be invited'; end if;
  if char_length(raw_token) < 32 then raise exception 'invalid invitation token'; end if;
  if exists (select 1 from public.agency_members m join auth.users u on u.id=m.user_id where m.agency_id=caller_agency_id and lower(u.email)=normalized_email) then
    raise exception 'user is already a member';
  end if;

  update public.agency_invitations set revoked_at = now()
  where agency_id = caller_agency_id and email = normalized_email
    and accepted_at is null and revoked_at is null;

  insert into public.agency_invitations (agency_id,email,role,token_hash,invited_by)
  values (caller_agency_id,normalized_email,target_role,encode(extensions.digest(raw_token,'sha256'),'hex'),auth.uid())
  returning id into invitation_id;

  insert into public.audit_logs (agency_id,user_id,action,entity_type,entity_id,metadata)
  values (caller_agency_id,auth.uid(),'member.invited','agency_invitation',invitation_id,jsonb_build_object('email',normalized_email,'role',target_role));
  return invitation_id;
end;
$$;

create or replace function public.get_agency_invitation_preview(raw_token text)
returns table (agency_name text, email text, role public.agency_role, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select a.name, i.email, i.role, i.expires_at
  from public.agency_invitations i join public.agencies a on a.id=i.agency_id
  where i.token_hash=encode(extensions.digest(raw_token,'sha256'),'hex')
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    and a.lifecycle_status in ('trial','active')
  limit 1;
$$;

create or replace function public.accept_agency_invitation(raw_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  invitation public.agency_invitations%rowtype;
  user_email text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select lower(email) into user_email from auth.users where id=auth.uid();
  select * into invitation from public.agency_invitations
  where token_hash=encode(extensions.digest(raw_token,'sha256'),'hex')
    and accepted_at is null and revoked_at is null and expires_at > now()
  for update;
  if invitation.id is null then raise exception 'invitation is invalid or expired'; end if;
  if invitation.email <> user_email then raise exception 'invitation email does not match signed-in user'; end if;

  insert into public.agency_members (agency_id,user_id,role,invited_by)
  values (invitation.agency_id,auth.uid(),invitation.role,invitation.invited_by)
  on conflict (agency_id,user_id) do update set role=excluded.role,is_active=true,invited_by=excluded.invited_by;
  update public.agency_invitations set accepted_at=now(),accepted_by=auth.uid() where id=invitation.id;
  insert into public.audit_logs (agency_id,user_id,action,entity_type,entity_id,metadata)
  values (invitation.agency_id,auth.uid(),'member.invitation_accepted','agency_member',auth.uid(),jsonb_build_object('invitation_id',invitation.id));
  return invitation.agency_id;
end;
$$;

create or replace function public.set_my_agency_availability(new_availability text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if new_availability not in ('online','away','offline') then raise exception 'invalid availability'; end if;
  update public.agency_members set availability=new_availability
  where user_id=auth.uid() and is_active;
  if not found then raise exception 'active membership not found'; end if;
end;
$$;

create or replace function public.assign_conversation_agent(target_conversation_id uuid, target_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_agency_id uuid;
  caller_member public.agency_members%rowtype;
  target_member public.agency_members%rowtype;
begin
  select agency_id into target_agency_id from public.conversations where id=target_conversation_id;
  select * into caller_member from public.agency_members where agency_id=target_agency_id and user_id=auth.uid() and is_active;
  if caller_member.id is null then raise exception 'unauthorized'; end if;
  select * into target_member from public.agency_members where id=target_member_id and agency_id=target_agency_id and is_active;
  if target_member.id is null then raise exception 'target member is not active in this agency'; end if;
  if caller_member.role not in ('owner','admin','manager') and caller_member.id <> target_member.id then
    raise exception 'only managers can assign another member';
  end if;

  update public.conversations set assigned_agent_id=target_member.id,status='human_active' where id=target_conversation_id and agency_id=target_agency_id;
  insert into public.notifications (agency_id,user_id,type,title,body,entity_type,entity_id)
  values (target_agency_id,target_member.user_id,'conversation_assigned','Conversation laguu xilsaaray','Customer ayaa sugaya jawaabtaada.','conversation',target_conversation_id);
  insert into public.audit_logs (agency_id,user_id,action,entity_type,entity_id,metadata)
  values (target_agency_id,auth.uid(),'conversation.assigned','conversation',target_conversation_id,jsonb_build_object('member_id',target_member.id));
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_agency_id uuid;
  agency_name text;
  agency_slug text;
  invitation public.agency_invitations%rowtype;
  invitation_token text := nullif(new.raw_user_meta_data ->> 'invitation_token','');
begin
  insert into public.user_profiles (id,full_name,preferred_language)
  values (new.id,nullif(trim(new.raw_user_meta_data ->> 'full_name'),''),case when new.raw_user_meta_data ->> 'preferred_language'='en' then 'en' else 'so' end)
  on conflict (id) do nothing;

  if invitation_token is not null then
    select * into invitation from public.agency_invitations
    where token_hash=encode(extensions.digest(invitation_token,'sha256'),'hex')
      and accepted_at is null and revoked_at is null and expires_at > now()
    for update;
    if invitation.id is null or invitation.email <> lower(new.email) then
      raise exception 'invalid invitation for this email';
    end if;
    insert into public.agency_members (agency_id,user_id,role,invited_by)
    values (invitation.agency_id,new.id,invitation.role,invitation.invited_by);
    update public.agency_invitations set accepted_at=now(),accepted_by=new.id where id=invitation.id;
    return new;
  end if;

  agency_name := nullif(trim(new.raw_user_meta_data ->> 'agency_name'),'');
  if agency_name is not null then
    agency_slug := trim(both '-' from regexp_replace(lower(agency_name),'[^a-z0-9]+','-','g'));
    if agency_slug='' then agency_slug:='agency'; end if;
    agency_slug := agency_slug || '-' || left(replace(new.id::text,'-',''),8);
    insert into public.agencies (created_by,name,slug) values (new.id,agency_name,agency_slug) returning id into new_agency_id;
    insert into public.agency_members (agency_id,user_id,role) values (new_agency_id,new.id,'owner');
    insert into public.ai_settings (agency_id) values (new_agency_id);
  end if;
  return new;
end;
$$;

revoke all on function public.create_agency_invitation(text,public.agency_role,text) from public;
revoke all on function public.get_agency_invitation_preview(text) from public;
revoke all on function public.accept_agency_invitation(text) from public;
revoke all on function public.set_my_agency_availability(text) from public;
revoke all on function public.assign_conversation_agent(uuid,uuid) from public;
grant execute on function public.create_agency_invitation(text,public.agency_role,text) to authenticated;
grant execute on function public.get_agency_invitation_preview(text) to anon,authenticated;
grant execute on function public.accept_agency_invitation(text) to authenticated;
grant execute on function public.set_my_agency_availability(text) to authenticated;
grant execute on function public.assign_conversation_agent(uuid,uuid) to authenticated;

commit;
