begin;

create table public.property_transactions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null,
  customer_id uuid not null,
  property_id uuid not null,
  transaction_type text not null check (transaction_type in ('buy','rent','reserve','deposit')),
  total_price numeric(14,2) not null check (total_price >= 0),
  deposit numeric(14,2) not null default 0 check (deposit >= 0 and deposit <= total_price),
  remaining_balance numeric(14,2) generated always as (total_price - deposit) stored,
  transaction_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  assigned_agent_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (transaction_type <> 'deposit' or deposit > 0),
  unique (id, agency_id),
  foreign key (lead_id, agency_id) references public.leads(id, agency_id) on delete restrict,
  foreign key (customer_id, agency_id) references public.customers(id, agency_id) on delete restrict,
  foreign key (property_id, agency_id) references public.properties(id, agency_id) on delete restrict,
  foreign key (assigned_agent_id, agency_id) references public.agency_members(id, agency_id) on delete set null (assigned_agent_id)
);

alter table public.property_transactions enable row level security;
alter table public.property_transactions force row level security;
create policy transaction_select on public.property_transactions for select to authenticated using (public.is_agency_member(agency_id));
create policy transaction_insert on public.property_transactions for insert to authenticated with check (public.has_agency_role(agency_id, array['owner','admin','manager','agent','receptionist']::public.agency_role[]));
create policy transaction_update on public.property_transactions for update to authenticated using (public.has_agency_role(agency_id, array['owner','admin','manager','agent']::public.agency_role[])) with check (public.has_agency_role(agency_id, array['owner','admin','manager','agent']::public.agency_role[]));
create policy transaction_delete on public.property_transactions for delete to authenticated using (public.has_agency_role(agency_id, array['owner','admin','manager']::public.agency_role[]));
create trigger set_property_transactions_updated_at before update on public.property_transactions for each row execute function public.set_updated_at();
create index property_transactions_agency_customer_idx on public.property_transactions (agency_id, customer_id, transaction_date desc);
create index property_transactions_agency_property_idx on public.property_transactions (agency_id, property_id, transaction_date desc);
grant select, insert, update, delete on public.property_transactions to authenticated;

drop policy if exists tenant_insert on public.customers;

