begin;

create table if not exists public.api_rate_limits (
  bucket text not null,
  identity_hash text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  primary key (bucket, identity_hash),
  check (char_length(bucket) between 1 and 64),
  check (char_length(identity_hash) = 64)
);

alter table public.api_rate_limits enable row level security;
alter table public.api_rate_limits force row level security;
revoke all on public.api_rate_limits from anon, authenticated;

create index if not exists api_rate_limits_window_idx
  on public.api_rate_limits (window_started_at);

create or replace function public.consume_api_rate_limit(
  limit_bucket text,
  identity_value text,
  maximum_requests integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
  normalized_bucket text := lower(trim(limit_bucket));
  hashed_identity text;
begin
  if auth.role() not in ('anon','authenticated','service_role') then
    raise exception 'unauthorized';
  end if;
  if char_length(normalized_bucket) not between 1 and 64
    or char_length(identity_value) not between 8 and 512
    or maximum_requests not between 1 and 1000
    or window_seconds not between 1 and 86400 then
    raise exception 'invalid rate limit parameters';
  end if;

  hashed_identity := encode(extensions.digest(identity_value, 'sha256'), 'hex');
  insert into public.api_rate_limits (bucket, identity_hash, window_started_at, request_count)
  values (normalized_bucket, hashed_identity, now(), 1)
  on conflict (bucket, identity_hash) do update
  set request_count = case
        when public.api_rate_limits.window_started_at <= now() - make_interval(secs => window_seconds) then 1
        else public.api_rate_limits.request_count + 1
      end,
      window_started_at = case
        when public.api_rate_limits.window_started_at <= now() - make_interval(secs => window_seconds) then now()
        else public.api_rate_limits.window_started_at
      end
  returning request_count into current_count;

  delete from public.api_rate_limits
  where window_started_at < now() - interval '1 day';
  return current_count <= maximum_requests;
end;
$$;

revoke all on function public.consume_api_rate_limit(text,text,integer,integer) from public;
grant execute on function public.consume_api_rate_limit(text,text,integer,integer) to anon, authenticated, service_role;

commit;
