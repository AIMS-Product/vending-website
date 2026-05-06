-- SEO Page Builder Slice 6 — reusable media storage.
--
-- Public reads are allowed because published resource pages render storage URLs
-- directly. Writes still require an authenticated app user and signed upload
-- URLs are issued only by gated admin actions.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'page-builder-media',
  'page-builder-media',
  true,
  10485760,
  array['image/avif', 'image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy page_builder_media_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'page-builder-media');

create policy page_builder_media_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'page-builder-media'
    and exists (
      select 1 from public.app_users u where u.user_id = auth.uid()
    )
  );

create policy page_builder_media_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'page-builder-media'
    and exists (
      select 1 from public.app_users u where u.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'page-builder-media'
    and exists (
      select 1 from public.app_users u where u.user_id = auth.uid()
    )
  );

create policy page_builder_media_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'page-builder-media'
    and exists (
      select 1 from public.app_users u where u.user_id = auth.uid()
    )
  );
