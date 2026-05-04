import "server-only";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { config } from "@/lib/config";
import type { Database } from "@/types/database";

/**
 * Build-time anon client. Same RLS surface as the server client used in
 * Server Components, but does NOT read cookies — safe to call from
 * `generateStaticParams`, which runs at build time without a request.
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

export type NewsPost = Database["public"]["Tables"]["news_posts"]["Row"];
export type NewsPostInsert =
  Database["public"]["Tables"]["news_posts"]["Insert"];
export type NewsPostUpdate =
  Database["public"]["Tables"]["news_posts"]["Update"];

const PUBLIC_FIELDS =
  "id, slug, title, excerpt, body, cover_url, cover_alt, author, published_at" as const;

const ADMIN_FIELDS =
  "id, slug, title, excerpt, body, cover_url, cover_alt, author, status, published_at, created_at, updated_at" as const;

// ---------------------------------------------------------------------------
// Public reads (anon-friendly, RLS-gated)
// ---------------------------------------------------------------------------

export async function listPublishedPosts({
  limit = 20,
  offset = 0,
}: { limit?: number; offset?: number } = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select(PUBLIC_FIELDS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("listPublishedPosts failed", error);
    return [];
  }
  return data ?? [];
}

export async function getPublishedPostBySlug(slug: string) {
  const supabase = getBuildTimeClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select(PUBLIC_FIELDS)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getPublishedPostBySlug failed", error);
    return null;
  }
  return data;
}

/**
 * Used by `generateStaticParams` at build time, so it must NOT use the
 * cookie-aware server client. RLS still applies — we only see published rows.
 */
export async function listPublishedSlugs() {
  const supabase = getBuildTimeClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("slug")
    .eq("status", "published");

  if (error) {
    console.error("listPublishedSlugs failed", error);
    return [];
  }
  return (data ?? []).map((row) => row.slug);
}

// ---------------------------------------------------------------------------
// Admin writes (service-role; only call from gated server code)
// ---------------------------------------------------------------------------

type AdminListOptions = { status?: NewsPost["status"] };

export async function adminListPosts({ status }: AdminListOptions = {}) {
  const supabase = createAdminClient();
  let query = supabase
    .from("news_posts")
    .select(ADMIN_FIELDS)
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function adminGetPostById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select(ADMIN_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function adminCreatePost(post: NewsPostInsert) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("news_posts")
    .insert(post)
    .select(ADMIN_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function adminUpdatePost(id: string, patch: NewsPostUpdate) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("news_posts")
    .update(patch)
    .eq("id", id)
    .select(ADMIN_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function adminPublishPost(id: string) {
  return adminUpdatePost(id, {
    status: "published",
    published_at: new Date().toISOString(),
  });
}

export async function adminUnpublishPost(id: string) {
  return adminUpdatePost(id, { status: "draft", published_at: null });
}

export async function adminArchivePost(id: string) {
  return adminUpdatePost(id, { status: "archived" });
}
