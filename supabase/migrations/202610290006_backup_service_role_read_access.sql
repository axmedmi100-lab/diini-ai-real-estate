begin;

grant usage on schema public to service_role;
grant select on table
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
  public.ai_settings,
  public.audit_logs,
  public.platform_users,
  public.platform_audit_logs,
  public.agency_usage_monthly,
  public.platform_plans,
  public.agency_invitations,
  public.property_transactions,
  public.transaction_payments,
  public.property_occupancy_records,
  public.agency_subscriptions,
  public.billing_invoices,
  public.manual_payment_requests,
  public.subscription_automation_events,
  public.platform_expenses,
  public.platform_integration_secrets
to service_role;

commit;

