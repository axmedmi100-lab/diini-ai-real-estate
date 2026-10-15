begin;

create table if not exists public.platform_integration_secrets (
  provider text primary key references public.platform_integration_providers(provider) on delete cascade,
  encrypted_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_integration_secrets enable row level security;
alter table public.platform_integration_secrets force row level security;
revoke all on public.platform_integration_secrets from anon, authenticated;
grant all on public.platform_integration_secrets to service_role;

drop trigger if exists set_platform_integration_secrets_updated_at on public.platform_integration_secrets;
create trigger set_platform_integration_secrets_updated_at
before update on public.platform_integration_secrets
for each row execute function public.set_updated_at();

alter table public.platform_integration_providers
  add column if not exists secret_hint text;

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
        'secret_hint', p.secret_hint,
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

revoke all on function public.get_platform_integration_control() from public;
grant execute on function public.get_platform_integration_control() to authenticated;

commit;

