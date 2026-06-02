create or replace function public.update_seo_page_slug_with_redirect(
  p_page_id uuid,
  p_next_slug text,
  p_next_route_prefix text,
  p_next_route_path text,
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
begin
  select *
    into v_current_page
    from public.seo_pages
    where id = p_page_id
    for update;

  if not found then
    raise exception 'SEO page not found';
  end if;

  if v_current_page.route_path = p_next_route_path then
    return to_jsonb(v_current_page);
  end if;

  update public.seo_pages
    set
      slug = p_next_slug,
      route_prefix = p_next_route_prefix,
      route_path = p_next_route_path,
      updated_by = p_actor_id
    where id = p_page_id
    returning * into v_updated_page;

  if v_current_page.status = 'published' then
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
      p_next_route_path,
      301,
      p_page_id,
      'slug_changed',
      p_actor_id
    );
  end if;

  return to_jsonb(v_updated_page);
end;
$$;
