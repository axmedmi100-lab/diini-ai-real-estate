begin;

create or replace function public.get_widget_conversation_state(
  target_agency_id uuid,
  target_conversation_id uuid,
  session_token uuid
)
returns public.conversation_status
language sql stable security definer set search_path = ''
as $$
  select status
  from public.conversations
  where id = target_conversation_id
    and agency_id = target_agency_id
    and public_session_token = session_token
    and channel = 'website';
$$;

create or replace function public.append_widget_customer_message(
  target_agency_id uuid,
  target_conversation_id uuid,
  session_token uuid,
  customer_message text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.conversations
    where id = target_conversation_id
      and agency_id = target_agency_id
      and public_session_token = session_token
      and channel = 'website'
      and status = 'human_active'
  ) then raise exception 'conversation is not in human takeover'; end if;

  insert into public.messages (agency_id, conversation_id, sender_type, message)
  values (target_agency_id, target_conversation_id, 'customer', left(customer_message, 2000));
  update public.conversations set updated_at = now() where id = target_conversation_id;
end;
$$;

create or replace function public.append_widget_exchange(
  target_agency_id uuid,
  target_conversation_id uuid,
  session_token uuid,
  customer_message text,
  assistant_message text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.conversations
    where id = target_conversation_id
      and agency_id = target_agency_id
      and public_session_token = session_token
      and channel = 'website'
      and status in ('open', 'ai_active')
  ) then raise exception 'AI is paused for this conversation'; end if;

  insert into public.messages (agency_id, conversation_id, sender_type, message)
  values
    (target_agency_id, target_conversation_id, 'customer', left(customer_message, 2000)),
    (target_agency_id, target_conversation_id, 'ai', left(assistant_message, 4000));
  update public.conversations set updated_at = now() where id = target_conversation_id;
end;
$$;

revoke all on function public.get_widget_conversation_state(uuid, uuid, uuid) from public;
revoke all on function public.append_widget_customer_message(uuid, uuid, uuid, text) from public;
grant execute on function public.get_widget_conversation_state(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.append_widget_customer_message(uuid, uuid, uuid, text) to anon, authenticated;

commit;
