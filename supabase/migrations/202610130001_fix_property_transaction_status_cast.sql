begin;

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

commit;