create or replace function public.create_property_transaction(
  target_lead_id uuid,
  target_property_id uuid,
  target_transaction_type text,
  target_total_price numeric,
  target_deposit numeric default 0,
  target_transaction_date date default current_date,
  target_status text default 'pending',
  target_assigned_agent_id uuid default null,
  target_notes text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  target_lead public.leads%rowtype;
  customer_uuid uuid;
  normalized text;
begin
  select * into target_lead from public.leads where id = target_lead_id;
  if target_lead.id is null or not public.has_agency_role(target_lead.agency_id, array['owner','admin','manager','agent','receptionist']::public.agency_role[]) then
    raise exception 'lead not found or access denied';
  end if;
  if target_transaction_type not in ('buy','rent','reserve','deposit') then raise exception 'invalid transaction type'; end if;
  if target_status not in ('pending','completed') then raise exception 'invalid conversion transaction status'; end if;
  if target_total_price is null or target_total_price < 0 or coalesce(target_deposit,0) < 0 or coalesce(target_deposit,0) > target_total_price then raise exception 'invalid transaction amounts'; end if;
  if target_transaction_type='deposit' and coalesce(target_deposit,0) <= 0 then raise exception 'deposit payment is required'; end if;
  if target_transaction_date is null then raise exception 'transaction date is required'; end if;
  if not exists (select 1 from public.properties where id=target_property_id and agency_id=target_lead.agency_id) then raise exception 'property not found'; end if;
  if target_assigned_agent_id is not null and not exists (select 1 from public.agency_members where id=target_assigned_agent_id and agency_id=target_lead.agency_id and is_active) then raise exception 'assigned agent not found'; end if;

  customer_uuid := target_lead.customer_id;
  normalized := nullif(pg_catalog.regexp_replace(coalesce(target_lead.phone,''), '\D', '', 'g'), '');
  if customer_uuid is null and normalized is not null then
    select id into customer_uuid from public.customers where agency_id=target_lead.agency_id and normalized_phone=normalized;
  end if;
  if customer_uuid is null then
    insert into public.customers (agency_id,name,phone,normalized_phone,email,notes)
    values (target_lead.agency_id,target_lead.name,target_lead.phone,normalized,target_lead.email,target_lead.notes)
    returning id into customer_uuid;
  else
    update public.customers set
      name=coalesce(target_lead.name,name), phone=coalesce(target_lead.phone,phone),
      normalized_phone=coalesce(normalized,normalized_phone), email=coalesce(target_lead.email,email), updated_at=now()
    where id=customer_uuid and agency_id=target_lead.agency_id;
  end if;

  update public.leads set customer_id=customer_uuid, status='won', updated_at=now()
  where id=target_lead.id and agency_id=target_lead.agency_id;
  update public.conversations set customer_id=customer_uuid, updated_at=now()
  where lead_id=target_lead.id and agency_id=target_lead.agency_id;

  insert into public.property_transactions
    (agency_id,lead_id,customer_id,property_id,transaction_type,total_price,deposit,transaction_date,status,assigned_agent_id,notes)
  values
    (target_lead.agency_id,target_lead.id,customer_uuid,target_property_id,target_transaction_type,target_total_price,coalesce(target_deposit,0),target_transaction_date,target_status,coalesce(target_assigned_agent_id,target_lead.assigned_agent_id),target_notes);

  update public.properties
  set status=(case target_transaction_type when 'buy' then 'sold' when 'rent' then 'rented' else 'reserved' end)::public.property_status,
      updated_at=now()
  where id=target_property_id and agency_id=target_lead.agency_id;
  return customer_uuid;
end;
$$;
revoke all on function public.create_property_transaction(uuid,uuid,text,numeric,numeric,date,text,uuid,text) from public;
grant execute on function public.create_property_transaction(uuid,uuid,text,numeric,numeric,date,text,uuid,text) to authenticated;

create or replace function public.upsert_widget_lead(
  target_agency_id uuid, target_conversation_id uuid, session_token uuid,
  lead_name text default null, lead_phone text default null, lead_email text default null,
  wanted_purpose public.property_purpose default null, wanted_district text default null,
  min_budget numeric default null, max_budget numeric default null, min_bedrooms smallint default null,
  wanted_property_type text default null, wanted_furnished boolean default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing_lead_id uuid;
begin
  if not exists (select 1 from public.conversations where id=target_conversation_id and agency_id=target_agency_id and public_session_token=session_token) then raise exception 'invalid conversation'; end if;
  select lead_id into existing_lead_id from public.conversations where id=target_conversation_id and agency_id=target_agency_id;
  if existing_lead_id is null then
    insert into public.leads (agency_id,name,phone,email,source,purpose,district,budget_min,budget_max,bedrooms,property_type,furnished,status,notes)
    values (target_agency_id,lead_name,lead_phone,lead_email,'website',wanted_purpose,wanted_district,min_budget,max_budget,min_bedrooms,wanted_property_type,wanted_furnished,'new','Website AI chat')
    returning id into existing_lead_id;
    update public.conversations set lead_id=existing_lead_id where id=target_conversation_id and agency_id=target_agency_id;
  else
    update public.leads set name=coalesce(lead_name,name),phone=coalesce(lead_phone,phone),email=coalesce(lead_email,email),
      purpose=coalesce(wanted_purpose,purpose),district=coalesce(wanted_district,district),budget_min=coalesce(min_budget,budget_min),
      budget_max=coalesce(max_budget,budget_max),bedrooms=coalesce(min_bedrooms,bedrooms),property_type=coalesce(wanted_property_type,property_type),
      furnished=coalesce(wanted_furnished,furnished),updated_at=now()
    where id=existing_lead_id and agency_id=target_agency_id;
  end if;
  return existing_lead_id;
end;
$$;

commit;

