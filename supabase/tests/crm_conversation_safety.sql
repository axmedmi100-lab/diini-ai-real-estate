begin;

do $$
declare fixture record; before_count integer; after_count integer;
begin
  select c.id, c.agency_id, c.public_session_token into fixture
  from public.conversations c
  where c.channel='website' and c.public_session_token is not null limit 1;
  if fixture.id is null then raise exception 'Website conversation fixture required'; end if;
  update public.conversations set status='human_active' where id=fixture.id;
  select count(*) into before_count from public.messages where conversation_id=fixture.id;
  begin
    perform public.append_widget_exchange(fixture.agency_id,fixture.id,fixture.public_session_token,'customer','AI must remain paused');
  exception when others then null;
  end;
  select count(*) into after_count from public.messages where conversation_id=fixture.id;
  if after_count <> before_count then raise exception 'AI exchange was stored during human takeover'; end if;
end $$;

rollback;
