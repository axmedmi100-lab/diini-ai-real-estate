begin;

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.agencies,
  public.user_profiles,
  public.agency_members,
  public.properties,
  public.customers,
  public.leads,
  public.conversations,
  public.messages,
  public.viewings,
  public.follow_ups,
  public.notifications,
  public.integrations,
  public.ai_settings
to authenticated;

grant select, insert on table public.audit_logs to authenticated;

revoke all on all tables in schema public from anon;

commit;
