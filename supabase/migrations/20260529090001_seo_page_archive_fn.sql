-- SEO Page Builder atomic state transitions (2/4): archive.

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
