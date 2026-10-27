begin;

create table public.transaction_payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  transaction_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'cash' check (payment_method in ('cash','bank_transfer','mobile_money','card','other')),
  reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (transaction_id, agency_id) references public.property_transactions(id, agency_id) on delete cascade
);

alter table public.transaction_payments enable row level security;
alter table public.transaction_payments force row level security;
create policy transaction_payment_select on public.transaction_payments for select to authenticated using (public.is_agency_member(agency_id));
create policy transaction_payment_insert on public.transaction_payments for insert to authenticated with check (public.has_agency_role(agency_id, array['owner','admin','manager','agent']::public.agency_role[]));
create policy transaction_payment_update on public.transaction_payments for update to authenticated using (public.has_agency_role(agency_id, array['owner','admin','manager']::public.agency_role[])) with check (public.has_agency_role(agency_id, array['owner','admin','manager']::public.agency_role[]));
create policy transaction_payment_delete on public.transaction_payments for delete to authenticated using (public.has_agency_role(agency_id, array['owner','admin','manager']::public.agency_role[]));
create index transaction_payments_transaction_date_idx on public.transaction_payments (transaction_id, payment_date desc, created_at desc);
grant select, insert, update, delete on public.transaction_payments to authenticated;

insert into public.transaction_payments (agency_id, transaction_id, amount, payment_date, payment_method, reference, notes)
select agency_id, id, deposit, transaction_date, 'other', 'OPENING-BALANCE', 'Lacagtii hore ee transaction-ka'
from public.property_transactions
where deposit > 0;

create or replace function public.sync_transaction_payment_total()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_transaction_id uuid := coalesce(new.transaction_id, old.transaction_id);
  target_agency_id uuid := coalesce(new.agency_id, old.agency_id);
  paid_total numeric;
  deal_total numeric;
  deal_status text;
begin
  select coalesce(sum(amount), 0) into paid_total
  from public.transaction_payments
  where transaction_id = target_transaction_id and agency_id = target_agency_id;

  select total_price, status into deal_total, deal_status
  from public.property_transactions
  where id = target_transaction_id and agency_id = target_agency_id
  for update;

  if paid_total > deal_total then raise exception 'payment total exceeds deal total'; end if;

  update public.property_transactions
  set deposit = paid_total,
      status = case when deal_status = 'cancelled' then 'cancelled' when paid_total = deal_total then 'completed' else 'pending' end,
      updated_at = now()
  where id = target_transaction_id and agency_id = target_agency_id;
  return coalesce(new, old);
end;
$$;

create trigger sync_transaction_after_payment
after insert or update or delete on public.transaction_payments
for each row execute function public.sync_transaction_payment_total();

create or replace function public.create_initial_transaction_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deposit > 0 then
    insert into public.transaction_payments (agency_id, transaction_id, amount, payment_date, payment_method, reference, notes, created_by)
    values (new.agency_id, new.id, new.deposit, new.transaction_date, 'other', 'INITIAL-PAYMENT', 'Lacagta bilowga ah', auth.uid());
  end if;
  return new;
end;
$$;

create trigger create_initial_payment_after_transaction
after insert on public.property_transactions
for each row execute function public.create_initial_transaction_payment();

commit;

