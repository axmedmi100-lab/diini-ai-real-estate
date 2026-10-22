begin;

grant select on table public.viewings to service_role;
grant select on table public.properties to service_role;

commit;

