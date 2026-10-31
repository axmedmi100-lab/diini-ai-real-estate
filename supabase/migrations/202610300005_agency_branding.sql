begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agency-branding','agency-branding',true,2097152,array['image/jpeg','image/png'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists agency_branding_select on storage.objects;
create policy agency_branding_select on storage.objects for select using (bucket_id='agency-branding');
drop policy if exists agency_branding_insert on storage.objects;
create policy agency_branding_insert on storage.objects for insert to authenticated
with check (bucket_id='agency-branding' and public.can_manage_agency(((storage.foldername(name))[1])::uuid));
drop policy if exists agency_branding_update on storage.objects;
create policy agency_branding_update on storage.objects for update to authenticated
using (bucket_id='agency-branding' and public.can_manage_agency(((storage.foldername(name))[1])::uuid))
with check (bucket_id='agency-branding' and public.can_manage_agency(((storage.foldername(name))[1])::uuid));
drop policy if exists agency_branding_delete on storage.objects;
create policy agency_branding_delete on storage.objects for delete to authenticated
using (bucket_id='agency-branding' and public.can_manage_agency(((storage.foldername(name))[1])::uuid));

commit;

