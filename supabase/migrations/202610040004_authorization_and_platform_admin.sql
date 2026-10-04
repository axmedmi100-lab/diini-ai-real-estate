begin;

create type public.agency_lifecycle_status as enum ('trial', 'active', 'suspended', 'archived');
create type public.platform_role as enum ('super_admin');

alter table public.agencies
  add column lifecycle_status public.agency_lifecycle_status not null default 'active',
  add column plan_code text not null default 'starter' check (plan_code in ('starter', 'pro', 'enterprise')),
  add column trial_ends_at timestamptz,
  add column suspended_at timestamptz,
  add column archived_at timestamptz;

create table public.platform_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.platform_role not null default 'super_admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_agency_id uuid references public.agencies(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.agency_usage_monthly (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  month_start date not null check (month_start = date_trunc('month', month_start)::date),
  ai_conversations integer not null default 0 check (ai_conversations >= 0),
  ai_input_tokens bigint not null default 0 check (ai_input_tokens >= 0),
  ai_output_tokens bigint not null default 0 check (ai_output_tokens >= 0),
  estimated_ai_cost_usd numeric(12,4) not null default 0 check (estimated_ai_cost_usd >= 0),
  whatsapp_messages integer not null default 0 check (whatsapp_messages >= 0),
  storage_bytes bigint not null default 0 check (storage_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, month_start)
);

create or replace function public.is_platform_super_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.platform_users
    where user_id = auth.uid() and role = 'super_admin' and is_active = true
  );
$$;

create or replace function public.has_agency_role(target_agency_id uuid, allowed_roles public.agency_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.agency_members m
    join public.agencies a on a.id = m.agency_id
    where m.agency_id = target_agency_id
      and m.user_id = auth.uid()
      and m.is_active = true
      and a.lifecycle_status in ('trial', 'active')
      and m.role = any(allowed_roles)
  );
$$;

create or replace function public.is_agency_member(target_agency_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.agency_members m
    join public.agencies a on a.id = m.agency_id
    where m.agency_id = target_agency_id
      and m.user_id = auth.uid()
      and m.is_active = true
      and a.lifecycle_status in ('trial', 'active')
  );
$$;

