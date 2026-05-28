import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { pageContentSchema, type PageContent } from "@/lib/page-builder/blocks";
import { config } from "@/lib/config";
import type { Database } from "@/types/database";

type PublicClient = ReturnType<typeof createSupabaseJsClient<Database>>;

export type PublishedSeoPage = {
  id: string;
  slug: string;
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
  "id, slug, title, target_keyword, published_content, seo_title, meta_description, canonical_url, noindex, sitemap_enabled, structured_data_settings, published_at, updated_at" as const;
const PUBLIC_SEO_PAGES_TABLE = "published_seo_pages" as const;

export async function listPublishedSeoPageSlugs() {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from(PUBLIC_SEO_PAGES_TABLE)
    .select("slug");

  if (error) {
    console.error("listPublishedSeoPageSlugs failed", error);
    return [];
  }

  return (data ?? []).map((row) => row.slug);
}

export async function hasPublishedSeoPageSlug(slug: string) {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from(PUBLIC_SEO_PAGES_TABLE)
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("hasPublishedSeoPageSlug failed", error);
    return false;
  }

  return Boolean(data);
}

export async function listSitemapSeoPages() {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from(PUBLIC_SEO_PAGES_TABLE)
    .select("slug, updated_at")
    .eq("sitemap_enabled", true)
    .eq("noindex", false);

  if (error) {
    console.error("listSitemapSeoPages failed", error);
    return [];
  }

  return data ?? [];
}

export async function getPublishedSeoPageBySlug(slug: string) {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from(PUBLIC_SEO_PAGES_TABLE)
    .select(PUBLIC_SEO_PAGE_FIELDS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getPublishedSeoPageBySlug failed", error);
    return null;
  }
  if (!data || !data.published_content) return null;

  const content = pageContentSchema.safeParse(data.published_content);
  if (!content.success) {
    console.error("published SEO page content is invalid", {
      slug,
      issues: content.error.issues,
    });
    return null;
  }

  return {
    ...data,
    published_content: content.data,
  } satisfies PublishedSeoPage;
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
