-- Slice 3b.8 — news cover image storage
--
-- Bucket is public-read so published articles can render images directly.
-- Writes stay limited to authenticated users present in public.app_users;
-- the app issues signed upload URLs only after requireAdmin() succeeds.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-images',
  'news-images',
  true,
  5242880,
  array['image/avif', 'image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy news_images_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'news-images');

create policy news_images_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'news-images'
    and exists (
      select 1 from public.app_users u where u.user_id = auth.uid()
    )
  );

create policy news_images_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'news-images'
    and exists (
      select 1 from public.app_users u where u.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'news-images'
    and exists (
      select 1 from public.app_users u where u.user_id = auth.uid()
    )
  );

create policy news_images_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'news-images'
    and exists (
      select 1 from public.app_users u where u.user_id = auth.uid()
    )
  );
