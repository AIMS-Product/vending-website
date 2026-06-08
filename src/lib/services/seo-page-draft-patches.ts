import { z } from "zod";
import { normalizeSlug, type PageContent } from "@/lib/page-builder/blocks";
import {
  normalizeRoutePrefix,
  pagePathForSlug,
} from "@/lib/page-builder/page-paths";
import {
  defaultStructuredDataSettings,
  parseStructuredDataSettings,
  type StructuredDataSettings,
} from "@/lib/page-builder/structured-data-settings";
import type { Database, Json, Tables } from "@/types/database";

type SeoPage = Tables<"seo_pages">;
type SeoPageUpdate = Database["public"]["Tables"]["seo_pages"]["Update"];

export type SeoPageDraftSettings = {
  slug: string;
  routePrefix: string;
  routePath: string;
  title: string;
  targetKeyword: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  sitemapEnabled: boolean;
  structuredDataSettings: StructuredDataSettings;
};

export type SaveSeoPageDraftInput = {
  slug?: string;
  routePrefix?: string | null;
  title?: string;
  targetKeyword?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean;
  sitemapEnabled?: boolean;
  structuredDataSettings?: StructuredDataSettings;
  internalTags?: string[];
  topicCluster?: string | null;
  campaignLabel?: string | null;
  funnelStage?: string | null;
  reviewPeriodMonths?: number;
  nextReviewAt?: string | null;
  lifecycleStatus?: string;
  ogTitle?: string | null;
  ogDescription?: string | null;
  scheduledPublishAt?: string | null;
  scheduledPublishStatus?: string;
  scheduledPublishError?: string | null;
  scheduledPublishAttempts?: number;
  scheduledPublishLastAttemptAt?: string | null;
  scheduledPublishLockedAt?: string | null;
  draftContent?: unknown;
  draftSettings?: SeoPageDraftSettings | null;
  updatedBy?: string | null;
};

const draftSettingsSchema = z
  .object({
    slug: z.string().trim().min(1).transform(normalizeSlug),
    routePrefix: z.string().trim().optional(),
    routePath: z.string().trim().optional(),
    title: z.string().trim().min(1),
    targetKeyword: z.string().trim().nullable(),
    seoTitle: z.string().trim().nullable(),
    metaDescription: z.string().trim().nullable(),
    canonicalUrl: z.string().trim().nullable(),
    noindex: z.boolean(),
    sitemapEnabled: z.boolean(),
    structuredDataSettings: z.unknown().optional(),
  })
  .strict();

