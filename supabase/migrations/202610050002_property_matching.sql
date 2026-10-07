begin;

alter table public.leads add column if not exists timeline text;

create table if not exists public.lead_property_matches (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null,
  property_id uuid not null,
  score smallint not null check (score between 0 and 100),
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'recommended' check (status in ('recommended','outreach_draft','dismissed')),
  prepared_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, property_id),
  foreign key (lead_id, agency_id) references public.leads(id, agency_id) on delete cascade,
  foreign key (property_id, agency_id) references public.properties(id, agency_id) on delete cascade
);

alter table public.lead_property_matches enable row level security;
alter table public.lead_property_matches force row level security;
create policy match_select on public.lead_property_matches for select to authenticated using (public.is_agency_member(agency_id));
create policy match_insert on public.lead_property_matches for insert to authenticated with check (public.can_manage_agency(agency_id) or public.is_agency_member(agency_id));
create policy match_update on public.lead_property_matches for update to authenticated using (public.is_agency_member(agency_id)) with check (public.is_agency_member(agency_id));
create policy match_delete on public.lead_property_matches for delete to authenticated using (public.can_manage_agency(agency_id));
create trigger set_lead_property_matches_updated_at before update on public.lead_property_matches for each row execute function public.set_updated_at();
create index if not exists lead_property_matches_agency_lead_idx on public.lead_property_matches (agency_id, lead_id, score desc);
create index if not exists lead_property_matches_agency_property_idx on public.lead_property_matches (agency_id, property_id, score desc);
grant select, insert, update, delete on public.lead_property_matches to authenticated;

create or replace function public.set_widget_lead_timeline(target_agency_id uuid, target_conversation_id uuid, session_token uuid, wanted_timeline text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.leads l set timeline = left(nullif(trim(wanted_timeline), ''), 200), updated_at = now()
  from public.conversations c
  where c.id = target_conversation_id and c.agency_id = target_agency_id
    and c.public_session_token = session_token and l.id = c.lead_id and l.agency_id = target_agency_id;
end;
$$;
revoke all on function public.set_widget_lead_timeline(uuid,uuid,uuid,text) from public;
grant execute on function public.set_widget_lead_timeline(uuid,uuid,uuid,text) to anon, authenticated;

commit;
