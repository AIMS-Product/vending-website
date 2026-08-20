import "server-only";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { config } from "@/lib/config";
import type { Database } from "@/types/database";

// Re-exported so existing server callers keep one import site. The parser
// itself lives outside this server-only module because the admin editor is a
// Client Component and needs it too.
export { parseStats, type CaseStudyStat } from "@/lib/case-studies/stats";

/**
 * Build-time anon client. Same RLS surface as the server client used in
 * Server Components, but does NOT read cookies — safe to call from
 * `generateStaticParams`, which runs at build time without a request.
 *
 * Mirrors the equivalent client in `services/news.ts`; the two collections
 * deliberately share one shape so a fix in one is obvious in the other.
 */
let buildTimeClient: ReturnType<
  typeof createSupabaseJsClient<Database>
> | null = null;
function getBuildTimeClient() {
  if (buildTimeClient) return buildTimeClient;
  buildTimeClient = createSupabaseJsClient<Database>(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return buildTimeClient;
}

export type CaseStudy = Database["public"]["Tables"]["case_studies"]["Row"];
export type CaseStudyInsert =
  Database["public"]["Tables"]["case_studies"]["Insert"];
export type CaseStudyUpdate =
  Database["public"]["Tables"]["case_studies"]["Update"];

const PUBLIC_FIELDS =
  "id, slug, title, member_name, member_role, excerpt, youtube_video_id, quote, quote_attribution, body, cover_url, cover_alt, stats, monthly_revenue_usd, machine_count, location_count, months_to_result, prior_occupation, location_types, tags, related_slugs, published_at" as const;

const CARD_FIELDS =
  "slug, title, member_name, member_role, excerpt, youtube_video_id, cover_url, cover_alt, monthly_revenue_usd, machine_count, location_count, prior_occupation, location_types, tags, published_at" as const;

const ADMIN_FIELDS =
  `${PUBLIC_FIELDS}, status, created_at, updated_at` as const;

export type CaseStudyCard = Pick<
  CaseStudy,
  | "slug"
  | "title"
  | "member_name"
  | "member_role"
  | "excerpt"
  | "youtube_video_id"
  | "cover_url"
  | "cover_alt"
  | "monthly_revenue_usd"
  | "machine_count"
  | "location_count"
  | "prior_occupation"
  | "location_types"
  | "tags"
  | "published_at"
>;

// ---------------------------------------------------------------------------
// Public reads (anon-friendly, RLS-gated)
// ---------------------------------------------------------------------------

export async function listPublishedCaseStudies({
  limit = 50,
  offset = 0,
}: { limit?: number; offset?: number } = {}) {
  const supabase = getBuildTimeClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select(CARD_FIELDS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("listPublishedCaseStudies failed", error);
    return [];
  }
  return (data ?? []) as CaseStudyCard[];
}

export async function getPublishedCaseStudyBySlug(slug: string) {
  const supabase = getBuildTimeClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select(PUBLIC_FIELDS)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getPublishedCaseStudyBySlug failed", error);
    return null;
  }
  return data;
}

/**
 * Cards for the "More Success Stories" rail.
 *
 * `slugs` is the editor's curated order and is preserved on the way out —
 * Postgres does not promise `in()` ordering. Any slug that is missing or no
 * longer published simply drops out, which is why the caller tops the list up
 * with recent stories rather than trusting the count.
 */
export async function listCaseStudyCardsBySlugs(slugs: readonly string[]) {
  const wanted = slugs.filter(Boolean);
  if (wanted.length === 0) return [];

  const supabase = getBuildTimeClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select(CARD_FIELDS)
    .eq("status", "published")
    .in("slug", wanted);

  if (error) {
    console.error("listCaseStudyCardsBySlugs failed", error);
    return [];
  }

  const bySlug = new Map(
    ((data ?? []) as CaseStudyCard[]).map((row) => [row.slug, row]),
  );
  return wanted.flatMap((slug) => {
    const row = bySlug.get(slug);
    return row ? [row] : [];
  });
}

/**
 * Used by `generateStaticParams` at build time, so it must NOT use the
 * cookie-aware server client. RLS still applies — we only see published rows.
 */
export async function listPublishedCaseStudySlugs() {
  const supabase = getBuildTimeClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select("slug")
    .eq("status", "published");

  if (error) {
    console.error("listPublishedCaseStudySlugs failed", error);
    return [];
  }
  return (data ?? []).map((row) => row.slug);
}

// ---------------------------------------------------------------------------
// Admin writes (service-role; only call from gated server code)
// ---------------------------------------------------------------------------

type AdminListOptions = { status?: CaseStudy["status"] };

export async function adminListCaseStudies({ status }: AdminListOptions = {}) {
  const supabase = createAdminClient();
  let query = supabase
    .from("case_studies")
    .select(ADMIN_FIELDS)
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function adminGetCaseStudyById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select(ADMIN_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function adminCreateCaseStudy(caseStudy: CaseStudyInsert) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("case_studies")
    .insert(caseStudy)
    .select(ADMIN_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function adminUpdateCaseStudy(id: string, patch: CaseStudyUpdate) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("case_studies")
    .update(patch)
    .eq("id", id)
    .select(ADMIN_FIELDS)
    .single();
  if (error) throw error;
  return data;
}
