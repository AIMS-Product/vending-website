import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { rowIsDeletableAsNeverSavedDraft } from "@/components/admin/seo-page-editor/unsaved-exit-guard-state";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type SeoPageDraftsClient = Pick<SupabaseClient<Database>, "from">;

type ServiceDeps = {
  client?: SeoPageDraftsClient;
};

export type DeleteNeverSavedDraftResult =
  | { status: "deleted" }
  | { status: "not_found" }
  // The row exists but is not a never-explicitly-saved auto-draft (e.g. it was
  // published, was previously published, or has revision history). The server
  // refuses to delete it — this is the data-loss floor for issue I5.
  | { status: "protected" };

// N6 / issue I5: delete a draft row that was auto-created by S3b but never
// explicitly saved by the user, when they Discard it from the unsaved-exit
// guard. The server re-derives a hard safety floor from the row's own state so
// it can never delete an explicitly-saved or published page, regardless of
// what the client sends.
export async function adminDeleteNeverSavedSeoPageDraft(
  pageId: string,
  deps: ServiceDeps = {},
): Promise<DeleteNeverSavedDraftResult> {
  const client = deps.client ?? createAdminClient();

  const { data: row, error: loadError } = await client
    .from("seo_pages")
    .select("id, status, published_at, published_revision_id")
    .eq("id", pageId)
    .maybeSingle();

  if (loadError) throw new Error("Could not load SEO page.");
  if (!row) return { status: "not_found" };

  const { count, error: countError } = await client
    .from("page_revisions")
    .select("id", { count: "exact", head: true })
    .eq("page_id", pageId);

  if (countError) throw new Error("Could not load SEO page revisions.");

  const deletable = rowIsDeletableAsNeverSavedDraft({
    status: row.status,
    published_at: row.published_at,
    published_revision_id: row.published_revision_id,
    revisionCount: count ?? 0,
  });
  if (!deletable) return { status: "protected" };

  const { error: deleteError } = await client
    .from("seo_pages")
    .delete()
    .eq("id", pageId);

  if (deleteError) throw new Error("Could not delete SEO page draft.");
  return { status: "deleted" };
}
