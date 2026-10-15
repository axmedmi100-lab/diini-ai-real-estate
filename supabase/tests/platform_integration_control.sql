begin;

select plan(8);

select has_table('public', 'platform_integration_providers', 'provider catalog exists');
select has_column('public', 'integrations', 'platform_enabled', 'agency integration platform switch exists');
select has_column('public', 'integrations', 'monthly_limit', 'agency integration quota override exists');
select has_function('public', 'get_platform_integration_control', array[]::text[], 'admin control summary RPC exists');
select has_function('public', 'platform_update_integration_provider', array['text','boolean','text','integer'], 'provider control RPC exists');
select has_function('public', 'platform_update_agency_integration', array['uuid','text','boolean','integer'], 'agency override RPC exists');
select is((select count(*)::integer from public.platform_integration_providers where provider in ('openai','website_ai','whatsapp','facebook','instagram')), 5, 'core integration providers are seeded');
select is((select count(*)::integer from public.platform_integration_providers where provider='website_ai' and is_enabled), 1, 'website AI is enabled by default');

select * from finish();
rollback;

