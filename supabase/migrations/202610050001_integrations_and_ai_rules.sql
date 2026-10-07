begin;

alter table public.ai_settings
  add column if not exists qualification_fields text[] not null
    default array['purpose','district','budget','bedrooms','property_type'],
  add column if not exists hot_lead_rules jsonb not null
    default '{"contact_details":true,"budget_known":true,"viewing_requested":true,"ready_within_days":30}'::jsonb,
  add column if not exists handoff_rules jsonb not null
    default '{"customer_requests_human":true,"complaint":true,"negotiation":true,"low_confidence":false}'::jsonb,
  add column if not exists business_rules text;

insert into public.integrations (agency_id, provider, status, public_config)
select a.id, p.provider, 'disconnected', '{}'::jsonb
from public.agencies a
cross join (values ('website_ai'), ('email'), ('whatsapp'), ('voice'), ('facebook'), ('instagram')) p(provider)
on conflict (agency_id, provider) do nothing;

create or replace function public.seed_agency_integrations()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.integrations (agency_id, provider, status, public_config)
  select new.id, provider, 'disconnected', '{}'::jsonb
  from (values ('website_ai'), ('email'), ('whatsapp'), ('voice'), ('facebook'), ('instagram')) providers(provider)
  on conflict (agency_id, provider) do nothing;
  return new;
end;
$$;

drop trigger if exists seed_agency_integrations_after_insert on public.agencies;
create trigger seed_agency_integrations_after_insert
after insert on public.agencies
for each row execute function public.seed_agency_integrations();

create or replace function public.get_widget_config(target_agency_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'agency_id', a.id,
    'agency_name', a.name,
    'logo_url', a.logo_url,
    'brand_settings', a.brand_settings,
    'assistant_name', coalesce(s.assistant_name, 'AI Property Assistant'),
    'welcome_message_so', coalesce(s.welcome_message_so, 'Ku soo dhowow. Sideen kaa caawin karaa raadinta guriga?'),
    'welcome_message_en', coalesce(s.welcome_message_en, 'Welcome. How can I help with your property search?'),
    'supported_languages', coalesce(s.supported_languages, array['so','en']),
    'qualification_fields', coalesce(s.qualification_fields, array['purpose','district','budget','bedrooms','property_type']),
    'hot_lead_rules', coalesce(s.hot_lead_rules, '{}'::jsonb),
    'handoff_rules', coalesce(s.handoff_rules, '{}'::jsonb),
    'business_rules', s.business_rules,
    'human_handoff_enabled', coalesce(s.human_handoff_enabled, true),
    'is_enabled', coalesce(s.is_enabled, false)
  )
  from public.agencies a
  left join public.ai_settings s on s.agency_id = a.id
  where a.id = target_agency_id and a.is_active = true;
$$;

revoke all on function public.seed_agency_integrations() from public;
revoke all on function public.get_widget_config(uuid) from public;
grant execute on function public.get_widget_config(uuid) to anon, authenticated;

commit;
