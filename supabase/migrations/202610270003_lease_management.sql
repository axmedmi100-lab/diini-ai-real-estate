begin;

alter table public.property_occupancy_records
  add column if not exists monthly_rent numeric(14,2) check (monthly_rent is null or monthly_rent >= 0),
  add column if not exists security_deposit numeric(14,2) not null default 0 check (security_deposit >= 0),
  add column if not exists lease_notes text;

alter table public.follow_ups
  add column if not exists occupancy_id uuid,
  add column if not exists lease_reminder_days integer;
alter table public.follow_ups drop constraint if exists follow_ups_occupancy_id_fkey;
alter table public.follow_ups add constraint follow_ups_occupancy_id_fkey
  foreign key (occupancy_id, agency_id) references public.property_occupancy_records(id, agency_id) on delete cascade;
alter table public.follow_ups drop constraint if exists follow_ups_lease_reminder_days_check;
alter table public.follow_ups add constraint follow_ups_lease_reminder_days_check
  check (lease_reminder_days is null or lease_reminder_days in (7,14,30));
create unique index if not exists follow_ups_lease_reminder_unique
  on public.follow_ups (occupancy_id, lease_reminder_days) where occupancy_id is not null;

create or replace function public.schedule_lease_expiry_reminders()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_lead_id uuid; reminder_days integer; reminder_time timestamptz;
begin
  if new.record_type <> 'tenancy' then return new; end if;
  update public.follow_ups set status='cancelled', updated_at=now()
  where occupancy_id=new.id and status in ('pending','processing');
  if new.status <> 'active' or new.end_date is null then return new; end if;
  select lead_id into target_lead_id from public.property_transactions
  where id=new.transaction_id and agency_id=new.agency_id;
  if target_lead_id is null then return new; end if;
  foreach reminder_days in array array[30,14,7] loop
    reminder_time := (new.end_date::timestamp - make_interval(days=>reminder_days) + interval '9 hours') at time zone 'UTC';
    if reminder_time > now() then
      insert into public.follow_ups (agency_id,lead_id,channel,scheduled_for,message_template,occupancy_id,lease_reminder_days)
      values (new.agency_id,target_lead_id,'manual',reminder_time,
        'Lease-ku wuxuu dhammaanayaa '||new.end_date||'. Waxaa harsan '||reminder_days||' maalmood. La xiriir tenant-ka renewal ama termination.',new.id,reminder_days)
      on conflict (occupancy_id,lease_reminder_days) where occupancy_id is not null
      do update set scheduled_for=excluded.scheduled_for,message_template=excluded.message_template,status='pending',attempt_count=0,sent_at=null,updated_at=now();
    end if;
  end loop;
  return new;
end;
$$;

create trigger schedule_lease_reminders_after_change
after insert or update of end_date,status on public.property_occupancy_records
for each row execute function public.schedule_lease_expiry_reminders();

commit;

