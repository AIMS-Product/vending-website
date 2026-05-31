revoke all on function
  public.publish_seo_page_atomically(
    uuid, text, text, text, text, text, text, boolean, boolean, jsonb, jsonb, jsonb, uuid, timestamptz, text
  )
from public, anon, authenticated;

grant execute on function
  public.publish_seo_page_atomically(
    uuid, text, text, text, text, text, text, boolean, boolean, jsonb, jsonb, jsonb, uuid, timestamptz, text
  )
to service_role;
