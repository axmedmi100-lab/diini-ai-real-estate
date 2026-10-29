begin;

alter table public.platform_expenses
  add column if not exists parent_expense_id uuid references public.platform_expenses(id) on delete set null,
  add column if not exists recurring_day smallint check (recurring_day between 1 and 28),
  add column if not exists next_occurrence_date date;

create unique index if not exists platform_expenses_recurring_instance_unique
  on public.platform_expenses(parent_expense_id,expense_date) where parent_expense_id is not null;
create index if not exists platform_expenses_recurring_due_idx
  on public.platform_expenses(next_occurrence_date) where recurring=true;

update public.platform_expenses
set recurring_day=least(extract(day from expense_date)::integer,28),
    next_occurrence_date=make_date(
      extract(year from (date_trunc('month',expense_date)+interval '1 month'))::integer,
      extract(month from (date_trunc('month',expense_date)+interval '1 month'))::integer,
      least(extract(day from expense_date)::integer,28)
    )
where recurring=true and next_occurrence_date is null;

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
declare new_id uuid; recurrence_day integer; next_date date;
begin
  if not public.is_platform_super_admin() then raise exception 'unauthorized platform actor'; end if;
  if target_category not in ('ai','whatsapp','hosting','payroll','marketing','operations','other') then raise exception 'invalid expense category'; end if;
  if char_length(trim(coalesce(target_description,''))) not between 2 and 160 or target_amount is null or target_amount <= 0 or target_expense_date is null then raise exception 'invalid expense data'; end if;
  if coalesce(target_recurring,false) then
    recurrence_day:=least(extract(day from target_expense_date)::integer,28);
    next_date:=make_date(extract(year from (date_trunc('month',target_expense_date)+interval '1 month'))::integer,extract(month from (date_trunc('month',target_expense_date)+interval '1 month'))::integer,recurrence_day);
  end if;
  insert into public.platform_expenses(category,description,vendor,amount,expense_date,notes,recurring,recurring_day,next_occurrence_date,created_by)
  values(target_category,trim(target_description),nullif(trim(target_vendor),''),target_amount,target_expense_date,nullif(trim(target_notes),''),coalesce(target_recurring,false),recurrence_day,next_date,auth.uid()) returning id into new_id;
  insert into public.platform_audit_logs(actor_user_id,action,metadata)
  values(auth.uid(),'expense.created',jsonb_build_object('expense_id',new_id,'category',target_category,'amount',target_amount,'expense_date',target_expense_date,'recurring',coalesce(target_recurring,false),'next_occurrence_date',next_date));
  return new_id;
end; $$;

create or replace function public.process_recurring_expenses()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare source record; due_date date; created_count integer:=0; inserted_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  for source in
    select * from public.platform_expenses
    where recurring=true and next_occurrence_date is not null and next_occurrence_date<=current_date
    for update skip locked
  loop
    due_date:=source.next_occurrence_date;
    while due_date<=current_date loop
      inserted_id:=null;
      insert into public.platform_expenses(category,description,vendor,amount,currency,expense_date,notes,recurring,parent_expense_id,created_by)
      values(source.category,source.description,source.vendor,source.amount,source.currency,due_date,source.notes,false,source.id,source.created_by)
      on conflict do nothing returning id into inserted_id;
      if inserted_id is not null then
        insert into public.platform_audit_logs(action,metadata)
        values('expense.recurring_created',jsonb_build_object('expense_id',inserted_id,'source_expense_id',source.id,'amount',source.amount,'expense_date',due_date));
        created_count:=created_count+1;
      end if;
      due_date:=(due_date+interval '1 month')::date;
    end loop;
    update public.platform_expenses set next_occurrence_date=due_date where id=source.id;
  end loop;
  return jsonb_build_object('created',created_count);
end; $$;

revoke all on function public.process_recurring_expenses() from public;
grant execute on function public.process_recurring_expenses() to service_role;

commit;

