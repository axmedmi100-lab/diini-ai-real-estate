begin;

do $$
declare constraint_row record;
begin
  for constraint_row in
    select conname from pg_constraint
    where conrelid = 'public.property_occupancy_records'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%end_date%is null%'
  loop
    execute format('alter table public.property_occupancy_records drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.property_occupancy_records drop constraint if exists property_occupancy_dates_check;
alter table public.property_occupancy_records
  add constraint property_occupancy_dates_check check (
    (end_date is null or end_date >= start_date) and (status <> 'ended' or end_date is not null)
  );

commit;

