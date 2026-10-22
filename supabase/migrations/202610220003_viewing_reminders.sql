begin;

alter table public.follow_ups
  add column if not exists viewing_id uuid,
  add column if not exists reminder_offset_minutes integer;

alter table public.follow_ups drop constraint if exists follow_ups_viewing_id_fkey;
alter table public.follow_ups add constraint follow_ups_viewing_id_fkey
  foreign key (viewing_id) references public.viewings(id) on delete cascade;

alter table public.follow_ups drop constraint if exists follow_ups_reminder_offset_check;
alter table public.follow_ups add constraint follow_ups_reminder_offset_check
  check (reminder_offset_minutes is null or reminder_offset_minutes in (120, 1440));

create unique index if not exists follow_ups_viewing_reminder_unique
  on public.follow_ups (viewing_id, reminder_offset_minutes)
  where viewing_id is not null and reminder_offset_minutes is not null;

commit;

