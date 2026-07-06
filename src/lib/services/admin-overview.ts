import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type AdminOverviewClient = Pick<SupabaseClient<Database>, "from">;

type ServiceDeps = {
  client?: AdminOverviewClient;
  now?: () => Date;
};

export type AdminOverview = {
  pagesPublished: number;
  pagesDraft: number;
  postsPublished: number;
  postsDraft: number;
  leadsThisWeek: number;
  leadsTotal: number;
  failedSyncs: number;
  scheduledPublishPending: number;
  scheduledPublishFailed: number;
};

// Matches AdminLeadsManager.tsx's failedSyncCount: a LEAD is stuck when its
// lead_submissions.close_sync_status sits in one of these failure states.
// We count leads (not close_sync_events rows) so the dashboard's
// needs-attention number always equals the leads page banner.
const FAILED_SYNC_STATUSES = ["failed", "needs_review", "dead_letter"] as const;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Read-only counts powering the /admin overview dashboard. Every field is a
 * `head: true` count query — no rows are ever fetched, nothing is written.
 */
export async function getAdminOverview(
  deps: ServiceDeps = {},
): Promise<AdminOverview> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now ?? (() => new Date());
  const weekAgoIso = new Date(now().getTime() - SEVEN_DAYS_MS).toISOString();

  const [
    pagesPublished,
    pagesDraft,
    postsPublished,
    postsDraft,
    leadsThisWeek,
    leadsTotal,
    failedSyncs,
    scheduledPublishPending,
    scheduledPublishFailed,
  ] = await Promise.all([
    countRows(client, "seo_pages", (query) => query.eq("status", "published")),
    countRows(client, "seo_pages", (query) => query.eq("status", "draft")),
    countRows(client, "news_posts", (query) => query.eq("status", "published")),
    countRows(client, "news_posts", (query) => query.eq("status", "draft")),
    countRows(client, "lead_submissions", (query) =>
      query.gte("created_at", weekAgoIso),
    ),
    countRows(client, "lead_submissions", (query) => query),
    countRows(client, "lead_submissions", (query) =>
      query.in("close_sync_status", [...FAILED_SYNC_STATUSES]),
    ),
    countRows(client, "seo_pages", (query) =>
      query.eq("scheduled_publish_status", "scheduled"),
    ),
    countRows(client, "seo_pages", (query) =>
      query.eq("scheduled_publish_status", "failed"),
    ),
  ]);

  return {
    pagesPublished,
    pagesDraft,
    postsPublished,
    postsDraft,
    leadsThisWeek,
    leadsTotal,
    failedSyncs,
    scheduledPublishPending,
    scheduledPublishFailed,
  };
}

type CountableQuery = {
  eq(key: string, value: unknown): CountableQuery;
  in(key: string, values: unknown[]): CountableQuery;
  gte(key: string, value: string): CountableQuery;
  then: PromiseLike<{ count: number | null; error: unknown }>["then"];
};

async function countRows(
  client: AdminOverviewClient,
  table: "seo_pages" | "news_posts" | "lead_submissions",
  applyFilter: (query: CountableQuery) => CountableQuery,
): Promise<number> {
  const base = client
    .from(table)
    .select("id", { count: "exact", head: true }) as unknown as CountableQuery;
  const { count, error } = await applyFilter(base);

  if (error) {
    throw new Error(`Could not load admin overview counts for ${table}.`);
  }
  return count ?? 0;
}
