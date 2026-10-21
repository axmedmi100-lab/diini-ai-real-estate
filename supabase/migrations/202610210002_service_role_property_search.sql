begin;

-- Server-side WhatsApp webhooks search listings with the service-role client.
-- Keep the function's existing tenant filter and grant only execution.
grant execute on function public.search_widget_properties(
  uuid,
  public.property_purpose,
  text,
  numeric,
  numeric,
  smallint,
  text,
  boolean
) to service_role;

commit;
