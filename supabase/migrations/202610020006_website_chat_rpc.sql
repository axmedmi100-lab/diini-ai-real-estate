begin;

alter table public.conversations
  add column if not exists public_session_token uuid;

create unique index if not exists conversations_public_session_unique
  on public.conversations (public_session_token)
  where public_session_token is not null;

create or replace function public.get_widget_config(target_agency_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'agency_id', a.id,
    'agency_name', a.name,
    'logo_url', a.logo_url,
    'brand_settings', a.brand_settings,
    'assistant_name', coalesce(s.assistant_name, 'AI Property Assistant'),
    'welcome_message_so', coalesce(s.welcome_message_so, 'Ku soo dhowow. Sideen kaa caawin karaa raadinta guriga?'),
    'welcome_message_en', coalesce(s.welcome_message_en, 'Welcome. How can I help with your property search?'),
    'supported_languages', coalesce(s.supported_languages, array['so','en']),
    'human_handoff_enabled', coalesce(s.human_handoff_enabled, true),
    'is_enabled', coalesce(s.is_enabled, false)
  )
  from public.agencies a
  left join public.ai_settings s on s.agency_id = a.id
  where a.id = target_agency_id and a.is_active = true;
$$;

create or replace function public.start_widget_conversation(target_agency_id uuid, session_token uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conversation_id uuid;
  welcome text;
begin
  if not exists (select 1 from public.agencies where id = target_agency_id and is_active = true) then
    raise exception 'agency not found';
  end if;

  select id into conversation_id
  from public.conversations
  where agency_id = target_agency_id and public_session_token = session_token;

  if conversation_id is null then
    insert into public.conversations (agency_id, channel, status, public_session_token, external_thread_id)
    values (target_agency_id, 'website', 'ai_active', session_token, session_token::text)
    returning id into conversation_id;

    select coalesce(welcome_message_so, 'Ku soo dhowow. Sideen kaa caawin karaa raadinta guriga?')
      into welcome from public.ai_settings where agency_id = target_agency_id;
    welcome := coalesce(welcome, 'Ku soo dhowow. Sideen kaa caawin karaa raadinta guriga?');
    insert into public.messages (agency_id, conversation_id, sender_type, message)
    values (target_agency_id, conversation_id, 'ai', welcome);
  end if;

  return jsonb_build_object('conversation_id', conversation_id);
end;
$$;

create or replace function public.get_widget_messages(target_agency_id uuid, target_conversation_id uuid, session_token uuid)
returns table(sender_type public.message_sender, message text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.sender_type, m.message, m.created_at
  from public.messages m
  join public.conversations c on c.id = m.conversation_id and c.agency_id = m.agency_id
  where c.id = target_conversation_id
    and c.agency_id = target_agency_id
    and c.public_session_token = session_token
  order by m.created_at asc
  limit 100;
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
  ) then raise exception 'invalid conversation'; end if;

  insert into public.messages (agency_id, conversation_id, sender_type, message)
  values
    (target_agency_id, target_conversation_id, 'customer', left(customer_message, 2000)),
    (target_agency_id, target_conversation_id, 'ai', left(assistant_message, 4000));

  update public.conversations set updated_at = now() where id = target_conversation_id;
end;
$$;

create or replace function public.search_widget_properties(
  target_agency_id uuid,
  wanted_purpose public.property_purpose default null,
  wanted_district text default null,
  min_budget numeric default null,
  max_budget numeric default null,
  min_bedrooms smallint default null,
  wanted_property_type text default null,
  wanted_furnished boolean default null
)
returns table(id uuid, title text, property_type text, purpose public.property_purpose, district text, price numeric, currency text, bedrooms smallint, bathrooms smallint, furnished boolean, image_urls jsonb)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, p.property_type, p.purpose, p.district, p.price, p.currency, p.bedrooms, p.bathrooms, p.furnished, p.image_urls
  from public.properties p
  where p.agency_id = target_agency_id
    and p.status = 'available'
    and (wanted_purpose is null or p.purpose = wanted_purpose)
    and (wanted_district is null or p.district ilike '%' || wanted_district || '%')
    and (min_budget is null or p.price >= min_budget)
    and (max_budget is null or p.price <= max_budget)
    and (min_bedrooms is null or p.bedrooms >= min_bedrooms)
    and (wanted_property_type is null or p.property_type = wanted_property_type)
    and (wanted_furnished is null or p.furnished = wanted_furnished)
  order by p.created_at desc
  limit 5;
$$;

create or replace function public.upsert_widget_lead(
  target_agency_id uuid,
  target_conversation_id uuid,
  session_token uuid,
  lead_name text default null,
  lead_phone text default null,
  lead_email text default null,
  wanted_purpose public.property_purpose default null,
  wanted_district text default null,
  min_budget numeric default null,
  max_budget numeric default null,
  min_bedrooms smallint default null,
  wanted_property_type text default null,
  wanted_furnished boolean default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  existing_lead_id uuid;
  customer_uuid uuid;
  normalized text;
begin
  if not exists (select 1 from public.conversations where id = target_conversation_id and agency_id = target_agency_id and public_session_token = session_token) then
    raise exception 'invalid conversation';
  end if;

  select lead_id into existing_lead_id from public.conversations where id = target_conversation_id;
  normalized := nullif(regexp_replace(coalesce(lead_phone, ''), '\D', '', 'g'), '');

  if existing_lead_id is null then
    if lead_name is not null or lead_phone is not null or lead_email is not null then
      if normalized is not null then
        select id into customer_uuid from public.customers where agency_id = target_agency_id and normalized_phone = normalized;
      end if;
      if customer_uuid is null then
        insert into public.customers (agency_id, name, phone, normalized_phone, email)
        values (target_agency_id, lead_name, lead_phone, normalized, lead_email)
        returning id into customer_uuid;
      end if;
    end if;

    insert into public.leads (agency_id, customer_id, name, phone, email, source, purpose, district, budget_min, budget_max, bedrooms, property_type, furnished, status, notes)
    values (target_agency_id, customer_uuid, lead_name, lead_phone, lead_email, 'website', wanted_purpose, wanted_district, min_budget, max_budget, min_bedrooms, wanted_property_type, wanted_furnished, 'new', 'Website AI chat')
    returning id into existing_lead_id;
    update public.conversations set lead_id = existing_lead_id, customer_id = customer_uuid where id = target_conversation_id;
  else
    update public.leads set
      name = coalesce(lead_name, name), phone = coalesce(lead_phone, phone), email = coalesce(lead_email, email),
      purpose = coalesce(wanted_purpose, purpose), district = coalesce(wanted_district, district),
      budget_min = coalesce(min_budget, budget_min), budget_max = coalesce(max_budget, budget_max),
      bedrooms = coalesce(min_bedrooms, bedrooms), property_type = coalesce(wanted_property_type, property_type),
      furnished = coalesce(wanted_furnished, furnished), updated_at = now()
    where id = existing_lead_id and agency_id = target_agency_id;

    select customer_id into customer_uuid
    from public.leads
    where id = existing_lead_id and agency_id = target_agency_id;

    if customer_uuid is null and (lead_name is not null or lead_phone is not null or lead_email is not null) then
      if normalized is not null then
        select id into customer_uuid from public.customers where agency_id = target_agency_id and normalized_phone = normalized;
      end if;
      if customer_uuid is null then
        insert into public.customers (agency_id, name, phone, normalized_phone, email)
        values (target_agency_id, lead_name, lead_phone, normalized, lead_email)
        returning id into customer_uuid;
      end if;
      update public.leads set customer_id = customer_uuid where id = existing_lead_id and agency_id = target_agency_id;
      update public.conversations set customer_id = customer_uuid where id = target_conversation_id and agency_id = target_agency_id;
    elsif customer_uuid is not null then
      update public.customers set
        name = coalesce(lead_name, name), phone = coalesce(lead_phone, phone),
        normalized_phone = coalesce(normalized, normalized_phone), email = coalesce(lead_email, email), updated_at = now()
      where id = customer_uuid and agency_id = target_agency_id;
    end if;
  end if;
  return existing_lead_id;
end;
$$;

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

revoke all on function public.get_widget_config(uuid) from public;
revoke all on function public.start_widget_conversation(uuid, uuid) from public;
revoke all on function public.get_widget_messages(uuid, uuid, uuid) from public;
revoke all on function public.append_widget_exchange(uuid, uuid, uuid, text, text) from public;
revoke all on function public.search_widget_properties(uuid, public.property_purpose, text, numeric, numeric, smallint, text, boolean) from public;
revoke all on function public.upsert_widget_lead(uuid, uuid, uuid, text, text, text, public.property_purpose, text, numeric, numeric, smallint, text, boolean) from public;
revoke all on function public.request_widget_handoff(uuid, uuid, uuid) from public;

grant execute on function public.get_widget_config(uuid) to anon, authenticated;
grant execute on function public.start_widget_conversation(uuid, uuid) to anon, authenticated;
grant execute on function public.get_widget_messages(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.append_widget_exchange(uuid, uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.search_widget_properties(uuid, public.property_purpose, text, numeric, numeric, smallint, text, boolean) to anon, authenticated;
grant execute on function public.upsert_widget_lead(uuid, uuid, uuid, text, text, text, public.property_purpose, text, numeric, numeric, smallint, text, boolean) to anon, authenticated;
grant execute on function public.request_widget_handoff(uuid, uuid, uuid) to anon, authenticated;

commit;
