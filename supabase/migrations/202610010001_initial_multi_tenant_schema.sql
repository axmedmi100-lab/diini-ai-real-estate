begin;

create extension if not exists pgcrypto;

create type public.agency_role as enum ('owner', 'admin', 'manager', 'agent', 'receptionist');
create type public.property_purpose as enum ('rent', 'sale');
create type public.property_status as enum ('available', 'reserved', 'rented', 'sold', 'inactive');
create type public.lead_status as enum ('new', 'qualified', 'hot', 'viewing', 'negotiation', 'won', 'lost');
create type public.conversation_channel as enum ('website', 'whatsapp', 'phone', 'facebook', 'instagram', 'manual');
create type public.conversation_status as enum ('open', 'ai_active', 'human_active', 'closed');
create type public.message_sender as enum ('customer', 'ai', 'agent', 'system');
create type public.viewing_status as enum ('requested', 'confirmed', 'completed', 'cancelled', 'no_show');

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  logo_url text,
  phone text,
  whatsapp text,
  email text,
  website text,
  address text,
  country_code text not null default 'SO' check (char_length(country_code) = 2),
  timezone text not null default 'Africa/Mogadishu',
  default_language text not null default 'so' check (default_language in ('so', 'en')),
  default_currency text not null default 'USD' check (char_length(default_currency) = 3),
  working_hours jsonb not null default '{}'::jsonb,
  brand_settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  preferred_language text not null default 'so' check (preferred_language in ('so', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.agency_role not null default 'agent',
  is_active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, user_id),
  unique (id, agency_id)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null,
  description text,
  property_type text not null check (property_type in ('apartment','house','villa','office','shop','land','commercial','other')),
  purpose public.property_purpose not null,
  district text not null,
  address text,
  price numeric(14,2) not null check (price >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  bedrooms smallint check (bedrooms >= 0),
  bathrooms smallint check (bathrooms >= 0),
  area numeric(12,2) check (area >= 0),
  furnished boolean,
  parking boolean,
  security boolean,
  features jsonb not null default '[]'::jsonb,
  image_urls jsonb not null default '[]'::jsonb,
  video_url text,
  virtual_tour_url text,
  status public.property_status not null default 'available',
  agent_id uuid,
  available_from date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (agent_id, agency_id) references public.agency_members(id, agency_id) on delete set null (agent_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text,
  phone text,
  normalized_phone text,
  email text,
  preferred_language text not null default 'so' check (preferred_language in ('so', 'en')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id)
);

create unique index customers_agency_phone_unique
  on public.customers (agency_id, normalized_phone)
  where normalized_phone is not null;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  customer_id uuid,
  name text,
  phone text,
  email text,
  source text not null default 'manual' check (source in ('website','whatsapp','phone','facebook','instagram','manual','referral','other')),
  purpose public.property_purpose,
  district text,
  budget_min numeric(14,2) check (budget_min >= 0),
  budget_max numeric(14,2) check (budget_max >= 0),
  bedrooms smallint check (bedrooms >= 0),
  property_type text,
  furnished boolean,
  status public.lead_status not null default 'new',
  assigned_agent_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_max is null or budget_min is null or budget_max >= budget_min),
  unique (id, agency_id),
  foreign key (customer_id, agency_id) references public.customers(id, agency_id) on delete set null (customer_id),
  foreign key (assigned_agent_id, agency_id) references public.agency_members(id, agency_id) on delete set null (assigned_agent_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  customer_id uuid,
  lead_id uuid,
  channel public.conversation_channel not null,
  status public.conversation_status not null default 'open',
  assigned_agent_id uuid,
  external_thread_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (customer_id, agency_id) references public.customers(id, agency_id) on delete set null (customer_id),
  foreign key (lead_id, agency_id) references public.leads(id, agency_id) on delete set null (lead_id),
  foreign key (assigned_agent_id, agency_id) references public.agency_members(id, agency_id) on delete set null (assigned_agent_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  conversation_id uuid not null,
  sender_type public.message_sender not null,
  sender_user_id uuid references auth.users(id) on delete set null,
  message text not null,
  message_type text not null default 'text',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, agency_id) references public.conversations(id, agency_id) on delete cascade
);

create table public.viewings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null,
  property_id uuid not null,
  agent_id uuid,
  starts_at timestamptz not null,
  status public.viewing_status not null default 'requested',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (lead_id, agency_id) references public.leads(id, agency_id) on delete cascade,
  foreign key (property_id, agency_id) references public.properties(id, agency_id) on delete restrict,
  foreign key (agent_id, agency_id) references public.agency_members(id, agency_id) on delete set null (agent_id)
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null,
  conversation_id uuid,
  channel public.conversation_channel not null,
  scheduled_for timestamptz not null,
  message_template text not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','cancelled','failed','opted_out')),
  attempt_count smallint not null default 0 check (attempt_count >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (lead_id, agency_id) references public.leads(id, agency_id) on delete cascade,
  foreign key (conversation_id, agency_id) references public.conversations(id, agency_id) on delete set null (conversation_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error')),
  external_account_id text,
  public_config jsonb not null default '{}'::jsonb,
  secret_reference text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, provider)
);

create table public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null unique references public.agencies(id) on delete cascade,
  assistant_name text not null default 'AI Property Assistant',
  welcome_message_so text,
  welcome_message_en text,
  supported_languages text[] not null default array['so','en'],
  system_instructions text,
  matching_weights jsonb not null default '{}'::jsonb,
  human_handoff_enabled boolean not null default true,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_agency_member(target_agency_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = target_agency_id
      and user_id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.can_manage_agency(target_agency_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = target_agency_id
      and user_id = auth.uid()
      and is_active = true
      and role in ('owner', 'admin', 'manager')
  );
$$;

revoke all on function public.is_agency_member(uuid) from public;
revoke all on function public.can_manage_agency(uuid) from public;
grant execute on function public.is_agency_member(uuid) to authenticated;
grant execute on function public.can_manage_agency(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'agencies','user_profiles','agency_members','properties','customers','leads',
    'conversations','messages','viewings','follow_ups','notifications','integrations',
    'ai_settings','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
  end loop;
end $$;

create policy agencies_select on public.agencies for select to authenticated
  using (public.is_agency_member(id) or created_by = auth.uid());
create policy agencies_insert on public.agencies for insert to authenticated
  with check (created_by = auth.uid());
create policy agencies_update on public.agencies for update to authenticated
  using (public.can_manage_agency(id)) with check (public.can_manage_agency(id));

create policy profiles_select on public.user_profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert on public.user_profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.user_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy members_select on public.agency_members for select to authenticated
  using (public.is_agency_member(agency_id) or user_id = auth.uid());
create policy members_insert on public.agency_members for insert to authenticated
  with check (
    public.can_manage_agency(agency_id)
    or (user_id = auth.uid() and role = 'owner' and exists (
      select 1 from public.agencies a where a.id = agency_id and a.created_by = auth.uid()
    ))
  );
create policy members_update on public.agency_members for update to authenticated
  using (public.can_manage_agency(agency_id)) with check (public.can_manage_agency(agency_id));
create policy members_delete on public.agency_members for delete to authenticated
  using (public.can_manage_agency(agency_id) and role <> 'owner');

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'properties','customers','leads','conversations','messages','viewings',
    'follow_ups','notifications','integrations','ai_settings'
  ] loop
    execute format('create policy tenant_select on public.%I for select to authenticated using (public.is_agency_member(agency_id))', table_name);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (public.is_agency_member(agency_id))', table_name);
    execute format('create policy tenant_update on public.%I for update to authenticated using (public.is_agency_member(agency_id)) with check (public.is_agency_member(agency_id))', table_name);
    execute format('create policy tenant_delete on public.%I for delete to authenticated using (public.can_manage_agency(agency_id))', table_name);
  end loop;
end $$;

create policy audit_select on public.audit_logs for select to authenticated
  using (public.can_manage_agency(agency_id));
create policy audit_insert on public.audit_logs for insert to authenticated
  with check (public.is_agency_member(agency_id) and (user_id is null or user_id = auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'agencies','user_profiles','agency_members','properties','customers','leads',
    'conversations','viewings','follow_ups','integrations','ai_settings'
  ] loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end $$;

create index agency_members_agency_status_idx on public.agency_members (agency_id, is_active);
create index properties_agency_status_idx on public.properties (agency_id, status);
create index properties_agency_created_idx on public.properties (agency_id, created_at desc);
create index customers_agency_created_idx on public.customers (agency_id, created_at desc);
create index leads_agency_status_idx on public.leads (agency_id, status);
create index leads_agency_created_idx on public.leads (agency_id, created_at desc);
create index conversations_agency_status_idx on public.conversations (agency_id, status);
create index conversations_agency_created_idx on public.conversations (agency_id, created_at desc);
create index messages_agency_conversation_idx on public.messages (agency_id, conversation_id, created_at);
create index viewings_agency_status_idx on public.viewings (agency_id, status);
create index viewings_agency_starts_idx on public.viewings (agency_id, starts_at);
create index follow_ups_agency_status_idx on public.follow_ups (agency_id, status, scheduled_for);
create index notifications_agency_user_idx on public.notifications (agency_id, user_id, created_at desc);
create index audit_logs_agency_created_idx on public.audit_logs (agency_id, created_at desc);

comment on column public.integrations.secret_reference is
  'Reference to a server-side secret; never store provider access tokens in public_config.';

commit;
