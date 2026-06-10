-- Keep manual-save revision history bounded: retain only the newest N
-- manual_save revisions per page. page_revisions is append-only (the
-- page_revisions_no_delete trigger raises on any delete), so the prune must
-- run inside a security-definer function that briefly disables that trigger,
-- mirroring the established pattern in 20260609110000 / 20260610090000.
--
-- Additive only: this CREATE FUNCTION does not alter the page_revisions table,
-- its immutability triggers, or any existing function. The delete is scoped to
-- a single page AND revision_type = 'manual_save', so publish, rollback,
-- autosave, and ai_insert history (and every other page) are never touched.

create or replace function public.prune_seo_page_manual_save_revisions(
  p_page_id uuid,
  p_keep integer default 20
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep integer := greatest(coalesce(p_keep, 20), 0);
  v_deleted integer := 0;
begin
  if p_page_id is null then
    raise exception 'prune_seo_page_manual_save_revisions requires a page id';
  end if;

  alter table public.page_revisions disable trigger page_revisions_no_delete;

  with ranked as (
    select
      id,
      row_number() over (
        order by created_at desc, id desc
      ) as rn
    from public.page_revisions
    where page_id = p_page_id
      and revision_type = 'manual_save'
  )
  delete from public.page_revisions pr
    using ranked r
    where pr.id = r.id
      and r.rn > v_keep;
  get diagnostics v_deleted = row_count;

  alter table public.page_revisions enable trigger page_revisions_no_delete;

  return v_deleted;
exception
  when others then
    -- Never leave the immutability trigger disabled if the delete fails.
    alter table public.page_revisions enable trigger page_revisions_no_delete;
    raise;
end;
$$;

revoke all on function public.prune_seo_page_manual_save_revisions(uuid, integer)
  from public;
grant execute on function public.prune_seo_page_manual_save_revisions(uuid, integer)
  to service_role;
