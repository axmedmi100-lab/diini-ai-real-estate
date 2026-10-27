begin;

create table public.property_occupancy_records (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  property_id uuid not null,
  customer_id uuid not null,
  transaction_id uuid not null,
  record_type text not null check (record_type in ('ownership','tenancy')),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active','ended')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transaction_id),
  unique (id, agency_id),
  foreign key (property_id, agency_id) references public.properties(id, agency_id) on delete restrict,
  foreign key (customer_id, agency_id) references public.customers(id, agency_id) on delete restrict,
  foreign key (transaction_id, agency_id) references public.property_transactions(id, agency_id) on delete restrict,
  check ((status = 'active' and end_date is null) or status = 'ended')
);

alter table public.property_occupancy_records enable row level security;
alter table public.property_occupancy_records force row level security;
create policy occupancy_select on public.property_occupancy_records for select to authenticated using (public.is_agency_member(agency_id));
create policy occupancy_insert on public.property_occupancy_records for insert to authenticated with check (public.has_agency_role(agency_id, array['owner','admin','manager','agent']::public.agency_role[]));
create policy occupancy_update on public.property_occupancy_records for update to authenticated using (public.has_agency_role(agency_id, array['owner','admin','manager']::public.agency_role[])) with check (public.has_agency_role(agency_id, array['owner','admin','manager']::public.agency_role[]));
create policy occupancy_delete on public.property_occupancy_records for delete to authenticated using (public.has_agency_role(agency_id, array['owner','admin','manager']::public.agency_role[]));
create index property_occupancy_property_idx on public.property_occupancy_records (agency_id, property_id, status, start_date desc);
create index property_occupancy_customer_idx on public.property_occupancy_records (agency_id, customer_id, start_date desc);
create trigger set_property_occupancy_updated_at before update on public.property_occupancy_records for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.property_occupancy_records to authenticated;

create or replace function public.sync_property_occupancy_from_transaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_type text;
begin
  if new.transaction_type not in ('buy','rent') then return new; end if;
  target_type := case when new.transaction_type = 'buy' then 'ownership' else 'tenancy' end;
  if new.status = 'completed' then
    update public.property_occupancy_records
    set status = 'ended', end_date = greatest(new.transaction_date - 1, start_date), updated_at = now()
    where agency_id = new.agency_id and property_id = new.property_id and record_type = target_type
      and status = 'active' and transaction_id <> new.id;
    insert into public.property_occupancy_records
      (agency_id, property_id, customer_id, transaction_id, record_type, start_date, status, notes)
    values
      (new.agency_id, new.property_id, new.customer_id, new.id, target_type, new.transaction_date, 'active', new.notes)
    on conflict (transaction_id) do update set
      customer_id = excluded.customer_id, property_id = excluded.property_id, record_type = excluded.record_type,
      start_date = excluded.start_date, end_date = null, status = 'active', notes = excluded.notes, updated_at = now();
    update public.properties set status = (case when new.transaction_type = 'buy' then 'sold' else 'rented' end)::public.property_status, updated_at = now()
    where id = new.property_id and agency_id = new.agency_id;
  elsif new.status = 'cancelled' then
    update public.property_occupancy_records set status = 'ended', end_date = coalesce(end_date, current_date), updated_at = now()
    where transaction_id = new.id and agency_id = new.agency_id and status = 'active';
  end if;
  return new;
end;
$$;

create trigger sync_property_occupancy_after_transaction
after insert or update of status, customer_id, property_id, transaction_type, transaction_date on public.property_transactions
for each row execute function public.sync_property_occupancy_from_transaction();

with completed_deals as (
  select *, lead(transaction_date) over (
    partition by agency_id, property_id, transaction_type order by transaction_date, created_at
  ) as next_start_date
  from public.property_transactions
  where status = 'completed' and transaction_type in ('buy','rent')
)
insert into public.property_occupancy_records
  (agency_id, property_id, customer_id, transaction_id, record_type, start_date, end_date, status, notes)
select agency_id, property_id, customer_id, id,
  case when transaction_type = 'buy' then 'ownership' else 'tenancy' end,
  transaction_date,
  case when next_start_date is null then null else greatest(next_start_date - 1, transaction_date) end,
  case when next_start_date is null then 'active' else 'ended' end,
  notes
from completed_deals
on conflict (transaction_id) do nothing;

commit;

