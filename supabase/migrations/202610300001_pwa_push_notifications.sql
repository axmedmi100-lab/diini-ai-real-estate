begin;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,endpoint)
);

alter table public.notifications add column push_processed_at timestamptz;
alter table public.notifications add column push_error text;
update public.notifications set push_processed_at=now() where push_processed_at is null;
create index notifications_push_queue_idx on public.notifications(created_at) where push_processed_at is null;
create index push_subscriptions_agency_user_idx on public.push_subscriptions(agency_id,user_id);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
create policy push_subscription_select on public.push_subscriptions for select to authenticated
using(user_id=auth.uid() and public.is_agency_member(agency_id));
create policy push_subscription_insert on public.push_subscriptions for insert to authenticated
with check(user_id=auth.uid() and public.is_agency_member(agency_id));
create policy push_subscription_update on public.push_subscriptions for update to authenticated
using(user_id=auth.uid() and public.is_agency_member(agency_id))
with check(user_id=auth.uid() and public.is_agency_member(agency_id));
create policy push_subscription_delete on public.push_subscriptions for delete to authenticated
using(user_id=auth.uid() and public.is_agency_member(agency_id));

grant select,insert,update,delete on public.push_subscriptions to authenticated;
grant select,insert,update,delete on public.push_subscriptions to service_role;
grant select on public.push_subscriptions to service_role;

commit;

