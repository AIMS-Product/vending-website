import type { PageAutosavePayload } from "@/app/admin/pages/actions";
import type { PageContent } from "@/lib/page-builder/blocks";

type SeoPageAutosaveSourcePage = {
  internal_tags: string[];
  topic_cluster: string | null;
  campaign_label: string | null;
  funnel_stage: string | null;
  review_period_months: number | null;
  next_review_at: string | null;
  lifecycle_status: string | null;
  og_title: string | null;
  og_description: string | null;
};

export type SeoPageAutosavePayloadInput = {
  formData: FormData | null;
  page?: SeoPageAutosaveSourcePage;
  title: string;
  slug: string;
  routePrefix: string;
  targetKeyword: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  noindex: boolean;
  sitemapEnabled: boolean;
  structuredDataBreadcrumb: boolean;
  structuredDataFaq: boolean;
  pageType: string;
  templateKey: string;
  content: PageContent;
};

export function buildSeoPageAutosavePayload({
  formData,
  page,
  title,
  slug,
  routePrefix,
  targetKeyword,
  seoTitle,
  metaDescription,
  canonicalUrl,
  noindex,
  sitemapEnabled,
  structuredDataBreadcrumb,
  structuredDataFaq,
  pageType,
  templateKey,
  content,
}: SeoPageAutosavePayloadInput): PageAutosavePayload {
  const formValue = (name: string, fallback = "") =>
    String(formData?.get(name) ?? fallback);

  // Scheduler columns are owned by explicit saves only. Autosave submits the
  // BASELINE value for scheduledPublishAt (and never cancels), so the server's
  // scheduledPublishMetadataFromPageForm sees value === baseline and treats the
  // schedule as unchanged — a half-typed schedule field can never be armed or
  // cancelled by a background save.
  const scheduledPublishAtBaseline = formValue("scheduledPublishAtBaseline");

  return {
    title,
    slug,
    routePrefix,
    targetKeyword,
    seoTitle,
    metaDescription,
    canonicalUrl,
    internalTags: formValue("internalTags", page?.internal_tags.join(", ")),
    topicCluster: formValue("topicCluster", page?.topic_cluster ?? ""),
    campaignLabel: formValue("campaignLabel", page?.campaign_label ?? ""),
    funnelStage: formValue("funnelStage", page?.funnel_stage ?? ""),
    reviewPeriodMonths: Number(
      formValue("reviewPeriodMonths", String(page?.review_period_months ?? 6)),
    ),
    nextReviewAt: formValue("nextReviewAt", page?.next_review_at ?? ""),
    lifecycleStatus: formValue(
      "lifecycleStatus",
      page?.lifecycle_status ?? "drafting",
    ),
    ogTitle: formValue("ogTitle", page?.og_title ?? ""),
    ogDescription: formValue("ogDescription", page?.og_description ?? ""),
    scheduledPublishAt: scheduledPublishAtBaseline,
    scheduledPublishAtBaseline,
    cancelScheduledPublish: false,
    noindex,
    sitemapEnabled,
    structuredDataSettings: {
      breadcrumb: structuredDataBreadcrumb,
      faq: structuredDataFaq,
    },
    pageType,
    templateKey,
    draftContent: content,
  };
}
