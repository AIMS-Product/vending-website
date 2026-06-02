import "server-only";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { pageContentSchema, type PageContent } from "@/lib/page-builder/blocks";
import { pagePathForSlug } from "@/lib/page-builder/page-paths";
import { config } from "@/lib/config";
import type { Database } from "@/types/database";

type PublicClient = ReturnType<typeof createSupabaseJsClient<Database>>;

export type PublishedSeoPage = {
  id: string;
  slug: string;
  route_prefix: string;
  route_path: string;
  title: string;
  target_keyword: string | null;
  published_content: PageContent;
  seo_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  noindex: boolean;
  sitemap_enabled: boolean;
  structured_data_settings: unknown;
  published_at: string | null;
  updated_at: string;
};

export type BuilderRedirect = {
  source_path: string;
  destination_path: string;
  status_code: number;
};

let publicClient: PublicClient | null = null;

function getPublicClient() {
  if (publicClient) return publicClient;
  publicClient = createSupabaseJsClient<Database>(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return publicClient;
}

const PUBLIC_SEO_PAGE_FIELDS =
  "id, slug, route_prefix, route_path, title, target_keyword, published_content, seo_title, meta_description, canonical_url, noindex, sitemap_enabled, structured_data_settings, published_at, updated_at" as const;
const PUBLIC_SEO_PAGES_TABLE = "published_seo_pages" as const;

export async function listPublishedSeoPageSlugs() {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from(PUBLIC_SEO_PAGES_TABLE)
    .select("slug");

  if (error) {
    throwPublicSeoPageQueryError("listPublishedSeoPageSlugs", error);
  }

  return (data ?? []).map((row) => row.slug);
}

export async function hasPublishedSeoPageSlug(slug: string) {
  return hasPublishedSeoPagePath(pagePathForSlug(slug));
}

export async function hasPublishedSeoPagePath(routePath: string) {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from(PUBLIC_SEO_PAGES_TABLE)
    .select("id")
    .eq("route_path", routePath)
    .maybeSingle();

  if (error) {
    throwPublicSeoPageQueryError("hasPublishedSeoPagePath", error, routePath);
  }

  return Boolean(data);
}

export async function listSitemapSeoPages() {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from(PUBLIC_SEO_PAGES_TABLE)
    .select("slug, route_path, updated_at")
    .eq("sitemap_enabled", true)
    .eq("noindex", false);

  if (error) {
    throwPublicSeoPageQueryError("listSitemapSeoPages", error);
  }

  return data ?? [];
}

export async function getPublishedSeoPageBySlug(slug: string) {
  return getPublishedSeoPageByPath(pagePathForSlug(slug));
}

export async function getPublishedSeoPageByPath(routePath: string) {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from(PUBLIC_SEO_PAGES_TABLE)
    .select(PUBLIC_SEO_PAGE_FIELDS)
    .eq("route_path", routePath)
    .maybeSingle();

  if (error) {
    // A query error (missing view, RLS failure, transport) is NOT a missing
    // page. Throw so it surfaces as a 500 + error log instead of a silent 404
    // that hides infrastructure problems — e.g. an unapplied view migration
    // making every resource page disappear.
    throwPublicSeoPageQueryError("getPublishedSeoPageByPath", error, routePath);
  }
  if (!data || !data.published_content) return null;

  const content = pageContentSchema.safeParse(data.published_content);
  if (!content.success) {
    console.error("published SEO page content is invalid", {
      slug: routePath,
      issues: content.error.issues,
    });
    return null;
  }

  return {
    ...data,
    published_content: content.data,
  } satisfies PublishedSeoPage;
}

function throwPublicSeoPageQueryError(
  operation: string,
  error: { message?: string },
  slug?: string,
): never {
  console.error(`${operation} failed`, error);
  const subject = slug ? ` "${slug}"` : "";
  throw new Error(
    `Failed to load published SEO page${subject}: ${
      error.message ?? "Unknown Supabase query error"
    }`,
  );
}

export async function getBuilderRedirectBySourcePath(sourcePath: string) {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("redirects")
    .select("source_path, destination_path, status_code")
    .eq("source_path", sourcePath)
    .maybeSingle();

  if (error) {
    console.error("getBuilderRedirectBySourcePath failed", error);
    return null;
  }

  return data satisfies BuilderRedirect | null;
}