create or replace function public.can_manage_agency(target_agency_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_agency_role(target_agency_id, array['owner','admin','manager']::public.agency_role[]);
$$;

revoke all on function public.is_platform_super_admin() from public;
revoke all on function public.has_agency_role(uuid, public.agency_role[]) from public;
grant execute on function public.is_platform_super_admin() to authenticated;
grant execute on function public.has_agency_role(uuid, public.agency_role[]) to authenticated;

alter table public.platform_users enable row level security;
alter table public.platform_users force row level security;
alter table public.platform_audit_logs enable row level security;
alter table public.platform_audit_logs force row level security;
alter table public.agency_usage_monthly enable row level security;
alter table public.agency_usage_monthly force row level security;

create policy platform_users_self_select on public.platform_users for select to authenticated
  using (user_id = auth.uid() and public.is_platform_super_admin());
create policy platform_audit_admin_select on public.platform_audit_logs for select to authenticated
  using (public.is_platform_super_admin());
create policy usage_tenant_select on public.agency_usage_monthly for select to authenticated
  using (public.is_agency_member(agency_id) or public.is_platform_super_admin());

grant select on public.platform_users, public.platform_audit_logs, public.agency_usage_monthly to authenticated;
grant select, insert, update, delete on public.platform_users, public.platform_audit_logs, public.agency_usage_monthly to service_role;

drop policy if exists agencies_update on public.agencies;
create policy agencies_update on public.agencies for update to authenticated
  using (public.has_agency_role(id, array['owner','admin','manager']::public.agency_role[]))
  with check (public.has_agency_role(id, array['owner','admin','manager']::public.agency_role[]));

drop policy if exists members_insert on public.agency_members;
drop policy if exists members_update on public.agency_members;
drop policy if exists members_delete on public.agency_members;
create policy members_insert on public.agency_members for insert to authenticated
  with check (
    (public.has_agency_role(agency_id, array['owner']::public.agency_role[]) and role <> 'owner')
    or (user_id = auth.uid() and role = 'owner' and exists (
      select 1 from public.agencies a where a.id = agency_id and a.created_by = auth.uid()
    ))
  );
create policy members_update on public.agency_members for update to authenticated
  using (public.has_agency_role(agency_id, array['owner']::public.agency_role[]) and role <> 'owner')
  with check (public.has_agency_role(agency_id, array['owner']::public.agency_role[]) and role <> 'owner');
create policy members_delete on public.agency_members for delete to authenticated
  using (public.has_agency_role(agency_id, array['owner']::public.agency_role[]) and role <> 'owner');

do $$
declare table_name text;
begin
  foreach table_name in array array['properties'] loop
    execute format('drop policy if exists tenant_insert on public.%I', table_name);
    execute format('drop policy if exists tenant_update on public.%I', table_name);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (public.has_agency_role(agency_id, array[''owner'',''admin'',''manager'',''agent'']::public.agency_role[]))', table_name);
    execute format('create policy tenant_update on public.%I for update to authenticated using (public.has_agency_role(agency_id, array[''owner'',''admin'',''manager'',''agent'']::public.agency_role[])) with check (public.has_agency_role(agency_id, array[''owner'',''admin'',''manager'',''agent'']::public.agency_role[]))', table_name);
  end loop;

  foreach table_name in array array['customers','leads','conversations','messages','viewings','follow_ups','notifications'] loop
    execute format('drop policy if exists tenant_insert on public.%I', table_name);
    execute format('drop policy if exists tenant_update on public.%I', table_name);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (public.has_agency_role(agency_id, array[''owner'',''admin'',''manager'',''agent'',''receptionist'']::public.agency_role[]))', table_name);
    execute format('create policy tenant_update on public.%I for update to authenticated using (public.has_agency_role(agency_id, array[''owner'',''admin'',''manager'',''agent'',''receptionist'']::public.agency_role[])) with check (public.has_agency_role(agency_id, array[''owner'',''admin'',''manager'',''agent'',''receptionist'']::public.agency_role[]))', table_name);
  end loop;

  foreach table_name in array array['integrations','ai_settings'] loop
    execute format('drop policy if exists tenant_insert on public.%I', table_name);
    execute format('drop policy if exists tenant_update on public.%I', table_name);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (public.has_agency_role(agency_id, array[''owner'',''admin'',''manager'']::public.agency_role[]))', table_name);
    execute format('create policy tenant_update on public.%I for update to authenticated using (public.has_agency_role(agency_id, array[''owner'',''admin'',''manager'']::public.agency_role[])) with check (public.has_agency_role(agency_id, array[''owner'',''admin'',''manager'']::public.agency_role[]))', table_name);
  end loop;
end $$;

drop policy if exists tenant_insert on public.follow_up_rules;
drop policy if exists tenant_update on public.follow_up_rules;
create policy tenant_insert on public.follow_up_rules for insert to authenticated
  with check (public.has_agency_role(agency_id, array['owner','admin','manager']::public.agency_role[]));
create policy tenant_update on public.follow_up_rules for update to authenticated
  using (public.has_agency_role(agency_id, array['owner','admin','manager']::public.agency_role[]))
  with check (public.has_agency_role(agency_id, array['owner','admin','manager']::public.agency_role[]));

create or replace function public.sync_agency_lifecycle()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.is_active := new.lifecycle_status in ('trial', 'active');
  if new.lifecycle_status = 'suspended' and old.lifecycle_status <> 'suspended' then new.suspended_at := now(); end if;
  if new.lifecycle_status = 'archived' and old.lifecycle_status <> 'archived' then new.archived_at := now(); end if;
  return new;
end;
$$;

create or replace function public.protect_platform_agency_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.lifecycle_status, new.plan_code, new.trial_ends_at, new.suspended_at, new.archived_at)
     is distinct from
     (old.lifecycle_status, old.plan_code, old.trial_ends_at, old.suspended_at, old.archived_at)
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.is_platform_super_admin() then
    raise exception 'platform-managed agency fields cannot be changed by agency users';
  end if;
  return new;
end;
$$;

create trigger sync_agency_lifecycle_before_update
before update of lifecycle_status on public.agencies
for each row execute function public.sync_agency_lifecycle();
create trigger protect_platform_agency_fields_before_update
before update on public.agencies
for each row execute function public.protect_platform_agency_fields();

create trigger set_platform_users_updated_at before update on public.platform_users
for each row execute function public.set_updated_at();
create trigger set_agency_usage_monthly_updated_at before update on public.agency_usage_monthly
for each row execute function public.set_updated_at();

create index agencies_lifecycle_idx on public.agencies (lifecycle_status, created_at desc);
create index platform_audit_created_idx on public.platform_audit_logs (created_at desc);
create index usage_agency_month_idx on public.agency_usage_monthly (agency_id, month_start desc);

commit;
