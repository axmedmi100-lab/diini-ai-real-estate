begin;

create policy invoices_admin_select on public.billing_invoices for select to authenticated using (public.is_platform_super_admin());

create or replace function public.get_platform_billing_metrics()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  select jsonb_build_object(
    'mrr', coalesce((select sum(p.monthly_price_usd) from public.agency_subscriptions s join public.platform_plans p on p.code=s.plan_code where s.status='active'),0),
    'revenue_this_month', coalesce((select sum(i.amount_paid) from public.billing_invoices i where i.status='paid' and i.paid_at >= date_trunc('month',now())),0),
    'revenue_total', coalesce((select sum(i.amount_paid) from public.billing_invoices i where i.status='paid'),0),
    'active_subscriptions', (select count(*) from public.agency_subscriptions where status='active'),
    'past_due_subscriptions', (select count(*) from public.agency_subscriptions where status='past_due'),
    'pending_payments', (select count(*) from public.manual_payment_requests where status='pending'),
    'rejected_payments', (select count(*) from public.manual_payment_requests where status='rejected'),
    'plan_counts', jsonb_build_object(
      'starter',(select count(*) from public.agency_subscriptions where status='active' and plan_code='starter'),
      'pro',(select count(*) from public.agency_subscriptions where status='active' and plan_code='pro'),
      'enterprise',(select count(*) from public.agency_subscriptions where status='active' and plan_code='enterprise')
    ),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('month',to_char(month_start,'YYYY-MM'),'revenue',revenue) order by month_start),'[]'::jsonb) from (
      select m.month_start,coalesce(sum(i.amount_paid),0) revenue
      from generate_series(date_trunc('month',now())-interval '11 months',date_trunc('month',now()),interval '1 month') m(month_start)
      left join public.billing_invoices i on i.status='paid' and i.paid_at>=m.month_start and i.paid_at<m.month_start+interval '1 month'
      group by m.month_start
    ) monthly),
    'top_agencies', (select coalesce(jsonb_agg(jsonb_build_object('agency_id',ranked.agency_id,'agency_name',ranked.agency_name,'revenue',ranked.revenue) order by ranked.revenue desc),'[]'::jsonb) from (
      select a.id agency_id,a.name agency_name,sum(i.amount_paid) revenue
      from public.billing_invoices i join public.agencies a on a.id=i.agency_id
      where i.status='paid' group by a.id,a.name order by revenue desc limit 10
    ) ranked)
  ) into result;
  return result;
end; $$;

revoke all on function public.get_platform_billing_metrics() from public;
grant execute on function public.get_platform_billing_metrics() to authenticated;

commit;

