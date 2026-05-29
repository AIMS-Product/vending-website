-- SEO Page Builder atomic state transitions (4/5): revoke default execute.
--
-- Postgres grants EXECUTE to PUBLIC on new functions, which would expose
-- these security-definer functions to anon/authenticated via PostgREST RPC.
-- One REVOKE targeting all three functions keeps this a single command so
-- the CLI can push it (multi-command files hit SQLSTATE 42601).

revoke all on function
  public.publish_seo_page_atomically(
    uuid, text, text, text, text, text, text, boolean, boolean, jsonb, jsonb, jsonb, uuid, timestamptz
  ),
  public.archive_seo_page_atomically(
    uuid, text, text, text, uuid, timestamptz
  ),
  public.apply_seo_page_revision_update_atomically(
    uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid
  )
from public, anon, authenticated;
