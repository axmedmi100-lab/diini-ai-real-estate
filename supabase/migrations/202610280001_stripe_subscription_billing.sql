begin;

alter table public.platform_plans add column if not exists stripe_price_id text unique;

create table public.agency_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null unique references public.agencies(id) on delete cascade,
  provider text not null default 'stripe' check (provider='stripe'),
  provider_customer_id text unique,
  provider_subscription_id text unique,
  plan_code text not null references public.platform_plans(code),
  status text not null default 'incomplete' check (status in ('incomplete','trialing','active','past_due','unpaid','paused','canceled')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  provider_invoice_id text not null unique,
  provider_subscription_id text,
  status text not null,
  currency text not null default 'usd',
  amount_due numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  hosted_invoice_url text,
  invoice_pdf_url text,
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_webhook_events (
  provider_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.agency_subscriptions enable row level security;
alter table public.agency_subscriptions force row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_invoices force row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.billing_webhook_events force row level security;

create policy subscriptions_tenant_select on public.agency_subscriptions for select to authenticated using (public.is_agency_member(agency_id));
create policy invoices_tenant_select on public.billing_invoices for select to authenticated using (public.is_agency_member(agency_id));
revoke all on public.agency_subscriptions,public.billing_invoices,public.billing_webhook_events from anon,authenticated;
grant select on public.agency_subscriptions,public.billing_invoices to authenticated;
grant all on public.agency_subscriptions,public.billing_invoices,public.billing_webhook_events to service_role;

create trigger set_agency_subscriptions_updated_at before update on public.agency_subscriptions for each row execute function public.set_updated_at();
create trigger set_billing_invoices_updated_at before update on public.billing_invoices for each row execute function public.set_updated_at();
create index billing_invoices_agency_created_idx on public.billing_invoices(agency_id,created_at desc);

create or replace function public.platform_set_stripe_price(target_plan_code text, target_price_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  if target_price_id is not null and target_price_id !~ '^price_[A-Za-z0-9]+$' then raise exception 'invalid Stripe price ID'; end if;
  update public.platform_plans set stripe_price_id=target_price_id where code=target_plan_code;
  if not found then raise exception 'plan not found'; end if;
  insert into public.platform_audit_logs(actor_user_id,action,metadata)
  values(auth.uid(),'plan.stripe_price_updated',jsonb_build_object('plan_code',target_plan_code));
end; $$;

revoke all on function public.platform_set_stripe_price(text,text) from public;
grant execute on function public.platform_set_stripe_price(text,text) to authenticated;

commit;

