begin;

alter table public.follow_ups
  add column if not exists max_attempts smallint not null default 3 check (max_attempts between 1 and 10),
  add column if not exists last_error text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists provider_message_id text;

create index if not exists follow_ups_worker_claim_idx
  on public.follow_ups (status, scheduled_for)
  where status in ('pending','processing');

create or replace function public.claim_due_follow_ups(batch_limit integer default 50)
returns table (
  id uuid, agency_id uuid, lead_id uuid, conversation_id uuid,
  channel public.conversation_channel, message_template text,
  attempt_count smallint, max_attempts smallint,
  external_thread_id text, conversation_status public.conversation_status,
  customer_opted_out boolean
)
language plpgsql security definer set search_path = '' as $$
begin
  update public.follow_ups
  set status='pending', processing_started_at=null,
      last_error=coalesce(last_error,'Worker timeout; dib ayaa loo safay.'), updated_at=now()
  where status='processing' and processing_started_at < now() - interval '15 minutes';

  return query
  with candidates as (
    select f.id
    from public.follow_ups f
    where f.status='pending' and f.scheduled_for <= now()
    order by f.scheduled_for
    for update skip locked
    limit greatest(1,least(batch_limit,100))
  ), claimed as (
    update public.follow_ups f
    set status='processing', attempt_count=f.attempt_count+1,
        processing_started_at=now(), last_error=null, updated_at=now()
    from candidates c where f.id=c.id
    returning f.*
  )
  select c.id,c.agency_id,c.lead_id,c.conversation_id,c.channel,c.message_template,
         c.attempt_count,c.max_attempts,cv.external_thread_id,cv.status,
         coalesce(cu.follow_up_opted_out,false)
  from claimed c
  join public.leads l on l.id=c.lead_id and l.agency_id=c.agency_id
  left join public.customers cu on cu.id=l.customer_id and cu.agency_id=l.agency_id
  left join public.conversations cv on cv.id=c.conversation_id and cv.agency_id=c.agency_id;
end;
$$;

create or replace function public.complete_follow_up_delivery(target_follow_up_id uuid, target_provider_message_id text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.follow_ups%rowtype; rule_record public.follow_up_rules%rowtype;
begin
  update public.follow_ups set status='sent',sent_at=now(),processing_started_at=null,
    provider_message_id=target_provider_message_id,last_error=null,updated_at=now()
  where id=target_follow_up_id and status='processing' returning * into item;
  if item.id is null then raise exception 'follow-up is not processing'; end if;

  if item.rule_id is not null then
    select * into rule_record from public.follow_up_rules
    where id=item.rule_id and agency_id=item.agency_id and is_enabled;
    if rule_record.id is not null and item.sequence_no < rule_record.max_follow_ups
      and exists(select 1 from public.leads where id=item.lead_id and agency_id=item.agency_id and status not in ('won','lost')) then
      insert into public.follow_ups (agency_id,lead_id,conversation_id,rule_id,sequence_no,channel,scheduled_for,message_template,max_attempts)
      values (item.agency_id,item.lead_id,item.conversation_id,item.rule_id,item.sequence_no+1,item.channel,now()+make_interval(mins=>rule_record.delay_minutes),rule_record.message_template,item.max_attempts)
      on conflict (rule_id,lead_id,sequence_no) where rule_id is not null do nothing;
    end if;
  end if;
end;
$$;

create or replace function public.fail_follow_up_delivery(target_follow_up_id uuid, failure_message text, retry_delay_minutes integer default 5)
returns text language plpgsql security definer set search_path = '' as $$
declare item public.follow_ups%rowtype; next_status text;
begin
  select * into item from public.follow_ups where id=target_follow_up_id and status='processing' for update;
  if item.id is null then raise exception 'follow-up is not processing'; end if;
  next_status := case when item.attempt_count >= item.max_attempts then 'failed' else 'pending' end;
  update public.follow_ups set status=next_status,
    scheduled_for=case when next_status='pending' then now()+make_interval(mins=>greatest(1,least(retry_delay_minutes,1440))) else scheduled_for end,
    last_error=left(coalesce(failure_message,'Delivery failed'),500),processing_started_at=null,updated_at=now()
  where id=item.id;
  if next_status='failed' then
    insert into public.notifications (agency_id,type,title,body,entity_type,entity_id)
    values (item.agency_id,'follow_up_failed','Follow-up wuu fashilmay',left(coalesce(failure_message,'Delivery failed'),500),'follow_up',item.id);
  end if;
  return next_status;
end;
$$;

create or replace function public.opt_out_claimed_follow_up(target_follow_up_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.follow_ups set status='opted_out',processing_started_at=null,
    last_error='Customer opted out',updated_at=now()
  where id=target_follow_up_id and status='processing';
end;
$$;

create or replace function public.retry_failed_follow_up(target_follow_up_id uuid, target_agency_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_agency_role(target_agency_id,array['owner','admin','manager','agent','receptionist']::public.agency_role[]) then raise exception 'unauthorized'; end if;
  update public.follow_ups set status='pending',attempt_count=0,scheduled_for=now(),last_error=null,processing_started_at=null,updated_at=now()
  where id=target_follow_up_id and agency_id=target_agency_id and status='failed';
  if not found then raise exception 'failed follow-up not found'; end if;
  insert into public.audit_logs (agency_id,user_id,action,entity_type,entity_id,metadata)
  values (target_agency_id,auth.uid(),'follow_up.retried','follow_up',target_follow_up_id,'{}'::jsonb);
end;
$$;

revoke all on function public.claim_due_follow_ups(integer) from public;
revoke all on function public.complete_follow_up_delivery(uuid,text) from public;
revoke all on function public.fail_follow_up_delivery(uuid,text,integer) from public;
revoke all on function public.opt_out_claimed_follow_up(uuid) from public;
revoke all on function public.retry_failed_follow_up(uuid,uuid) from public;
grant execute on function public.claim_due_follow_ups(integer) to service_role;
grant execute on function public.complete_follow_up_delivery(uuid,text) to service_role;
grant execute on function public.fail_follow_up_delivery(uuid,text,integer) to service_role;
grant execute on function public.opt_out_claimed_follow_up(uuid) to service_role;
grant execute on function public.retry_failed_follow_up(uuid,uuid) to authenticated;

do $$ begin
  if exists(select 1 from pg_namespace where nspname='cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='diini-process-follow-ups';
  end if;
exception when undefined_table or insufficient_privilege then
  raise notice 'Legacy database cron could not be removed; disable diini-process-follow-ups manually.';
end $$;

commit;
