begin;

-- Server-side WhatsApp webhooks use the service-role client. RLS bypass alone
-- does not grant table privileges after the production hardening migration.
grant usage on schema public to service_role;
grant select, insert, update on public.leads to service_role;
grant select, insert, update on public.conversations to service_role;
grant select, insert on public.messages to service_role;
grant select on public.ai_settings to service_role;
grant insert on public.notifications to service_role;

commit;
