begin;

create table if not exists public.evolution_instances (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  instance_name text not null unique check (instance_name ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  connection_status text not null default 'connecting' check (connection_status in ('connecting','open','close','disconnected','error')),
  owner_jid text,
  last_error text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.evolution_instances enable row level security;
alter table public.evolution_instances force row level security;

drop policy if exists evolution_instance_tenant_select on public.evolution_instances;
create policy evolution_instance_tenant_select on public.evolution_instances
for select to authenticated using (public.is_agency_member(agency_id));

revoke all on public.evolution_instances from anon, authenticated;
grant select on public.evolution_instances to authenticated;
grant all on public.evolution_instances to service_role;

drop trigger if exists set_evolution_instances_updated_at on public.evolution_instances;
create trigger set_evolution_instances_updated_at
before update on public.evolution_instances
for each row execute function public.set_updated_at();

commit;

