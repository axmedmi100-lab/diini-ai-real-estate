begin;

alter table public.follow_ups
  add column if not exists property_id uuid,
  add column if not exists outreach_kind text not null default 'general';

alter table public.follow_ups drop constraint if exists follow_ups_property_id_fkey;
alter table public.follow_ups add constraint follow_ups_property_id_fkey
  foreign key (property_id, agency_id) references public.properties(id, agency_id) on delete cascade;

create unique index if not exists follow_ups_property_lead_outreach_unique
  on public.follow_ups (property_id, lead_id, outreach_kind)
  where property_id is not null;

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

  insert into public.follow_ups (
    agency_id, lead_id, conversation_id, property_id, outreach_kind,
    channel, scheduled_for, message_template
  )
  select
    l.agency_id, l.id, cv.id, property_record.id, 'property_match',
    'whatsapp'::public.conversation_channel, now(),
    'Property cusub oo kugu habboon ayaa la helay: ' || property_record.title ||
    ' — ' || coalesce(property_record.district, '') ||
    ', ' || coalesce(property_record.currency, 'USD') || ' ' || property_record.price::text ||
    '. Haddii aad xiisaynayso, ku jawaab “viewing” si aad ballan u qabsato.'
  from public.leads l
  join lateral (
    select c.id
    from public.conversations c
    where c.agency_id=l.agency_id and c.lead_id=l.id and c.channel='whatsapp'
      and c.status in ('open','ai_active') and c.external_thread_id is not null
    order by c.updated_at desc
    limit 1
  ) cv on true
  left join public.customers cu on cu.id=l.customer_id and cu.agency_id=l.agency_id
  where l.agency_id=target_agency_id
    and l.status not in ('won','lost')
    and coalesce(cu.follow_up_opted_out,false)=false
    and (l.purpose is null or l.purpose=property_record.purpose)
    and (l.district is null or lower(regexp_replace(l.district,'[^[:alnum:]]','','g'))=lower(regexp_replace(property_record.district,'[^[:alnum:]]','','g')))
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

drop function if exists public.claim_due_follow_ups(integer);
create function public.claim_due_follow_ups(batch_limit integer default 50)
returns table (
  id uuid, agency_id uuid, lead_id uuid, conversation_id uuid,
  channel public.conversation_channel, message_template text,
  attempt_count smallint, max_attempts smallint,
  external_thread_id text, conversation_status public.conversation_status,
  customer_opted_out boolean, property_id uuid, property_title text, property_image_url text
)
language plpgsql security definer set search_path = '' as $$
begin
  update public.follow_ups
  set status='pending', processing_started_at=null,
      last_error=coalesce(last_error,'Worker timeout; dib ayaa loo safay.'), updated_at=now()
  where status='processing' and processing_started_at < now() - interval '15 minutes';

  return query
  with candidates as (
    select f.id from public.follow_ups f
    where f.status='pending' and f.scheduled_for<=now()
    order by f.scheduled_for for update skip locked
    limit greatest(1,least(batch_limit,100))
  ), claimed as (
    update public.follow_ups f
    set status='processing',attempt_count=f.attempt_count+1,
        processing_started_at=now(),last_error=null,updated_at=now()
    from candidates c where f.id=c.id returning f.*
  )
  select c.id,c.agency_id,c.lead_id,c.conversation_id,c.channel,c.message_template,
         c.attempt_count,c.max_attempts,cv.external_thread_id,cv.status,
         coalesce(cu.follow_up_opted_out,false),c.property_id,p.title,
         case when jsonb_typeof(p.image_urls)='array' then p.image_urls->>0 else null end
  from claimed c
  join public.leads l on l.id=c.lead_id and l.agency_id=c.agency_id
  left join public.customers cu on cu.id=l.customer_id and cu.agency_id=l.agency_id
  left join public.conversations cv on cv.id=c.conversation_id and cv.agency_id=c.agency_id
  left join public.properties p on p.id=c.property_id and p.agency_id=c.agency_id;
end;
$$;

revoke all on function public.schedule_property_match_outreach(uuid,uuid) from public;
revoke all on function public.claim_due_follow_ups(integer) from public;
grant execute on function public.schedule_property_match_outreach(uuid,uuid) to authenticated;
grant execute on function public.claim_due_follow_ups(integer) to service_role;

commit;

