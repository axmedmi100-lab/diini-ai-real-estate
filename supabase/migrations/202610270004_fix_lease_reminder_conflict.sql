begin;

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

commit;

