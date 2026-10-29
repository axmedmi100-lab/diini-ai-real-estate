begin;

create table public.platform_backup_runs (
  id uuid primary key default gen_random_uuid(),
  filename text not null unique,
  status text not null default 'generated' check (status in ('generated','stored','failed')),
  table_count integer not null default 0 check (table_count>=0),
  record_count bigint not null default 0 check (record_count>=0),
  byte_size bigint not null default 0 check (byte_size>=0),
  error_message text,
  generated_at timestamptz not null default now(),
  stored_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.platform_backup_runs enable row level security;
alter table public.platform_backup_runs force row level security;
create policy platform_backup_runs_admin_select on public.platform_backup_runs for select to authenticated using (public.is_platform_super_admin());
revoke all on public.platform_backup_runs from anon,authenticated;
grant select on public.platform_backup_runs to authenticated;
grant all on public.platform_backup_runs to service_role;
create index platform_backup_runs_created_idx on public.platform_backup_runs(created_at desc);

create or replace function public.get_platform_backup_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare latest_value jsonb;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  select jsonb_build_object(
    'id',id,'filename',filename,'status',status,'table_count',table_count,'record_count',record_count,'byte_size',byte_size,
    'generated_at',generated_at,'stored_at',stored_at,'error_message',error_message,
    'age_seconds',extract(epoch from (now()-coalesce(stored_at,generated_at)))::integer
  ) into latest_value from public.platform_backup_runs order by created_at desc limit 1;
  return jsonb_build_object(
    'latest',latest_value,
    'stored_30d',(select count(*) from public.platform_backup_runs where status='stored' and created_at>=now()-interval '30 days'),
    'failed_30d',(select count(*) from public.platform_backup_runs where status='failed' and created_at>=now()-interval '30 days')
  );
end; $$;

revoke all on function public.get_platform_backup_status() from public;
grant execute on function public.get_platform_backup_status() to authenticated;

commit;

