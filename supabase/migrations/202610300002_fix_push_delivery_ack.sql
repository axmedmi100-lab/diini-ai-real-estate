begin;

grant select,update on public.notifications to service_role;

-- Stop notifications that were already delivered repeatedly before the worker
-- had permission to acknowledge them. New notifications remain queueable.
update public.notifications
set push_processed_at=now(),
    push_error=coalesce(push_error,'Recovered after push acknowledgement permission fix')
where push_processed_at is null;

commit;

