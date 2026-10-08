begin;

set local role anon;
select set_config('request.jwt.claim.role','anon',true);

do $$
declare
  first_allowed boolean;
  second_allowed boolean;
  other_identity_allowed boolean;
begin
  select public.consume_api_rate_limit('phase9-test','identity-one',1,60) into first_allowed;
  select public.consume_api_rate_limit('phase9-test','identity-one',1,60) into second_allowed;
  select public.consume_api_rate_limit('phase9-test','identity-two',1,60) into other_identity_allowed;
  if first_allowed is not true or second_allowed is not false or other_identity_allowed is not true then
    raise exception 'persistent rate limit isolation failed';
  end if;

  begin
    perform public.consume_api_rate_limit('phase9-test','short',1,60);
    raise exception 'invalid identity unexpectedly accepted';
  exception when others then
    if sqlerrm='invalid identity unexpectedly accepted' then raise; end if;
  end;
end $$;

reset role;

do $$
begin
  if has_table_privilege('anon','public.api_rate_limits','select')
    or has_table_privilege('authenticated','public.api_rate_limits','insert') then
    raise exception 'rate limit table leaked direct privileges';
  end if;
end $$;

rollback;
select 'phase 9 production security test passed' as result;
