-- Guard the testing purge function: drop the unguarded zero-arg overload and
-- require an explicit confirmation phrase so a stray rpc() call cannot wipe
-- pages, redirects, and the revision history.

drop function if exists public.purge_all_seo_pages_for_testing();

create or replace function public.purge_all_seo_pages_for_testing(p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preview_tokens integer := 0;
  v_ai_proposals integer := 0;
  v_content_pieces integer := 0;
  v_redirects integer := 0;
  v_revisions integer := 0;
  v_pages integer := 0;
begin
  if p_confirm is distinct from 'PURGE ALL SEO PAGES PERMANENTLY' then
    raise exception
      'Refusing to purge: pass the exact confirmation phrase to run this destructive testing function.';
  end if;

  update public.seo_pages
    set
      status = 'draft',
      published_at = null,
      published_content = null,
      published_revision_id = null,
      archived_at = null,
      archive_behavior = 'not_found',
      archive_redirect_url = null
    where id is not null;

  delete from public.page_preview_tokens
    where id is not null;
  get diagnostics v_preview_tokens = row_count;

  delete from public.ai_page_proposals
    where id is not null;
  get diagnostics v_ai_proposals = row_count;

  delete from public.page_builder_content_pieces
    where id is not null;
  get diagnostics v_content_pieces = row_count;

  delete from public.redirects
    where page_id is not null;
  get diagnostics v_redirects = row_count;

  alter table public.page_revisions disable trigger page_revisions_no_delete;
  delete from public.page_revisions
    where id is not null;
  get diagnostics v_revisions = row_count;
  alter table public.page_revisions enable trigger page_revisions_no_delete;

  delete from public.seo_pages
    where id is not null;
  get diagnostics v_pages = row_count;

  return jsonb_build_object(
    'deleted_pages', v_pages,
    'deleted_revisions', v_revisions,
    'deleted_preview_tokens', v_preview_tokens,
    'deleted_ai_proposals', v_ai_proposals,
    'deleted_content_pieces', v_content_pieces,
    'deleted_redirects', v_redirects
  );
end;
$$;

revoke all on function public.purge_all_seo_pages_for_testing(text) from public;
grant execute on function public.purge_all_seo_pages_for_testing(text) to service_role;
