begin;

alter table public.customers
  add column if not exists follow_up_opted_out boolean not null default false,
  add column if not exists follow_up_opted_out_at timestamptz;

create table if not exists public.follow_up_rules (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  is_enabled boolean not null default true,
  delay_minutes integer not null check (delay_minutes between 5 and 43200),
  channel public.conversation_channel not null default 'website',
  message_template text not null,
  max_follow_ups smallint not null default 1 check (max_follow_ups between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id)
);

alter table public.follow_ups
  add column if not exists rule_id uuid,
  add column if not exists sequence_no smallint not null default 1 check (sequence_no between 1 and 5);

alter table public.follow_ups drop constraint if exists follow_ups_rule_id_fkey;
alter table public.follow_ups add constraint follow_ups_rule_id_fkey
  foreign key (rule_id, agency_id) references public.follow_up_rules(id, agency_id) on delete set null;

create unique index if not exists follow_ups_rule_lead_sequence_unique
  on public.follow_ups (rule_id, lead_id, sequence_no) where rule_id is not null;
create index if not exists follow_up_rules_agency_enabled_idx
  on public.follow_up_rules (agency_id, is_enabled);

alter table public.follow_up_rules enable row level security;
alter table public.follow_up_rules force row level security;
drop policy if exists tenant_select on public.follow_up_rules;
drop policy if exists tenant_insert on public.follow_up_rules;
drop policy if exists tenant_update on public.follow_up_rules;
drop policy if exists tenant_delete on public.follow_up_rules;
create policy tenant_select on public.follow_up_rules for select to authenticated using (public.is_agency_member(agency_id));
create policy tenant_insert on public.follow_up_rules for insert to authenticated with check (public.can_manage_agency(agency_id));
create policy tenant_update on public.follow_up_rules for update to authenticated using (public.can_manage_agency(agency_id)) with check (public.can_manage_agency(agency_id));
create policy tenant_delete on public.follow_up_rules for delete to authenticated using (public.can_manage_agency(agency_id));

drop trigger if exists set_follow_up_rules_updated_at on public.follow_up_rules;
create trigger set_follow_up_rules_updated_at before update on public.follow_up_rules for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.follow_up_rules to authenticated;

create or replace function public.schedule_follow_ups_for_lead()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare rule_record record;
declare conversation_uuid uuid;
begin
  if new.status in ('won', 'lost') then return new; end if;
  select id into conversation_uuid from public.conversations where agency_id = new.agency_id and lead_id = new.id order by updated_at desc limit 1;
  for rule_record in select * from public.follow_up_rules where agency_id = new.agency_id and is_enabled loop
    insert into public.follow_ups (agency_id, lead_id, conversation_id, rule_id, sequence_no, channel, scheduled_for, message_template)
    values (new.agency_id, new.id, conversation_uuid, rule_record.id, 1, rule_record.channel, now() + make_interval(mins => rule_record.delay_minutes), rule_record.message_template)
    on conflict (rule_id, lead_id, sequence_no) where rule_id is not null do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists schedule_follow_ups_after_lead_insert on public.leads;
create trigger schedule_follow_ups_after_lead_insert after insert on public.leads for each row execute function public.schedule_follow_ups_for_lead();

create or replace function public.process_due_follow_ups(batch_limit integer default 50)
returns table(processed integer, sent integer, opted_out integer, failed integer)
language plpgsql security definer set search_path = ''
as $$
declare
  item record;
  customer_opted_out boolean;
  rule_record record;
  processed_count integer := 0;
  sent_count integer := 0;
  opted_out_count integer := 0;
  failed_count integer := 0;
begin
  for item in
    select f.* from public.follow_ups f
    where f.status = 'pending' and f.scheduled_for <= now()
    order by f.scheduled_for
    for update skip locked
    limit greatest(1, least(batch_limit, 200))
  loop
    processed_count := processed_count + 1;
    begin
      select coalesce(c.follow_up_opted_out, false) into customer_opted_out
      from public.leads l left join public.customers c on c.id = l.customer_id and c.agency_id = l.agency_id
      where l.id = item.lead_id and l.agency_id = item.agency_id;

      if coalesce(customer_opted_out, false) then
        update public.follow_ups set status = 'opted_out', updated_at = now() where id = item.id;
        opted_out_count := opted_out_count + 1;
        continue;
      end if;

      update public.follow_ups set status = 'processing', attempt_count = attempt_count + 1, updated_at = now() where id = item.id;
      if item.channel = 'website' and item.conversation_id is not null then
        insert into public.messages (agency_id, conversation_id, sender_type, message, metadata)
        values (item.agency_id, item.conversation_id, 'ai', item.message_template, jsonb_build_object('follow_up_id', item.id));
      else
        insert into public.notifications (agency_id, type, title, body, entity_type, entity_id)
        values (item.agency_id, 'follow_up_due', 'Follow-up waqtigiisii gaaray', item.message_template, 'follow_up', item.id);
      end if;
      update public.follow_ups set status = 'sent', sent_at = now(), updated_at = now() where id = item.id;
      sent_count := sent_count + 1;

      if item.rule_id is not null then
        select * into rule_record from public.follow_up_rules where id = item.rule_id and agency_id = item.agency_id and is_enabled;
        if rule_record.id is not null and item.sequence_no < rule_record.max_follow_ups
          and exists (select 1 from public.leads where id = item.lead_id and agency_id = item.agency_id and status not in ('won','lost')) then
          insert into public.follow_ups (agency_id, lead_id, conversation_id, rule_id, sequence_no, channel, scheduled_for, message_template)
          values (item.agency_id, item.lead_id, item.conversation_id, item.rule_id, item.sequence_no + 1, item.channel, now() + make_interval(mins => rule_record.delay_minutes), rule_record.message_template)
          on conflict (rule_id, lead_id, sequence_no) where rule_id is not null do nothing;
        end if;
      end if;
    exception when others then
      update public.follow_ups set status = 'failed', attempt_count = attempt_count + 1, updated_at = now() where id = item.id;
      failed_count := failed_count + 1;
    end;
  end loop;
  return query select processed_count, sent_count, opted_out_count, failed_count;
end;
$$;

revoke all on function public.process_due_follow_ups(integer) from public;
grant execute on function public.process_due_follow_ups(integer) to service_role;

do $$
begin
  execute 'create extension if not exists pg_cron';
  if not exists (select 1 from cron.job where jobname = 'diini-process-follow-ups') then
    perform cron.schedule('diini-process-follow-ups', '*/5 * * * *', 'select public.process_due_follow_ups(100);');
  end if;
exception when insufficient_privilege or undefined_table then
  raise notice 'pg_cron unavailable; use /api/cron/follow-ups with an external scheduler';
end;
$$;

commit;
