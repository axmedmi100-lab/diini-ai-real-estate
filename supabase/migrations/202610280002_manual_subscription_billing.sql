begin;

alter table public.agency_subscriptions drop constraint if exists agency_subscriptions_provider_check;
alter table public.agency_subscriptions add constraint agency_subscriptions_provider_check check (provider in ('stripe','manual'));

create table public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  plan_code text not null references public.platform_plans(code),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'usd' check (char_length(currency)=3),
  payment_method text not null check (payment_method in ('evc_plus','bank_transfer','other')),
  payment_reference text not null check (char_length(payment_reference) between 3 and 120),
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','canceled')),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  period_months integer not null default 1 check (period_months between 1 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index manual_payment_one_pending_per_agency_idx
  on public.manual_payment_requests(agency_id) where status='pending';
create index manual_payment_status_created_idx
  on public.manual_payment_requests(status,created_at desc);

alter table public.manual_payment_requests enable row level security;
alter table public.manual_payment_requests force row level security;
create policy manual_payment_tenant_select on public.manual_payment_requests for select to authenticated
  using (public.is_agency_member(agency_id));
create policy manual_payment_admin_select on public.manual_payment_requests for select to authenticated
  using (public.is_platform_super_admin());
revoke all on public.manual_payment_requests from anon,authenticated;
grant select on public.manual_payment_requests to authenticated;
grant all on public.manual_payment_requests to service_role;
create trigger set_manual_payment_requests_updated_at before update on public.manual_payment_requests
  for each row execute function public.set_updated_at();

create or replace function public.create_manual_payment_request(
  target_plan_code text,
  target_amount numeric,
  target_currency text,
  target_payment_method text,
  target_payment_reference text,
  target_notes text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller_agency_id uuid;
  new_request_id uuid;
begin
  select m.agency_id into caller_agency_id
  from public.agency_members m
  join public.agencies a on a.id=m.agency_id
  where m.user_id=auth.uid() and m.is_active and m.role='owner' and a.lifecycle_status in ('trial','active')
  limit 1;
  if caller_agency_id is null then raise exception 'only the agency owner can submit payment'; end if;
  if not exists(select 1 from public.platform_plans where code=target_plan_code and is_active) then raise exception 'plan not found'; end if;
  if target_amount is null or target_amount <= 0 then raise exception 'invalid amount'; end if;
  if lower(target_currency) !~ '^[a-z]{3}$' then raise exception 'invalid currency'; end if;
  if target_payment_method not in ('evc_plus','bank_transfer','other') then raise exception 'invalid payment method'; end if;
  if char_length(trim(coalesce(target_payment_reference,''))) not between 3 and 120 then raise exception 'invalid payment reference'; end if;
  if exists(select 1 from public.manual_payment_requests where agency_id=caller_agency_id and status='pending') then raise exception 'pending payment request already exists'; end if;

  insert into public.manual_payment_requests(agency_id,plan_code,amount,currency,payment_method,payment_reference,notes,submitted_by)
  values(caller_agency_id,target_plan_code,target_amount,lower(target_currency),target_payment_method,trim(target_payment_reference),nullif(trim(target_notes),''),auth.uid())
  returning id into new_request_id;

  insert into public.platform_audit_logs(actor_user_id,action,target_agency_id,metadata)
  values(auth.uid(),'billing.manual_payment_submitted',caller_agency_id,jsonb_build_object('request_id',new_request_id,'plan_code',target_plan_code,'amount',target_amount,'currency',lower(target_currency)));
  return new_request_id;
end; $$;

create or replace function public.platform_review_manual_payment(
  target_request_id uuid,
  approve_request boolean,
  target_rejection_reason text default null,
  target_period_months integer default 1
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  payment_request public.manual_payment_requests%rowtype;
  period_start_at timestamptz := now();
  period_end_at timestamptz;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  if target_period_months not between 1 and 24 then raise exception 'invalid subscription period'; end if;
  select * into payment_request from public.manual_payment_requests where id=target_request_id for update;
  if not found then raise exception 'payment request not found'; end if;
  if payment_request.status <> 'pending' then raise exception 'payment request already reviewed'; end if;

  if approve_request then
    period_end_at := period_start_at + make_interval(months => target_period_months);
    update public.manual_payment_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),period_months=target_period_months,rejection_reason=null where id=target_request_id;
    update public.agencies set plan_code=payment_request.plan_code,lifecycle_status='active',suspended_at=null where id=payment_request.agency_id;
    insert into public.agency_subscriptions(agency_id,provider,plan_code,status,current_period_end,cancel_at_period_end)
    values(payment_request.agency_id,'manual',payment_request.plan_code,'active',period_end_at,false)
    on conflict(agency_id) do update set provider='manual',provider_customer_id=null,provider_subscription_id=null,plan_code=excluded.plan_code,status='active',current_period_end=excluded.current_period_end,cancel_at_period_end=false;
    insert into public.billing_invoices(agency_id,provider_invoice_id,status,currency,amount_due,amount_paid,period_start,period_end,paid_at)
    values(payment_request.agency_id,'manual:'||payment_request.id::text,'paid',payment_request.currency,payment_request.amount,payment_request.amount,period_start_at,period_end_at,now())
    on conflict(provider_invoice_id) do nothing;
    insert into public.notifications(agency_id,user_id,type,title,body,entity_type,entity_id)
    values(payment_request.agency_id,payment_request.submitted_by,'billing_payment_approved','Lacag-bixinta waa la ansixiyey','Plan-ka '||payment_request.plan_code||' waa la hawlgeliyey.','manual_payment_request',payment_request.id);
  else
    if char_length(trim(coalesce(target_rejection_reason,''))) < 3 then raise exception 'rejection reason is required'; end if;
    update public.manual_payment_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=trim(target_rejection_reason) where id=target_request_id;
    insert into public.notifications(agency_id,user_id,type,title,body,entity_type,entity_id)
    values(payment_request.agency_id,payment_request.submitted_by,'billing_payment_rejected','Lacag-bixinta waa la diiday',trim(target_rejection_reason),'manual_payment_request',payment_request.id);
  end if;

  insert into public.platform_audit_logs(actor_user_id,action,target_agency_id,metadata)
  values(auth.uid(),case when approve_request then 'billing.manual_payment_approved' else 'billing.manual_payment_rejected' end,payment_request.agency_id,jsonb_build_object('request_id',payment_request.id,'plan_code',payment_request.plan_code,'amount',payment_request.amount,'period_months',target_period_months,'reason',target_rejection_reason));
end; $$;

revoke all on function public.create_manual_payment_request(text,numeric,text,text,text,text) from public;
grant execute on function public.create_manual_payment_request(text,numeric,text,text,text,text) to authenticated;
revoke all on function public.platform_review_manual_payment(uuid,boolean,text,integer) from public;
grant execute on function public.platform_review_manual_payment(uuid,boolean,text,integer) to authenticated;

commit;

