begin;

create table public.platform_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('ai','whatsapp','hosting','payroll','marketing','operations','other')),
  description text not null check (char_length(trim(description)) between 2 and 160),
  vendor text,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'usd' check (currency='usd'),
  expense_date date not null default current_date,
  notes text,
  recurring boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_expenses enable row level security;
alter table public.platform_expenses force row level security;
create policy platform_expenses_admin_select on public.platform_expenses for select to authenticated using (public.is_platform_super_admin());
revoke all on public.platform_expenses from anon,authenticated;
grant select on public.platform_expenses to authenticated;
grant all on public.platform_expenses to service_role;
create trigger set_platform_expenses_updated_at before update on public.platform_expenses for each row execute function public.set_updated_at();
create index platform_expenses_date_idx on public.platform_expenses(expense_date desc);
create index platform_expenses_category_date_idx on public.platform_expenses(category,expense_date desc);

create or replace function public.platform_create_expense(
  target_category text,
  target_description text,
  target_vendor text,
  target_amount numeric,
  target_expense_date date,
  target_notes text default null,
  target_recurring boolean default false
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  if target_category not in ('ai','whatsapp','hosting','payroll','marketing','operations','other') then raise exception 'invalid expense category'; end if;
  if char_length(trim(coalesce(target_description,''))) not between 2 and 160 or target_amount is null or target_amount <= 0 or target_expense_date is null then raise exception 'invalid expense data'; end if;
  insert into public.platform_expenses(category,description,vendor,amount,expense_date,notes,recurring,created_by)
  values(target_category,trim(target_description),nullif(trim(target_vendor),''),target_amount,target_expense_date,nullif(trim(target_notes),''),coalesce(target_recurring,false),auth.uid()) returning id into new_id;
  insert into public.platform_audit_logs(actor_user_id,action,metadata)
  values(auth.uid(),'expense.created',jsonb_build_object('expense_id',new_id,'category',target_category,'amount',target_amount,'expense_date',target_expense_date));
  return new_id;
end; $$;

create or replace function public.platform_delete_expense(target_expense_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare deleted_expense public.platform_expenses%rowtype;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  delete from public.platform_expenses where id=target_expense_id returning * into deleted_expense;
  if not found then raise exception 'expense not found'; end if;
  insert into public.platform_audit_logs(actor_user_id,action,metadata)
  values(auth.uid(),'expense.deleted',jsonb_build_object('expense_id',deleted_expense.id,'category',deleted_expense.category,'amount',deleted_expense.amount,'description',deleted_expense.description));
end; $$;

create or replace function public.get_platform_profit_loss()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  select jsonb_build_object(
    'revenue_this_month',coalesce((select sum(amount_paid) from public.billing_invoices where status='paid' and paid_at>=date_trunc('month',now())),0),
    'expenses_this_month',coalesce((select sum(amount) from public.platform_expenses where expense_date>=date_trunc('month',current_date)::date),0),
    'profit_this_month',coalesce((select sum(amount_paid) from public.billing_invoices where status='paid' and paid_at>=date_trunc('month',now())),0)-coalesce((select sum(amount) from public.platform_expenses where expense_date>=date_trunc('month',current_date)::date),0),
    'expenses_total',coalesce((select sum(amount) from public.platform_expenses),0),
    'category_totals',(select coalesce(jsonb_agg(jsonb_build_object('category',category,'amount',amount) order by amount desc),'[]'::jsonb) from (select category,sum(amount) amount from public.platform_expenses group by category) categories),
    'history',(select coalesce(jsonb_agg(jsonb_build_object('month',to_char(month_start,'YYYY-MM'),'revenue',revenue,'expenses',expenses,'profit',revenue-expenses) order by month_start),'[]'::jsonb) from (
      select m.month_start,
        coalesce((select sum(i.amount_paid) from public.billing_invoices i where i.status='paid' and i.paid_at>=m.month_start and i.paid_at<m.month_start+interval '1 month'),0) revenue,
        coalesce((select sum(e.amount) from public.platform_expenses e where e.expense_date>=m.month_start::date and e.expense_date<(m.month_start+interval '1 month')::date),0) expenses
      from generate_series(date_trunc('month',now())-interval '11 months',date_trunc('month',now()),interval '1 month') m(month_start)
    ) monthly)
  ) into result;
  return result;
end; $$;

revoke all on function public.platform_create_expense(text,text,text,numeric,date,text,boolean) from public;
revoke all on function public.platform_delete_expense(uuid) from public;
revoke all on function public.get_platform_profit_loss() from public;
grant execute on function public.platform_create_expense(text,text,text,numeric,date,text,boolean) to authenticated;
grant execute on function public.platform_delete_expense(uuid) to authenticated;
grant execute on function public.get_platform_profit_loss() to authenticated;

commit;

