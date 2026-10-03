begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'conversations' and column_name = 'public_session_token') then
    raise exception 'public chat token is missing';
  end if;
  if to_regprocedure('public.get_widget_config(uuid)') is null then raise exception 'widget config RPC missing'; end if;
  if to_regprocedure('public.start_widget_conversation(uuid,uuid)') is null then raise exception 'widget start RPC missing'; end if;
  if to_regprocedure('public.search_widget_properties(uuid,public.property_purpose,text,numeric,numeric,smallint,text,boolean)') is null then raise exception 'property search RPC missing'; end if;
  if to_regprocedure('public.upsert_widget_lead(uuid,uuid,uuid,text,text,text,public.property_purpose,text,numeric,numeric,smallint,text,boolean)') is null then raise exception 'lead RPC missing'; end if;
  if to_regprocedure('public.request_widget_handoff(uuid,uuid,uuid)') is null then raise exception 'handoff RPC missing'; end if;
end;
$$;

select 'website chat database test passed' as result;
rollback;
