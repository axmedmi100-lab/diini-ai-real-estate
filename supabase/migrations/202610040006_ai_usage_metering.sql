begin;

create or replace function public.record_ai_usage(
  target_agency_id uuid,
  input_token_count integer,
  output_token_count integer
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.agency_usage_monthly (agency_id, month_start, ai_conversations, ai_input_tokens, ai_output_tokens)
  values (target_agency_id, date_trunc('month', now())::date, 1, greatest(input_token_count, 0), greatest(output_token_count, 0))
  on conflict (agency_id, month_start) do update set
    ai_conversations = public.agency_usage_monthly.ai_conversations + 1,
    ai_input_tokens = public.agency_usage_monthly.ai_input_tokens + excluded.ai_input_tokens,
    ai_output_tokens = public.agency_usage_monthly.ai_output_tokens + excluded.ai_output_tokens,
    updated_at = now();
end;
$$;

revoke all on function public.record_ai_usage(uuid, integer, integer) from public;
grant execute on function public.record_ai_usage(uuid, integer, integer) to service_role;

commit;
