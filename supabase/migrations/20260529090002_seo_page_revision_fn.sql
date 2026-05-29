-- SEO Page Builder atomic state transitions (3/4): revision update.

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
