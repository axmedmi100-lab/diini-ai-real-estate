begin;

create or replace function public.canonical_district_key(input_value text)
returns text
language sql immutable
set search_path = '' as $$
  select case lower(regexp_replace(coalesce(input_value,''),'[^[:alnum:]]','','g'))
    when 'daarusalaam' then 'daarusalaam'
    when 'darusalaam' then 'daarusalaam'
    when 'daaralsalaam' then 'daarusalaam'
    when 'saytuunvillage' then 'saytuunvillage'
    when 'seytuunvillage' then 'saytuunvillage'
    else lower(regexp_replace(coalesce(input_value,''),'[^[:alnum:]]','','g'))
  end;
$$;

create or replace function public.schedule_property_match_outreach(target_agency_id uuid, target_property_id uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  property_record public.properties%rowtype;
  inserted_count integer := 0;
begin
  if not public.has_agency_role(target_agency_id, array['owner','admin','manager','agent']::public.agency_role[]) then
    raise exception 'unauthorized';
  end if;
  select * into property_record from public.properties
  where id=target_property_id and agency_id=target_agency_id and status='available';
  if property_record.id is null then raise exception 'available property not found'; end if;

  insert into public.follow_ups (agency_id,lead_id,conversation_id,property_id,outreach_kind,channel,scheduled_for,message_template)
  select l.agency_id,l.id,cv.id,property_record.id,'property_match','whatsapp'::public.conversation_channel,now(),
    'Property cusub oo kugu habboon ayaa la helay: ' || property_record.title || ' — ' || coalesce(property_record.district,'') || ', ' || coalesce(property_record.currency,'USD') || ' ' || property_record.price::text || '. Haddii aad xiisaynayso, ku jawaab “viewing” si aad ballan u qabsato.'
  from public.leads l
  join lateral (
    select c.id from public.conversations c
    where c.agency_id=l.agency_id and c.lead_id=l.id and c.channel='whatsapp'
      and c.status in ('open','ai_active') and c.external_thread_id is not null
    order by c.updated_at desc limit 1
  ) cv on true
  left join public.customers cu on cu.id=l.customer_id and cu.agency_id=l.agency_id
  where l.agency_id=target_agency_id
    and l.status not in ('won','lost')
    and coalesce(cu.follow_up_opted_out,false)=false
    and (l.purpose is null or l.purpose=property_record.purpose)
    and (l.district is null or public.canonical_district_key(l.district)=public.canonical_district_key(property_record.district))
    and (l.budget_min is null or property_record.price>=l.budget_min)
    and (l.budget_max is null or property_record.price<=l.budget_max)
    and (l.bedrooms is null or property_record.bedrooms>=l.bedrooms)
    and (l.property_type is null or lower(l.property_type)=lower(property_record.property_type))
    and (l.furnished is null or l.furnished=property_record.furnished)
  on conflict (property_id,lead_id,outreach_kind) where property_id is not null do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.canonical_district_key(text) from public;
revoke all on function public.schedule_property_match_outreach(uuid,uuid) from public;
grant execute on function public.schedule_property_match_outreach(uuid,uuid) to authenticated;

commit;

