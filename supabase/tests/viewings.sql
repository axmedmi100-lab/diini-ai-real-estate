begin;

do $$
begin
  if to_regclass('public.viewings') is null then raise exception 'viewings table missing'; end if;
  if to_regprocedure('public.request_widget_viewing(uuid,uuid,uuid,uuid,timestamptz)') is null then raise exception 'widget viewing RPC missing'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'viewings_agency_status_idx') then raise exception 'viewing tenant/status index missing'; end if;
end;
$$;

do $$
declare
  conversation_fixture record;
  property_fixture record;
  created_viewing_id uuid;
begin
  select id, agency_id, public_session_token, lead_id into conversation_fixture
  from public.conversations
  where channel = 'website' and public_session_token is not null and lead_id is not null
  order by updated_at desc limit 1;

  if conversation_fixture.id is not null then
    select id into property_fixture
    from public.properties
    where agency_id = conversation_fixture.agency_id and status = 'available'
    order by created_at desc limit 1;
  end if;

  if conversation_fixture.id is not null and property_fixture.id is not null then
    created_viewing_id := public.request_widget_viewing(
      conversation_fixture.agency_id,
      conversation_fixture.id,
      conversation_fixture.public_session_token,
      property_fixture.id,
      now() + interval '1 day'
    );
    if not exists (select 1 from public.viewings where id = created_viewing_id and status = 'requested') then raise exception 'widget viewing was not created'; end if;
    if not exists (select 1 from public.notifications where entity_type = 'viewing' and entity_id = created_viewing_id) then raise exception 'widget viewing notification missing'; end if;
  end if;
end;
$$;

select 'viewings database test passed' as result;
rollback;
