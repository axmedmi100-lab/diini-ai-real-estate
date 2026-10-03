begin;

create or replace function public.request_widget_viewing(
  target_agency_id uuid,
  target_conversation_id uuid,
  session_token uuid,
  target_property_id uuid,
  requested_starts_at timestamptz
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  target_lead_id uuid;
  viewing_id uuid;
begin
  if requested_starts_at <= now() then raise exception 'viewing must be in the future'; end if;

  select lead_id into target_lead_id
  from public.conversations
  where id = target_conversation_id
    and agency_id = target_agency_id
    and public_session_token = session_token
    and channel = 'website';

  if target_lead_id is null then raise exception 'lead required before viewing'; end if;
  if not exists (select 1 from public.properties where id = target_property_id and agency_id = target_agency_id and status = 'available') then raise exception 'property unavailable'; end if;

  insert into public.viewings (agency_id, lead_id, property_id, starts_at, status, notes)
  values (target_agency_id, target_lead_id, target_property_id, requested_starts_at, 'requested', 'Requested through website AI chat')
  returning id into viewing_id;

  update public.leads set status = 'viewing', updated_at = now()
  where id = target_lead_id and agency_id = target_agency_id;

  insert into public.notifications (agency_id, type, title, body, entity_type, entity_id)
  values (target_agency_id, 'viewing_requested', 'Viewing cusub ayaa la codsaday', 'Customer website-ka jooga ayaa codsaday viewing.', 'viewing', viewing_id);

  insert into public.messages (agency_id, conversation_id, sender_type, message, metadata)
  values (target_agency_id, target_conversation_id, 'system', 'Viewing requested', jsonb_build_object('viewing_id', viewing_id, 'property_id', target_property_id, 'starts_at', requested_starts_at));

  return viewing_id;
end;
$$;

revoke all on function public.request_widget_viewing(uuid, uuid, uuid, uuid, timestamptz) from public;
grant execute on function public.request_widget_viewing(uuid, uuid, uuid, uuid, timestamptz) to anon, authenticated;

commit;
