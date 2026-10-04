begin;
do $$
declare fixture record; before_count integer; after_count integer;
begin
  select c.id, c.agency_id, c.public_session_token into fixture
  from public.conversations c
  where c.channel='website' and c.public_session_token is not null
  limit 1;
  if fixture.id is null then raise exception 'Website conversation fixture required'; end if;
  update public.conversations set status='human_active' where id=fixture.id;
  select count(*) into before_count from public.messages where conversation_id=fixture.id;
  perform public.append_widget_customer_message(fixture.agency_id,fixture.id,fixture.public_session_token,'Human takeover safety test');
  select count(*) into after_count from public.messages where conversation_id=fixture.id;
  if after_count <> before_count + 1 then raise exception 'Customer message was not stored exactly once'; end if;
  begin
    perform public.append_widget_exchange(fixture.agency_id,fixture.id,fixture.public_session_token,'Must not send','Forbidden AI reply');
    raise exception 'AI replied during human takeover';
  exception when others then
    if sqlerrm = 'AI replied during human takeover' then raise; end if;
  end;
  if exists(select 1 from public.messages where conversation_id=fixture.id and message='Forbidden AI reply') then raise exception 'Forbidden AI message stored'; end if;
end $$;
rollback;
select 'human takeover safety test passed' as result;
