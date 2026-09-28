import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTable } from "@/lib/seo/db";
import { PLANNED_LINKS } from "@/lib/seo/interlinking-map";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";

/**
 * /admin/seo Content Plan, Tasks and Roadmap. Tables: seo_content_pieces,
 * seo_tasks, seo_monthly_reviews, seo_pages. A piece is live when its
 * /resources/{slug} page is published in the page builder.
 */

type Client = Pick<SupabaseClient<Database>, "from">;
type Missing = { missing: true };
const MISSING: Missing = { missing: true };
/** The Monday the production sequence starts (week 1). */
export const PLAN_WEEK1 = "2026-09-28";

function fail(what: string, error: { message: string }): never {
  console.error(`seo plan read failed: ${what}`, { message: error.message });
  throw new Error(`Could not read ${what}.`);
}

export type PlanPiece = Tables<"seo_content_pieces"> & {
  live: boolean;
  liveSince: string | null;
  cmsPageId: string | null;
  /** Planned inbound links from pieces that are live now. */
  liveInbound: number;
  plannedInbound: number;
};

export type ContentPlan = {
  missing: false;
  pieces: PlanPiece[];
  hubs: Array<{ hub: number; live: number; total: number }>;
  /** Cumulative planned vs live, one point a week from week 1. */
  burnUp: Array<{ week: number; planned: number; live: number }>;
};

export async function getContentPlan(
  deps: { client?: Client; now?: Date } = {},
): Promise<ContentPlan | Missing> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now ?? new Date();
  const pieces = await client
    .from("seo_content_pieces")
    .select("*")
    .order("sequence_week", { nullsFirst: false });
  if (isMissingTable(pieces.error)) return MISSING;
  if (pieces.error) fail("the content plan", pieces.error);
  const pages = await client
    .from("seo_pages")
    .select("id, route_path, status, published_at")
    .like("route_path", "/resources/%");
  if (pages.error) fail("page builder pages", pages.error);

  const bySlug = new Map(
    (pages.data ?? []).map((p) => [
      p.route_path.replace(/^\/resources\//, ""),
      p,
    ]),
  );
  const ordered = [...(pieces.data ?? [])].sort(
    (a, b) =>
      (a.sequence_week ?? 99) - (b.sequence_week ?? 99) ||
      a.hub - b.hub ||
      a.id.localeCompare(b.id, "en", { numeric: true }),
  );
  const base = ordered.map((piece) => {
    const page = bySlug.get(piece.slug);
    const live = page?.status === "published";
    return {
      ...piece,
      live,
      liveSince:
        live && page?.published_at ? page.published_at.slice(0, 10) : null,
      cmsPageId: page?.id ?? null,
    };
  });
  const liveIds = new Set(base.filter((p) => p.live).map((p) => p.id));
  const withLinks: PlanPiece[] = base.map((p) => {
    const inbound = PLANNED_LINKS.filter(([, to]) => to === p.id);
    return {
      ...p,
      plannedInbound: inbound.length,
      liveInbound: inbound.filter(([from]) => liveIds.has(from)).length,
    };
  });

  // Aliases ("same page as ...") are tracked, never counted twice.
  const counted = withLinks.filter((p) => !p.notes?.startsWith("Same page as"));
  const hubs = [1, 2, 3, 4, 5, 6, 7].map((hub) => {
    const list = counted.filter((p) => p.hub === hub);
    return { hub, live: list.filter((p) => p.live).length, total: list.length };
  });
  const weekOf = (day: string) =>
    Math.floor((Date.parse(day) - Date.parse(PLAN_WEEK1)) / (7 * 86_400_000)) +
    1;
  const thisWeek = Math.max(1, weekOf(now.toISOString().slice(0, 10)));
  const lastWeek = Math.max(
    thisWeek,
    ...counted.map((p) => p.sequence_week ?? 0),
  );
  const burnUp = Array.from({ length: Math.min(lastWeek, 26) }, (_, i) => {
    const week = i + 1;
    return {
      week,
      planned: counted.filter((p) => (p.sequence_week ?? 99) <= week).length,
      live:
        week > thisWeek
          ? -1
          : counted.filter((p) => p.liveSince && weekOf(p.liveSince) <= week)
              .length,
    };
  });
  return { missing: false, pieces: withLinks, hubs, burnUp };
}

export type TaskFilter = {
  status?: "open" | "done" | "all";
  type?: string;
  owner?: string;
};

export async function getSeoTasks(
  filter: TaskFilter = {},
  deps: { client?: Client } = {},
): Promise<{ missing: false; tasks: Tables<"seo_tasks">[] } | Missing> {
  const client = deps.client ?? createAdminClient();
  let query = client.from("seo_tasks").select("*");
  if (filter.status === "done")
    query = query.in("status", ["done", "dismissed"]);
  else if (filter.status !== "all")
    query = query.in("status", ["open", "in_progress"]);
  if (filter.type) query = query.eq("type", filter.type);
  if (filter.owner) query = query.eq("owner", filter.owner);
  const { data, error } = await query
    .neq("type", "roadmap")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);
  if (isMissingTable(error)) return MISSING;
  if (error) fail("SEO tasks", error);
  const rank = { urgent: 0, high: 1, medium: 2, low: 3 } as Record<
    string,
    number
  >;
  const tasks = [...(data ?? [])].sort(
    (a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9),
  );
  return { missing: false, tasks };
}

export const ROADMAP_PHASES = [
  "Foundation",
  "Content engine",
  "Optimization",
  "Paid",
  "Local",
  "Decisions",
] as const;

export async function getRoadmap(deps: { client?: Client } = {}): Promise<
  | {
      missing: false;
      items: Tables<"seo_tasks">[];
      reviews: Tables<"seo_monthly_reviews">[];
    }
  | Missing
> {
  const client = deps.client ?? createAdminClient();
  const [items, reviews] = await Promise.all([
    client
      .from("seo_tasks")
      .select("*")
      .eq("type", "roadmap")
      .order("seed_key"),
    client
      .from("seo_monthly_reviews")
      .select("*")
      .order("month", { ascending: false })
      .limit(12),
  ]);
  if (isMissingTable(items.error) || isMissingTable(reviews.error))
    return MISSING;
  if (items.error) fail("the roadmap", items.error);
  if (reviews.error) fail("monthly reviews", reviews.error);
  return {
    missing: false,
    items: items.data ?? [],
    reviews: reviews.data ?? [],
  };
}
