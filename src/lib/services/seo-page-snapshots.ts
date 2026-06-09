import type { Database, Json, Tables } from "@/types/database";
import {
  settingsFromSeoPage,
  type SeoPageDraftSettings,
} from "@/lib/services/seo-page-draft-patches";

type SeoPage = Tables<"seo_pages">;
type SeoPageUpdate = Database["public"]["Tables"]["seo_pages"]["Update"];

export function seoPatchFromSnapshot(snapshot: Json): SeoPageUpdate {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {};
  }

  const values = snapshot as Record<string, Json | undefined>;
  const patch: SeoPageUpdate = {};
  if (typeof values.title === "string") patch.title = values.title;
  if (typeof values.target_keyword === "string") {
    patch.target_keyword = values.target_keyword;
  }
  if (values.target_keyword === null) patch.target_keyword = null;
  if (typeof values.seo_title === "string") patch.seo_title = values.seo_title;
  if (values.seo_title === null) patch.seo_title = null;
  if (typeof values.meta_description === "string") {
    patch.meta_description = values.meta_description;
  }
  if (values.meta_description === null) patch.meta_description = null;
  if (typeof values.canonical_url === "string") {
    patch.canonical_url = values.canonical_url;
  }
  if (values.canonical_url === null) patch.canonical_url = null;
  if (typeof values.noindex === "boolean") patch.noindex = values.noindex;
  if (typeof values.sitemap_enabled === "boolean") {
    patch.sitemap_enabled = values.sitemap_enabled;
  }
  if (values.structured_data_settings !== undefined) {
    patch.structured_data_settings = values.structured_data_settings;
  }
  if (Array.isArray(values.internal_tags)) {
    patch.internal_tags = values.internal_tags.filter(
      (tag): tag is string => typeof tag === "string",
    );
  }
  if (typeof values.topic_cluster === "string") {
    patch.topic_cluster = values.topic_cluster;
  }
  if (values.topic_cluster === null) patch.topic_cluster = null;
  if (typeof values.campaign_label === "string") {
    patch.campaign_label = values.campaign_label;
  }
  if (values.campaign_label === null) patch.campaign_label = null;
  if (typeof values.funnel_stage === "string") {
    patch.funnel_stage = values.funnel_stage;
  }
  if (values.funnel_stage === null) patch.funnel_stage = null;
  if (typeof values.review_period_months === "number") {
    patch.review_period_months = values.review_period_months;
  }
  if (typeof values.next_review_at === "string") {
    patch.next_review_at = values.next_review_at;
  }
  if (values.next_review_at === null) patch.next_review_at = null;
  if (typeof values.lifecycle_status === "string") {
    patch.lifecycle_status = values.lifecycle_status;
  }
  if (typeof values.og_title === "string") patch.og_title = values.og_title;
  if (values.og_title === null) patch.og_title = null;
  if (typeof values.og_description === "string") {
    patch.og_description = values.og_description;
  }
  if (values.og_description === null) patch.og_description = null;
  // scheduled_publish_* columns are deliberately never restored: schedules
  // are operational state owned by explicit actions and the publish runner,
  // not page content. Restoring an old snapshot must not re-arm a past
  // schedule or clobber the runner's lock. Older revisions may still carry
  // these keys in their snapshots; they are ignored here.
  return patch;
}

export function buildSeoSnapshot(
  page: SeoPage,
  settings: SeoPageDraftSettings = settingsFromSeoPage(page),
): Json {
  return {
    slug: settings.slug,
    route_prefix: settings.routePrefix,
    route_path: settings.routePath,
    title: settings.title,
    target_keyword: settings.targetKeyword,
    seo_title: settings.seoTitle,
    meta_description: settings.metaDescription,
    canonical_url: settings.canonicalUrl,
    noindex: settings.noindex,
    sitemap_enabled: settings.sitemapEnabled,
    structured_data_settings:
      settings.structuredDataSettings as unknown as Json,
    internal_tags: page.internal_tags,
    topic_cluster: page.topic_cluster,
    campaign_label: page.campaign_label,
    funnel_stage: page.funnel_stage,
    review_period_months: page.review_period_months,
    next_review_at: page.next_review_at,
    lifecycle_status: page.lifecycle_status,
    og_title: page.og_title,
    og_description: page.og_description,
  };
}
