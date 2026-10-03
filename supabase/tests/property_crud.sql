begin;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'property-images' and public = true and file_size_limit = 5242880) then
    raise exception 'property-images bucket is missing or misconfigured';
  end if;

  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'property_images_%') <> 4 then
    raise exception 'property image policies are incomplete';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'properties' and policyname = 'tenant_insert') then
    raise exception 'property tenant insert policy is missing';
  end if;
end;
$$;

select 'property CRUD test passed' as result;

rollback;
