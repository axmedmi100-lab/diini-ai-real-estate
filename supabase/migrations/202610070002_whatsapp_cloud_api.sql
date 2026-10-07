begin;

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text not null unique,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  event_type text not null default 'message',
  processed_at timestamptz not null default now()
);

alter table public.whatsapp_webhook_events enable row level security;
alter table public.whatsapp_webhook_events force row level security;
grant all on public.whatsapp_webhook_events to service_role;

create unique index if not exists conversations_whatsapp_thread_unique
  on public.conversations (agency_id, channel, external_thread_id)
  where channel = 'whatsapp' and external_thread_id is not null;

create or replace function public.record_whatsapp_usage(target_agency_id uuid, message_count integer default 1)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.agency_usage_monthly (agency_id, month_start, whatsapp_messages)
  values (target_agency_id, date_trunc('month', now())::date, greatest(message_count, 0))
  on conflict (agency_id, month_start) do update set
    whatsapp_messages = public.agency_usage_monthly.whatsapp_messages + excluded.whatsapp_messages,
    updated_at = now();
end;
$$;

revoke all on function public.record_whatsapp_usage(uuid, integer) from public;
grant execute on function public.record_whatsapp_usage(uuid, integer) to service_role;

commit;
