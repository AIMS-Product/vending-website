-- SEO Page Builder atomic state transitions (5/5): grant execute to service_role.

grant execute on function
  public.publish_seo_page_atomically(
    uuid, text, text, text, text, text, text, boolean, boolean, jsonb, jsonb, jsonb, uuid, timestamptz
  ),
  public.archive_seo_page_atomically(
    uuid, text, text, text, uuid, timestamptz
  ),
  public.apply_seo_page_revision_update_atomically(
    uuid, text, text, jsonb, jsonb, jsonb, jsonb, uuid
  )
to service_role;
