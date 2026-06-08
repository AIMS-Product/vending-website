import { describe, expect, it } from "vitest";
import { buildSeoPageAutosavePayload } from "./editor-autosave-payload";
import type { PageContent } from "@/lib/page-builder/blocks";

const content: PageContent = {
  version: 1,
  sections: [],
};

const baseInput = {
  title: "Campus Vending",
  slug: "campus-vending",
  routePrefix: "/resources",
  targetKeyword: "campus vending",
  seoTitle: "Campus Vending Services",
  metaDescription: "A useful vending page.",
  canonicalUrl: "",
  noindex: false,
  sitemapEnabled: true,
  structuredDataBreadcrumb: true,
  structuredDataFaq: false,
  pageType: "resource",
  templateKey: "blank",
  content,
};

describe("buildSeoPageAutosavePayload", () => {
  it("uses uncontrolled form metadata when present", () => {
    const formData = new FormData();
    formData.set("internalTags", "review, priority");
    formData.set("topicCluster", "Campus operations");
    formData.set("campaignLabel", "FY26");
    formData.set("funnelStage", "consideration");
    formData.set("reviewPeriodMonths", "12");
    formData.set("nextReviewAt", "2026-08-15T00:00:00.000Z");
    formData.set("lifecycleStatus", "needs_review");
    formData.set("ogTitle", "Campus social title");
    formData.set("ogDescription", "Campus social description.");
    formData.set("scheduledPublishAt", "2026-06-10T09:30");
    formData.set("cancelScheduledPublish", "on");

    const payload = buildSeoPageAutosavePayload({
      ...baseInput,
      formData,
    });

    expect(payload).toMatchObject({
      internalTags: "review, priority",
      topicCluster: "Campus operations",
      campaignLabel: "FY26",
      funnelStage: "consideration",
      reviewPeriodMonths: 12,
      nextReviewAt: "2026-08-15T00:00:00.000Z",
      lifecycleStatus: "needs_review",
      ogTitle: "Campus social title",
      ogDescription: "Campus social description.",
      scheduledPublishAt: "2026-06-10T09:30",
      cancelScheduledPublish: true,
      structuredDataSettings: { breadcrumb: true, faq: false },
      draftContent: content,
    });
  });

  it("falls back to loaded page metadata when form data is unavailable", () => {
    const payload = buildSeoPageAutosavePayload({
      ...baseInput,
      formData: null,
      page: {
        internal_tags: ["launch", "priority"],
        topic_cluster: "Vending startups",
        campaign_label: "FY25",
        funnel_stage: "awareness",
        review_period_months: 6,
        next_review_at: null,
        lifecycle_status: "drafting",
        og_title: null,
        og_description: "Existing social description.",
      },
    });

    expect(payload).toMatchObject({
      internalTags: "launch, priority",
      topicCluster: "Vending startups",
      campaignLabel: "FY25",
      funnelStage: "awareness",
      reviewPeriodMonths: 6,
      nextReviewAt: "",
      lifecycleStatus: "drafting",
      ogTitle: "",
      ogDescription: "Existing social description.",
      scheduledPublishAt: "",
      cancelScheduledPublish: false,
    });
  });
});
