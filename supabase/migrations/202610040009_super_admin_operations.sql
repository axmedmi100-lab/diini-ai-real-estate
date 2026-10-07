begin;

create table public.platform_plans (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  monthly_price_usd numeric(10,2) not null default 0 check (monthly_price_usd >= 0),
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_plans (code, name, monthly_price_usd, limits, sort_order) values
  ('starter', 'Starter', 0, '{"properties":50,"users":3,"ai_conversations":500,"storage_gb":1,"follow_ups":100,"whatsapp":false}'::jsonb, 10),
  ('pro', 'Pro', 0, '{"properties":500,"users":10,"ai_conversations":2000,"storage_gb":10,"follow_ups":1000,"whatsapp":true}'::jsonb, 20),
  ('enterprise', 'Enterprise', 0, '{"properties":-1,"users":-1,"ai_conversations":-1,"storage_gb":-1,"follow_ups":-1,"whatsapp":true}'::jsonb, 30)
on conflict (code) do nothing;

alter table public.platform_plans enable row level security;
alter table public.platform_plans force row level security;
create policy platform_plans_authenticated_select on public.platform_plans for select to authenticated using (true);
grant select on public.platform_plans to authenticated;
grant all on public.platform_plans to service_role;
create trigger set_platform_plans_updated_at before update on public.platform_plans
for each row execute function public.set_updated_at();

create or replace function public.platform_create_agency(
  agency_name text,
  agency_slug text,
  agency_email text,
  agency_plan text default 'starter',
  agency_status public.agency_lifecycle_status default 'trial'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); new_id uuid;
begin
  if actor_id is null or not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  if not exists (select 1 from public.platform_plans where code=agency_plan and is_active) then raise exception 'invalid plan'; end if;
  if char_length(trim(agency_name)) < 2 or agency_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid agency'; end if;
  insert into public.agencies (created_by,name,slug,email,plan_code,lifecycle_status)
  values (actor_id,trim(agency_name),agency_slug,nullif(trim(agency_email),''),agency_plan,agency_status)
  returning id into new_id;
  insert into public.platform_audit_logs(actor_user_id,action,target_agency_id,metadata)
  values(actor_id,'agency.created',new_id,jsonb_build_object('plan_code',agency_plan,'lifecycle_status',agency_status));
  return new_id;
end; $$;

create or replace function public.platform_update_plan(
  plan_code text, plan_name text, plan_price numeric, plan_limits jsonb, plan_active boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  if plan_price < 0 or jsonb_typeof(plan_limits) <> 'object' then raise exception 'invalid plan data'; end if;
  update public.platform_plans set name=trim(plan_name),monthly_price_usd=plan_price,limits=plan_limits,is_active=plan_active where code=plan_code;
  if not found then raise exception 'plan not found'; end if;
  insert into public.platform_audit_logs(actor_user_id,action,metadata)
  values(actor_id,'plan.updated',jsonb_build_object('plan_code',plan_code));
end; $$;

create or replace function public.get_platform_agency_detail(target_agency_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  select jsonb_build_object(
    'agency', to_jsonb(a),
    'counts', jsonb_build_object(
      'users',(select count(*) from public.agency_members m where m.agency_id=a.id and m.is_active),
      'properties',(select count(*) from public.properties p where p.agency_id=a.id),
      'leads',(select count(*) from public.leads l where l.agency_id=a.id),
      'conversations',(select count(*) from public.conversations c where c.agency_id=a.id),
      'viewings',(select count(*) from public.viewings v where v.agency_id=a.id)
    ),
    'usage',(select coalesce(jsonb_agg(to_jsonb(u) order by u.month_start desc),'[]'::jsonb) from (select month_start,ai_conversations,ai_input_tokens,ai_output_tokens,estimated_ai_cost_usd,whatsapp_messages,storage_bytes from public.agency_usage_monthly where agency_id=a.id order by month_start desc limit 12) u),
    'integrations',(select coalesce(jsonb_agg(jsonb_build_object('provider',i.provider,'status',i.status,'connected_at',i.connected_at) order by i.provider),'[]'::jsonb) from public.integrations i where i.agency_id=a.id)
  ) into result from public.agencies a where a.id=target_agency_id;
  if result is null then raise exception 'agency not found'; end if;
  return result;
end; $$;

create or replace function public.get_platform_system_health()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  return jsonb_build_object(
    'integration_connected',(select count(*) from public.integrations where status='connected'),
    'integration_pending',(select count(*) from public.integrations where status='pending'),
    'integration_errors',(select count(*) from public.integrations where status='error'),
    'failed_follow_ups',(select count(*) from public.follow_ups where status='failed'),
    'pending_follow_ups',(select count(*) from public.follow_ups where status='pending'),
    'open_conversations',(select count(*) from public.conversations where status in ('open','ai_active','human_active')),
    'human_active_conversations',(select count(*) from public.conversations where status='human_active')
  );
end; $$;

revoke all on function public.platform_create_agency(text,text,text,text,public.agency_lifecycle_status) from public;
revoke all on function public.platform_update_plan(text,text,numeric,jsonb,boolean) from public;
revoke all on function public.get_platform_agency_detail(uuid) from public;
revoke all on function public.get_platform_system_health() from public;
grant execute on function public.platform_create_agency(text,text,text,text,public.agency_lifecycle_status) to authenticated;
grant execute on function public.platform_update_plan(text,text,numeric,jsonb,boolean) to authenticated;
grant execute on function public.get_platform_agency_detail(uuid) to authenticated;
grant execute on function public.get_platform_system_health() to authenticated;

commit;
