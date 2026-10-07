begin;

create or replace function public.record_ai_usage(
  target_agency_id uuid,
  input_token_count integer,
  output_token_count integer,
  estimated_cost numeric
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.agency_usage_monthly (
    agency_id, month_start, ai_conversations, ai_input_tokens,
    ai_output_tokens, estimated_ai_cost_usd
  )
  values (
    target_agency_id, date_trunc('month', now())::date, 1,
    greatest(input_token_count, 0), greatest(output_token_count, 0),
    greatest(coalesce(estimated_cost, 0), 0)
  )
  on conflict (agency_id, month_start) do update set
    ai_conversations = public.agency_usage_monthly.ai_conversations + 1,
    ai_input_tokens = public.agency_usage_monthly.ai_input_tokens + excluded.ai_input_tokens,
    ai_output_tokens = public.agency_usage_monthly.ai_output_tokens + excluded.ai_output_tokens,
    estimated_ai_cost_usd = public.agency_usage_monthly.estimated_ai_cost_usd + excluded.estimated_ai_cost_usd,
    updated_at = now();
end;
$$;

revoke all on function public.record_ai_usage(uuid, integer, integer, numeric) from public;
grant execute on function public.record_ai_usage(uuid, integer, integer, numeric) to service_role;

create index if not exists notifications_agency_unread_idx
  on public.notifications (agency_id, created_at desc)
  where read_at is null;

commit;