export function buildSeoPageDraftPatch(
  input: SaveSeoPageDraftInput,
  parseDraftContent: (content: unknown) => PageContent,
): SeoPageUpdate {
  const patch: SeoPageUpdate = {};

  if (input.slug !== undefined) patch.slug = normalizeSlug(input.slug);
  if (input.routePrefix !== undefined) {
    patch.route_prefix = normalizeRoutePrefix(input.routePrefix);
  }
  if (patch.slug) {
    patch.route_path = pagePathForSlug(
      patch.slug,
      patch.route_prefix ?? input.routePrefix,
    );
  }
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.targetKeyword !== undefined) {
    patch.target_keyword = input.targetKeyword;
  }
  if (input.seoTitle !== undefined) patch.seo_title = input.seoTitle;
  if (input.metaDescription !== undefined) {
    patch.meta_description = input.metaDescription;
  }
  if (input.canonicalUrl !== undefined) {
    patch.canonical_url = input.canonicalUrl;
  }
  if (input.noindex !== undefined) patch.noindex = input.noindex;
  if (input.sitemapEnabled !== undefined) {
    patch.sitemap_enabled = input.sitemapEnabled;
  }
  if (input.structuredDataSettings !== undefined) {
    patch.structured_data_settings = parseStructuredDataSettings(
      input.structuredDataSettings,
    ) as unknown as Json;
  }
  if (input.internalTags !== undefined)
    patch.internal_tags = input.internalTags;
  if (input.topicCluster !== undefined)
    patch.topic_cluster = input.topicCluster;
  if (input.campaignLabel !== undefined) {
    patch.campaign_label = input.campaignLabel;
  }
  if (input.funnelStage !== undefined) patch.funnel_stage = input.funnelStage;
  if (input.reviewPeriodMonths !== undefined) {
    patch.review_period_months = input.reviewPeriodMonths;
  }
  if (input.nextReviewAt !== undefined)
    patch.next_review_at = input.nextReviewAt;
  if (input.lifecycleStatus !== undefined) {
    patch.lifecycle_status = input.lifecycleStatus;
  }
  if (input.ogTitle !== undefined) patch.og_title = input.ogTitle;
  if (input.ogDescription !== undefined) {
    patch.og_description = input.ogDescription;
  }
  if (input.scheduledPublishAt !== undefined) {
    patch.scheduled_publish_at = input.scheduledPublishAt;
  }
  if (input.scheduledPublishStatus !== undefined) {
    patch.scheduled_publish_status = input.scheduledPublishStatus;
  }
  if (input.scheduledPublishError !== undefined) {
    patch.scheduled_publish_error = input.scheduledPublishError;
  }
  if (input.scheduledPublishAttempts !== undefined) {
    patch.scheduled_publish_attempts = input.scheduledPublishAttempts;
  }
  if (input.scheduledPublishLastAttemptAt !== undefined) {
    patch.scheduled_publish_last_attempt_at =
      input.scheduledPublishLastAttemptAt;
  }
  if (input.scheduledPublishLockedAt !== undefined) {
    patch.scheduled_publish_locked_at = input.scheduledPublishLockedAt;
  }
  if (input.draftContent !== undefined) {
    patch.draft_content = parseDraftContent(
      input.draftContent,
    ) as unknown as Json;
  }
  if (input.draftSettings !== undefined) {
    patch.draft_settings =
      input.draftSettings === null
        ? {}
        : (normalizeDraftSettings(
            draftSettingsSchema.parse(input.draftSettings),
            defaultStructuredDataSettings,
          ) as unknown as Json);
  }
  if (input.updatedBy !== undefined) patch.updated_by = input.updatedBy;

  return patch;
}

export function parseSeoPageDraftSettings(
  value: unknown,
  structuredDataFallback: StructuredDataSettings = defaultStructuredDataSettings,
) {
  const parsed = draftSettingsSchema.safeParse(value);
  return parsed.success
    ? normalizeDraftSettings(parsed.data, structuredDataFallback)
    : null;
}

export function effectivePublishSettings(page: SeoPage): SeoPageDraftSettings {
  return (
    parseSeoPageDraftSettings(
      page.draft_settings,
      parseStructuredDataSettings(page.structured_data_settings),
    ) ?? settingsFromSeoPage(page)
  );
}

export function settingsFromSeoPage(page: SeoPage): SeoPageDraftSettings {
  const routePrefix = normalizeRoutePrefix(page.route_prefix, page.page_type);
  const routePath = pagePathForSlug(page.slug, routePrefix);
  return {
    slug: page.slug,
    routePrefix,
    routePath,
    title: page.title,
    targetKeyword: page.target_keyword,
    seoTitle: page.seo_title,
    metaDescription: page.meta_description,
    canonicalUrl: page.canonical_url,
    noindex: page.noindex,
    sitemapEnabled: page.sitemap_enabled,
    structuredDataSettings: parseStructuredDataSettings(
      page.structured_data_settings,
    ),
  };
}

function normalizeDraftSettings(
  settings: z.infer<typeof draftSettingsSchema>,
  structuredDataFallback: StructuredDataSettings,
): SeoPageDraftSettings {
  const routePrefix = normalizeRoutePrefix(settings.routePrefix);
  const slug = settings.slug;
  return {
    slug,
    routePrefix,
    routePath: pagePathForSlug(slug, routePrefix),
    title: settings.title,
    targetKeyword: settings.targetKeyword,
    seoTitle: settings.seoTitle,
    metaDescription: settings.metaDescription,
    canonicalUrl: settings.canonicalUrl,
    noindex: settings.noindex,
    sitemapEnabled: settings.sitemapEnabled,
    structuredDataSettings: parseStructuredDataSettings(
      settings.structuredDataSettings ?? structuredDataFallback,
    ),
  };
}

export function draftSettingsToSeoPagePatch(
  settings: SeoPageDraftSettings | null,
): Partial<SeoPage> {
  if (!settings) return {};
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
  };
}
