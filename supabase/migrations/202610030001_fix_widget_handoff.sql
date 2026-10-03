begin;

create or replace function public.request_widget_handoff(
  target_agency_id uuid,
  target_conversation_id uuid,
  session_token uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversations
  set status = 'human_active', updated_at = now()
  where id = target_conversation_id
    and agency_id = target_agency_id
    and public_session_token = session_token
    and channel = 'website';

  if not found then raise exception 'invalid conversation'; end if;

  if not exists (
    select 1 from public.notifications
    where agency_id = target_agency_id
      and type = 'human_handoff'
      and entity_type = 'conversation'
      and entity_id = target_conversation_id
      and read_at is null
  ) then
    insert into public.notifications (agency_id, type, title, body, entity_type, entity_id)
    values (
      target_agency_id,
      'human_handoff',
      'Macmiil wuxuu codsaday qof',
      'Website chat-ka ayaa u baahan agent bani-aadam ah.',
      'conversation',
      target_conversation_id
    );
  end if;
end;
$$;

revoke all on function public.request_widget_handoff(uuid, uuid, uuid) from public;
grant execute on function public.request_widget_handoff(uuid, uuid, uuid) to anon, authenticated;

commit;
