begin;

create table if not exists public.platform_integration_providers (
  provider text primary key check (provider ~ '^[a-z0-9_]+$'),
  display_name text not null,
  category text not null check (category in ('ai','messaging','channel','automation')),
  provisioning_mode text not null default 'hybrid' check (provisioning_mode in ('managed','byok','hybrid')),
  is_enabled boolean not null default false,
  secret_configured boolean not null default false,
  default_monthly_limit integer check (default_monthly_limit is null or default_monthly_limit >= 0),
  public_config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_integration_providers
  (provider, display_name, category, provisioning_mode, is_enabled, default_monthly_limit, sort_order)
values
  ('openai', 'OpenAI', 'ai', 'managed', false, null, 10),
  ('website_ai', 'Website AI Chat', 'channel', 'managed', true, null, 20),
  ('whatsapp', 'WhatsApp', 'messaging', 'hybrid', false, null, 30),
  ('facebook', 'Facebook Messenger', 'messaging', 'hybrid', false, null, 40),
  ('instagram', 'Instagram DM', 'messaging', 'hybrid', false, null, 50),
  ('email', 'Email', 'channel', 'hybrid', false, null, 60),
  ('voice', 'Voice', 'channel', 'managed', false, null, 70)
on conflict (provider) do nothing;

alter table public.integrations
  add column if not exists platform_enabled boolean not null default true,
  add column if not exists monthly_limit integer check (monthly_limit is null or monthly_limit >= 0),
  add column if not exists last_error text,
  add column if not exists last_event_at timestamptz;

alter table public.platform_integration_providers enable row level security;
alter table public.platform_integration_providers force row level security;

drop policy if exists platform_integration_providers_admin_select on public.platform_integration_providers;
create policy platform_integration_providers_admin_select on public.platform_integration_providers
for select to authenticated using (public.is_platform_super_admin());

grant select on public.platform_integration_providers to authenticated;
grant all on public.platform_integration_providers to service_role;

drop trigger if exists set_platform_integration_providers_updated_at on public.platform_integration_providers;
create trigger set_platform_integration_providers_updated_at
before update on public.platform_integration_providers
for each row execute function public.set_updated_at();

create or replace function public.get_platform_integration_control()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;

  select jsonb_build_object(
    'providers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider', p.provider,
        'display_name', p.display_name,
        'category', p.category,
        'provisioning_mode', p.provisioning_mode,
        'is_enabled', p.is_enabled,
        'secret_configured', p.secret_configured,
        'default_monthly_limit', p.default_monthly_limit,
        'connected_agencies', (select count(*) from public.integrations i where i.provider=p.provider and i.status='connected'),
        'error_agencies', (select count(*) from public.integrations i where i.provider=p.provider and i.status='error'),
        'total_agencies', (select count(*) from public.integrations i where i.provider=p.provider)
      ) order by p.sort_order, p.provider)
      from public.platform_integration_providers p
    ), '[]'::jsonb),
    'agencies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'slug', a.slug,
        'plan_code', a.plan_code,
        'lifecycle_status', a.lifecycle_status,
        'integrations', coalesce((
          select jsonb_agg(jsonb_build_object(
            'provider', i.provider,
            'status', i.status,
            'platform_enabled', i.platform_enabled,
            'monthly_limit', i.monthly_limit,
            'connected_at', i.connected_at,
            'last_error', i.last_error,
            'last_event_at', i.last_event_at
          ) order by i.provider)
          from public.integrations i where i.agency_id=a.id
        ), '[]'::jsonb)
      ) order by a.name)
      from public.agencies a where a.lifecycle_status <> 'archived'
    ), '[]'::jsonb)
  ) into result;
  return result;
end; $$;

create or replace function public.platform_update_integration_provider(
  target_provider text,
  target_enabled boolean,
  target_mode text,
  target_default_limit integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  if target_mode not in ('managed','byok','hybrid') then raise exception 'invalid provisioning mode'; end if;
  if target_default_limit is not null and target_default_limit < 0 then raise exception 'invalid monthly limit'; end if;

  update public.platform_integration_providers
  set is_enabled=target_enabled, provisioning_mode=target_mode, default_monthly_limit=target_default_limit
  where provider=target_provider;
  if not found then raise exception 'provider not found'; end if;

  insert into public.platform_audit_logs(actor_user_id, action, metadata)
  values(actor_id, 'integration_provider.updated', jsonb_build_object(
    'provider', target_provider, 'is_enabled', target_enabled,
    'provisioning_mode', target_mode, 'default_monthly_limit', target_default_limit
  ));
end; $$;

create or replace function public.platform_update_agency_integration(
  target_agency_id uuid,
  target_provider text,
  target_enabled boolean,
  target_monthly_limit integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  if target_monthly_limit is not null and target_monthly_limit < 0 then raise exception 'invalid monthly limit'; end if;
  if not exists (select 1 from public.agencies where id=target_agency_id) then raise exception 'agency not found'; end if;
  if not exists (select 1 from public.platform_integration_providers where provider=target_provider) then raise exception 'provider not found'; end if;

  insert into public.integrations(agency_id, provider, status, public_config, platform_enabled, monthly_limit)
  values(target_agency_id, target_provider, 'disconnected', '{}'::jsonb, target_enabled, target_monthly_limit)
  on conflict (agency_id, provider) do update
  set platform_enabled=excluded.platform_enabled, monthly_limit=excluded.monthly_limit;

  insert into public.platform_audit_logs(actor_user_id, action, target_agency_id, metadata)
  values(actor_id, 'agency_integration.updated', target_agency_id, jsonb_build_object(
    'provider', target_provider, 'platform_enabled', target_enabled,
    'monthly_limit', target_monthly_limit
  ));
end; $$;

revoke all on function public.get_platform_integration_control() from public;
revoke all on function public.platform_update_integration_provider(text,boolean,text,integer) from public;
revoke all on function public.platform_update_agency_integration(uuid,text,boolean,integer) from public;
grant execute on function public.get_platform_integration_control() to authenticated;
grant execute on function public.platform_update_integration_provider(text,boolean,text,integer) to authenticated;
grant execute on function public.platform_update_agency_integration(uuid,text,boolean,integer) to authenticated;

commit;

