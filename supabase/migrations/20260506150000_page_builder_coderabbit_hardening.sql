-- SEO Page Builder CodeRabbit hardening.
--
-- Tightens builder-only admin policies, adds transactional RPCs for slug
-- redirects and AI proposal acceptance, and fills FK gaps in the source
-- library tables.

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users u
    where u.user_id = auth.uid()
      and u.role = 'admin'
  );
$$;

revoke all on function public.is_app_admin() from public, anon, authenticated;
grant execute on function public.is_app_admin() to authenticated, service_role;

comment on table public.page_revisions is
  'Append-only SEO Page Builder snapshots. Pages are archived instead of deleted so immutable revisions remain available for audit and rollback evidence.';

alter table public.media_assets
  add constraint media_assets_complete_location
  check (
    external_url is not null
    or (storage_bucket is not null and storage_path is not null)
  )
  not valid;

alter table public.source_excerpts
  drop constraint if exists source_excerpts_source_document_id_fkey;

alter table public.source_excerpts
  add constraint source_excerpts_source_document_id_fkey
  foreign key (source_document_id)
  references public.source_documents(id)
  on delete cascade;

alter table public.approved_claims
  drop constraint if exists approved_claims_source_excerpt_id_fkey;

alter table public.approved_claims
  add constraint approved_claims_source_excerpt_id_fkey
  foreign key (source_excerpt_id)
  references public.source_excerpts(id)
  on delete cascade;

alter table public.source_documents
  add constraint source_documents_created_by_fkey
  foreign key (created_by)
  references auth.users(id)
  on delete set null
  not valid;

alter table public.source_excerpts
  add constraint source_excerpts_approved_by_fkey
  foreign key (approved_by)
  references auth.users(id)
  on delete set null
  not valid;

alter table public.approved_claims
  add constraint approved_claims_approved_by_fkey
  foreign key (approved_by)
  references auth.users(id)
  on delete set null
  not valid;

create or replace function public.update_seo_page_slug_with_redirect(
  p_page_id uuid,
  p_next_slug text,
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

  if v_current_page.slug = p_next_slug then
    return to_jsonb(v_current_page);
  end if;

  update public.seo_pages
    set
      slug = p_next_slug,
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
      '/resources/' || v_current_page.slug,
      '/resources/' || p_next_slug,
      301,
      p_page_id,
      'slug_changed',
      p_actor_id
    );
  end if;

  return to_jsonb(v_updated_page);
end;
$$;

revoke all on function public.update_seo_page_slug_with_redirect(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.update_seo_page_slug_with_redirect(uuid, text, uuid)
  to service_role;

create or replace function public.accept_ai_proposal_blocks(
  p_page_id uuid,
  p_proposal_id uuid,
  p_next_content jsonb,
  p_seo_snapshot jsonb,
  p_accepted_block_ids text[],
  p_actor_id uuid,
  p_label text,
  p_accepted_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_page public.seo_pages%rowtype;
  v_updated_proposal public.ai_page_proposals%rowtype;
  v_revision public.page_revisions%rowtype;
  v_accepted_at timestamptz := coalesce(p_accepted_at, now());
begin
  update public.ai_page_proposals
    set
      status = 'accepted',
      accepted_block_ids = p_accepted_block_ids,
      accepted_by = p_actor_id,
      accepted_at = v_accepted_at
    where id = p_proposal_id
      and page_id = p_page_id
      and status = 'proposed'
    returning * into v_updated_proposal;

  if not found then
    raise exception 'AI proposal is not available for insertion.';
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
    'ai_insert',
    p_label,
    p_next_content,
    p_seo_snapshot,
    p_actor_id
  )
  returning * into v_revision;

  update public.seo_pages
    set
      draft_content = p_next_content,
      updated_by = p_actor_id
    where id = p_page_id
    returning * into v_updated_page;

  if not found then
    raise exception 'SEO page not found for AI proposal insertion.';
  end if;

  return jsonb_build_object(
    'page', to_jsonb(v_updated_page),
    'proposal', to_jsonb(v_updated_proposal),
    'revision', to_jsonb(v_revision)
  );
end;
$$;

revoke all on function public.accept_ai_proposal_blocks(
  uuid,
  uuid,
  jsonb,
  jsonb,
  text[],
  uuid,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.accept_ai_proposal_blocks(
  uuid,
  uuid,
  jsonb,
  jsonb,
  text[],
  uuid,
  text,
  timestamptz
) to service_role;

drop policy if exists media_assets_admin_all on public.media_assets;
create policy media_assets_admin_all
  on public.media_assets
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists seo_pages_admin_all on public.seo_pages;
create policy seo_pages_admin_all
  on public.seo_pages
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists page_revisions_admin_all on public.page_revisions;
create policy page_revisions_admin_all
  on public.page_revisions
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists redirects_admin_all on public.redirects;
create policy redirects_admin_all
  on public.redirects
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists page_preview_tokens_admin_all on public.page_preview_tokens;
create policy page_preview_tokens_admin_all
  on public.page_preview_tokens
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists proof_items_admin_all on public.proof_items;
create policy proof_items_admin_all
  on public.proof_items
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists cta_presets_admin_all on public.cta_presets;
create policy cta_presets_admin_all
  on public.cta_presets
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists source_documents_admin_all on public.source_documents;
create policy source_documents_admin_all
  on public.source_documents
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists source_excerpts_admin_all on public.source_excerpts;
create policy source_excerpts_admin_all
  on public.source_excerpts
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists approved_claims_admin_all on public.approved_claims;
create policy approved_claims_admin_all
  on public.approved_claims
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists ai_page_proposals_admin_all on public.ai_page_proposals;
create policy ai_page_proposals_admin_all
  on public.ai_page_proposals
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists page_builder_media_admin_insert on storage.objects;
create policy page_builder_media_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'page-builder-media'
    and public.is_app_admin()
  );

drop policy if exists page_builder_media_admin_update on storage.objects;
create policy page_builder_media_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'page-builder-media'
    and public.is_app_admin()
  )
  with check (
    bucket_id = 'page-builder-media'
    and public.is_app_admin()
  );

drop policy if exists page_builder_media_admin_delete on storage.objects;
create policy page_builder_media_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'page-builder-media'
    and public.is_app_admin()
  );
