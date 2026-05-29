-- SEO Page Builder atomic state transitions.
--
-- Keeps multi-write page state changes inside database transactions so
-- revisions and redirects cannot be committed without the matching page row
-- update.

create or replace function public.publish_seo_page_atomically(
  p_page_id uuid,
  p_slug text,
  p_title text,
  p_target_keyword text,
  p_seo_title text,
  p_meta_description text,
  p_canonical_url text,
  p_noindex boolean,
  p_sitemap_enabled boolean,
  p_structured_data_settings jsonb,
  p_published_content jsonb,
  p_seo_snapshot jsonb,
  p_actor_id uuid,
  p_published_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_page public.seo_pages%rowtype;
  v_updated_page public.seo_pages%rowtype;
  v_revision public.page_revisions%rowtype;
begin
  select *
    into v_current_page
    from public.seo_pages
    where id = p_page_id
    for update;

  if not found then
    raise exception 'SEO page not found';
  end if;

  insert into public.page_revisions (
    page_id,
    revision_type,
    label,
    content_snapshot,
    seo_snapshot,
    created_by
  )
  values (
    p_page_id,
    'publish',
    'Publish ' || p_published_at::text,
    p_published_content,
    p_seo_snapshot,
    p_actor_id
  )
  returning * into v_revision;

  if v_current_page.status = 'published' and v_current_page.slug <> p_slug then
    insert into public.redirects (
      source_path,
      destination_path,
      status_code,
      page_id,
      created_reason,
      created_by
    )
    values (
      '/resources/' || v_current_page.slug,
      '/resources/' || p_slug,
      301,
      p_page_id,
      'slug_changed',
      p_actor_id
    );
  end if;

  update public.seo_pages
    set
      slug = p_slug,
      title = p_title,
      target_keyword = p_target_keyword,
      seo_title = p_seo_title,
      meta_description = p_meta_description,
      canonical_url = p_canonical_url,
      noindex = p_noindex,
      sitemap_enabled = p_sitemap_enabled,
      structured_data_settings = p_structured_data_settings,
      status = 'published',
      published_content = p_published_content,
      published_revision_id = v_revision.id,
      published_at = p_published_at,
      draft_settings = '{}'::jsonb,
      archived_at = null,
      archive_behavior = 'not_found',
      archive_redirect_url = null,
      updated_by = p_actor_id
    where id = p_page_id
    returning * into v_updated_page;

  if not found then
    raise exception 'SEO page not found for publish';
  end if;

  return jsonb_build_object(
    'page', to_jsonb(v_updated_page),
    'revision', to_jsonb(v_revision)
  );
end;
$$;

revoke all on function public.publish_seo_page_atomically(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.publish_seo_page_atomically(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  timestamptz
) to service_role;

create or replace function public.archive_seo_page_atomically(
  p_page_id uuid,
  p_archive_behavior text,
  p_archive_redirect_url text,
  p_current_slug text,
  p_actor_id uuid,
  p_archived_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_page public.seo_pages%rowtype;
  v_updated_page public.seo_pages%rowtype;
  v_source_slug text;
begin
  if p_archive_behavior not in ('not_found', 'redirect') then
    raise exception 'Invalid archive behavior';
  end if;

  select *
    into v_current_page
    from public.seo_pages
    where id = p_page_id
    for update;

  if not found then
    raise exception 'SEO page not found';
  end if;

  if p_archive_behavior = 'redirect' then
    if p_archive_redirect_url is null then
      raise exception 'Archived pages using redirects need a destination';
    end if;

    v_source_slug := coalesce(nullif(p_current_slug, ''), v_current_page.slug);

    insert into public.redirects (
      source_path,
      destination_path,
      status_code,
      page_id,
      created_reason,
      created_by
    )
    values (
      '/resources/' || v_source_slug,
      p_archive_redirect_url,
      301,
      p_page_id,
      'page_archived',
      p_actor_id
    );
  end if;

  update public.seo_pages
    set
      status = 'archived',
      archived_at = p_archived_at,
      archive_behavior = p_archive_behavior,
      archive_redirect_url = p_archive_redirect_url,
      updated_by = p_actor_id
    where id = p_page_id
    returning * into v_updated_page;

  if not found then
    raise exception 'SEO page not found for archive';
  end if;

  return to_jsonb(v_updated_page);
end;
$$;

revoke all on function public.archive_seo_page_atomically(
  uuid,
  text,
  text,
  text,
  uuid,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.archive_seo_page_atomically(
  uuid,
  text,
  text,
  text,
  uuid,
  timestamptz
) to service_role;

create or replace function public.apply_seo_page_revision_update_atomically(
  p_page_id uuid,
  p_revision_type text,
  p_revision_label text,
  p_content_snapshot jsonb,
  p_seo_snapshot jsonb,
  p_draft_content jsonb,
  p_seo_patch jsonb,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_page public.seo_pages%rowtype;
  v_updated_page public.seo_pages%rowtype;
  v_revision public.page_revisions%rowtype;
  v_patch jsonb := coalesce(p_seo_patch, '{}'::jsonb);
begin
  select *
    into v_current_page
    from public.seo_pages
    where id = p_page_id
    for update;

  if not found then
    raise exception 'SEO page not found';
  end if;

  insert into public.page_revisions (
    page_id,
    revision_type,
    label,
    content_snapshot,
    seo_snapshot,
    created_by
  )
  values (
    p_page_id,
    p_revision_type,
    p_revision_label,
    p_content_snapshot,
    p_seo_snapshot,
    p_actor_id
  )
  returning * into v_revision;

  update public.seo_pages
    set
      title = case
        when v_patch ? 'title' then v_patch ->> 'title'
        else title
      end,
      target_keyword = case
        when v_patch ? 'target_keyword' then v_patch ->> 'target_keyword'
        else target_keyword
      end,
      seo_title = case
        when v_patch ? 'seo_title' then v_patch ->> 'seo_title'
        else seo_title
      end,
      meta_description = case
        when v_patch ? 'meta_description' then v_patch ->> 'meta_description'
        else meta_description
      end,
      canonical_url = case
        when v_patch ? 'canonical_url' then v_patch ->> 'canonical_url'
        else canonical_url
      end,
      noindex = case
        when v_patch ? 'noindex' then (v_patch ->> 'noindex')::boolean
        else noindex
      end,
      sitemap_enabled = case
        when v_patch ? 'sitemap_enabled' then (v_patch ->> 'sitemap_enabled')::boolean
        else sitemap_enabled
      end,
      structured_data_settings = case
        when v_patch ? 'structured_data_settings' then v_patch -> 'structured_data_settings'
        else structured_data_settings
      end,
      draft_content = p_draft_content,
      updated_by = p_actor_id
    where id = p_page_id
    returning * into v_updated_page;

  if not found then
    raise exception 'SEO page not found for revision update';
  end if;

  return jsonb_build_object(
    'page', to_jsonb(v_updated_page),
    'revision', to_jsonb(v_revision)
  );
end;
$$;

revoke all on function public.apply_seo_page_revision_update_atomically(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  uuid
) from public, anon, authenticated;
grant execute on function public.apply_seo_page_revision_update_atomically(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  uuid
) to service_role;
