-- Scheduled-publish state is owned by explicit schedule actions and the
-- publish runner. Lifecycle transitions must keep it consistent atomically:
--  * publish clears any pending schedule inside the same transaction (no
--    crash window where a published page is still 'scheduled' and gets
--    republished by the next cron pass)
--  * archive cancels a pending schedule so the runner can never resurrect
--    an archived page
-- Also fixes the archive redirect source to use the page's real route
-- prefix instead of a hardcoded '/resources'.

create or replace function public.publish_seo_page_atomically(
  p_page_id uuid,
  p_slug text,
  p_route_prefix text,
  p_route_path text,
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
  p_published_at timestamptz,
  p_revision_label text default null
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
    coalesce(nullif(btrim(p_revision_label), ''), 'Publish ' || p_published_at::text),
    p_published_content,
    p_seo_snapshot,
    p_actor_id
  )
  returning * into v_revision;

  if v_current_page.status = 'published' and v_current_page.route_path <> p_route_path then
    insert into public.redirects (
      source_path,
      destination_path,
      status_code,
      page_id,
      created_reason,
      created_by
    )
    values (
      v_current_page.route_path,
      p_route_path,
      301,
      p_page_id,
      'slug_changed',
      p_actor_id
    )
    on conflict (source_path) do update
      set
        destination_path = excluded.destination_path,
        status_code = excluded.status_code,
        page_id = excluded.page_id,
        created_reason = excluded.created_reason,
        created_by = excluded.created_by;
  end if;

  update public.seo_pages
    set
      slug = p_slug,
      route_prefix = p_route_prefix,
      route_path = p_route_path,
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
      scheduled_publish_at = null,
      scheduled_publish_status = case
        when v_current_page.scheduled_publish_status = 'none' then 'none'
        else 'published'
      end,
      scheduled_publish_error = null,
      scheduled_publish_attempts = 0,
      scheduled_publish_last_attempt_at = null,
      scheduled_publish_locked_at = null,
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
  v_source_path text;
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

    -- Redirect from the page's live path. A caller-supplied slug still uses
    -- the page's own route prefix; never assume '/resources'.
    if nullif(p_current_slug, '') is not null then
      v_source_path := v_current_page.route_prefix || '/' || p_current_slug;
    else
      v_source_path := v_current_page.route_path;
    end if;

    if v_source_path = p_archive_redirect_url then
      raise exception 'Redirect source and destination must differ';
    end if;

    insert into public.redirects (
      source_path,
      destination_path,
      status_code,
      page_id,
      created_reason,
      created_by
    )
    values (
      v_source_path,
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
      scheduled_publish_at = null,
      scheduled_publish_status = case
        when v_current_page.scheduled_publish_status in ('scheduled', 'failed')
          then 'cancelled'
        else v_current_page.scheduled_publish_status
      end,
      scheduled_publish_error = null,
      scheduled_publish_locked_at = null,
      updated_by = p_actor_id
    where id = p_page_id
    returning * into v_updated_page;

  if not found then
    raise exception 'SEO page not found for archive';
  end if;

  return to_jsonb(v_updated_page);
end;
$$;
