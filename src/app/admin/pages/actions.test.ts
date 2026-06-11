import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageContent } from "@/lib/page-builder/blocks";
import {
  acceptAiSeoProposalBlocks,
  archiveSeoPageFromList,
  bulkArchiveSeoPagesFromList,
  createSeoPageComment,
  createSeoPageDraftForEditor,
  deleteNeverSavedSeoPageDraft,
  duplicateSeoPageFromList,
  generateAiSeoPageProposal,
  moveSeoPageToDraftFromList,
  autosaveSeoPageDraft,
  saveSeoPage,
  saveSeoPageDraftAndCreatePreviewLink,
  publishSeoPageFromList,
} from "./actions";
import { SeoAgentConfigurationError } from "@/lib/services/openai-seo-agent";
import { AiProposalValidationError } from "@/lib/services/ai-page-proposals";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  adminDeleteNeverSavedSeoPageDraft: vi.fn(),
  adminGenerateOpenAiSeoPageProposal: vi.fn(),
  adminAcceptAiProposalBlocks: vi.fn(),
  adminArchiveSeoPage: vi.fn(),
  adminCreateSeoPagePreviewToken: vi.fn(),
  adminCreatePageComment: vi.fn(),
  adminCreateSeoPage: vi.fn(),
  adminDuplicateSeoPage: vi.fn(),
  adminGetSeoPageById: vi.fn(),
  adminPublishSeoPage: vi.fn(),
  adminRefreshSeoPageLibraryReferences: vi.fn(),
  adminRevokeSeoPagePreviewToken: vi.fn(),
  adminRollbackSeoPageRevision: vi.fn(),
  adminSaveSeoPageDraft: vi.fn(),
  adminSnapshotManualSaveRevision: vi.fn(),
  adminUnpublishSeoPage: vi.fn(),
  adminUpdateSeoPageSlug: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/services/openai-seo-agent", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/openai-seo-agent")
  >("@/lib/services/openai-seo-agent");
  return {
    ...actual,
    adminGenerateOpenAiSeoPageProposal:
      mocks.adminGenerateOpenAiSeoPageProposal,
  };
});

vi.mock("@/lib/services/seo-page-drafts", () => ({
  adminDeleteNeverSavedSeoPageDraft: mocks.adminDeleteNeverSavedSeoPageDraft,
}));

vi.mock("@/lib/services/ai-page-proposals", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/ai-page-proposals")
  >("@/lib/services/ai-page-proposals");
  return {
    ...actual,
    adminAcceptAiProposalBlocks: mocks.adminAcceptAiProposalBlocks,
  };
});

vi.mock("@/lib/services/seo-pages", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/seo-pages")
  >("@/lib/services/seo-pages");
  return {
    ...actual,
    adminArchiveSeoPage: mocks.adminArchiveSeoPage,
    adminCreatePageComment: mocks.adminCreatePageComment,
    adminCreateSeoPagePreviewToken: mocks.adminCreateSeoPagePreviewToken,
    adminCreateSeoPage: mocks.adminCreateSeoPage,
    adminDuplicateSeoPage: mocks.adminDuplicateSeoPage,
    adminGetSeoPageById: mocks.adminGetSeoPageById,
    adminPublishSeoPage: mocks.adminPublishSeoPage,
    adminRefreshSeoPageLibraryReferences:
      mocks.adminRefreshSeoPageLibraryReferences,
    adminRevokeSeoPagePreviewToken: mocks.adminRevokeSeoPagePreviewToken,
    adminRollbackSeoPageRevision: mocks.adminRollbackSeoPageRevision,
    adminSaveSeoPageDraft: mocks.adminSaveSeoPageDraft,
    adminSnapshotManualSaveRevision: mocks.adminSnapshotManualSaveRevision,
    adminUnpublishSeoPage: mocks.adminUnpublishSeoPage,
    adminUpdateSeoPageSlug: mocks.adminUpdateSeoPageSlug,
  };
});

const pageId = "11111111-1111-4111-8111-111111111111";
const proposalId = "22222222-2222-4222-8222-222222222222";
const validContent: PageContent = {
  version: 1,
  sections: [],
};

type PageFormOverrides = {
  id?: string;
  title?: string;
  slug?: string;
  routePrefix?: string;
  targetKeyword?: string;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  internalTags?: string;
  topicCluster?: string;
  campaignLabel?: string;
  funnelStage?: string;
  reviewPeriodMonths?: number;
  nextReviewAt?: string;
  lifecycleStatus?: string;
  ogTitle?: string;
  ogDescription?: string;
  noindex?: boolean;
  sitemapEnabled?: boolean;
  structuredDataBreadcrumb?: boolean;
  structuredDataFaq?: boolean;
  pageType?: string;
  templateKey?: string;
  draftContent?: PageContent;
  publishNote?: string;
  scheduledPublishAt?: string;
  scheduledPublishAtBaseline?: string;
  cancelScheduledPublish?: boolean;
  intent?: "save" | "publish";
  // Simulates a manual save submitted while the collapsible SEO panel is
  // closed: its uncontrolled governance inputs unmount, so none of them are
  // present in the FormData.
  omitGovernanceFields?: boolean;
};

// Same names in the FormData and in the service patch.
const GOVERNANCE_FIELDS = [
  "internalTags",
  "topicCluster",
  "campaignLabel",
  "funnelStage",
  "reviewPeriodMonths",
  "nextReviewAt",
  "lifecycleStatus",
  "ogTitle",
  "ogDescription",
] as const;

function pageForm(overrides: PageFormOverrides = {}) {
  const values = {
    title: "Coffee Vending Adelaide",
    slug: "coffee-vending-adelaide",
    routePrefix: "/resources",
    targetKeyword: "coffee vending",
    seoTitle: "Coffee vending machines",
    metaDescription: "Coffee vending machines for Adelaide workplaces.",
    canonicalUrl: "",
    internalTags: "",
    topicCluster: "",
    campaignLabel: "",
    funnelStage: "",
    reviewPeriodMonths: 6,
    nextReviewAt: "",
    lifecycleStatus: "drafting",
    ogTitle: "",
    ogDescription: "",
    noindex: false,
    sitemapEnabled: true,
    structuredDataBreadcrumb: true,
    structuredDataFaq: false,
    pageType: "resource",
    templateKey: "blank",
    draftContent: validContent,
    publishNote: "",
    scheduledPublishAt: "",
    scheduledPublishAtBaseline: "",
    cancelScheduledPublish: false,
    intent: "save" as const,
    ...overrides,
  };
  const formData = new FormData();
  if (values.id) formData.set("id", values.id);
  formData.set("title", values.title);
  formData.set("slug", values.slug);
  formData.set("routePrefix", values.routePrefix);
  formData.set("targetKeyword", values.targetKeyword);
  formData.set("seoTitle", values.seoTitle);
  formData.set("metaDescription", values.metaDescription);
  formData.set("canonicalUrl", values.canonicalUrl);
  formData.set("internalTags", values.internalTags);
  formData.set("topicCluster", values.topicCluster);
  formData.set("campaignLabel", values.campaignLabel);
  formData.set("funnelStage", values.funnelStage);
  formData.set("reviewPeriodMonths", String(values.reviewPeriodMonths));
  formData.set("nextReviewAt", values.nextReviewAt);
  formData.set("lifecycleStatus", values.lifecycleStatus);
  formData.set("ogTitle", values.ogTitle);
  formData.set("ogDescription", values.ogDescription);
  if (values.noindex) formData.set("noindex", "on");
  if (values.sitemapEnabled) formData.set("sitemapEnabled", "on");
  if (values.structuredDataBreadcrumb) {
    formData.set("structuredDataBreadcrumb", "on");
  }
  if (values.structuredDataFaq) formData.set("structuredDataFaq", "on");
  formData.set("pageType", values.pageType);
  formData.set("templateKey", values.templateKey);
  formData.set("draftContent", JSON.stringify(values.draftContent));
  formData.set("publishNote", values.publishNote);
  if (values.scheduledPublishAt) {
    formData.set("scheduledPublishAt", values.scheduledPublishAt);
  }
  if (values.scheduledPublishAtBaseline) {
    formData.set(
      "scheduledPublishAtBaseline",
      values.scheduledPublishAtBaseline,
    );
  }
  if (values.cancelScheduledPublish) {
    formData.set("cancelScheduledPublish", "on");
  }
  formData.set("intent", values.intent);
  return formData;
}

describe("admin page actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin_1" } });
  });

  it("creates a new page, saves settings, revalidates public paths, and redirects", async () => {
    mocks.adminCreateSeoPage.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
    });

    await saveSeoPage({ status: "idle" }, pageForm());

    expect(mocks.adminCreateSeoPage).toHaveBeenCalledWith({
      slug: "coffee-vending-adelaide",
      routePrefix: "/resources",
      title: "Coffee Vending Adelaide",
      targetKeyword: "coffee vending",
      pageType: "resource",
      templateKey: "blank",
      draftContent: validContent,
      createdBy: "admin_1",
    });
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        seoTitle: "Coffee vending machines",
        metaDescription: "Coffee vending machines for Adelaide workplaces.",
        canonicalUrl: null,
        noindex: false,
        sitemapEnabled: true,
        structuredDataSettings: { breadcrumb: true, faq: false },
        updatedBy: "admin_1",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pages");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/resources/coffee-vending-adelaide",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(mocks.redirect).toHaveBeenCalledWith(
      `/admin/pages/${pageId}?saved=1`,
    );
  });

  it("snapshots a manual_save revision when a new page is saved", async () => {
    mocks.adminCreateSeoPage.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
    });

    await saveSeoPage({ status: "idle" }, pageForm());

    expect(mocks.adminSnapshotManualSaveRevision).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({ actorId: "admin_1" }),
    );
  });

  it("snapshots a manual_save revision when an existing draft is saved", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
      route_prefix: "/resources",
      route_path: "/resources/coffee-vending-adelaide",
      status: "draft",
    });

    await saveSeoPage({ status: "idle" }, pageForm({ id: pageId }));

    expect(mocks.adminSnapshotManualSaveRevision).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({ actorId: "admin_1" }),
    );
  });

  it("does NOT snapshot a manual_save revision on publish intent", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
      route_prefix: "/resources",
      route_path: "/resources/coffee-vending-adelaide",
      status: "draft",
    });
    mocks.adminPublishSeoPage.mockResolvedValue({
      page: { id: pageId },
      revision: { id: "rev_pub" },
    });

    await saveSeoPage(
      { status: "idle" },
      pageForm({ id: pageId, intent: "publish" }),
    );

    expect(mocks.adminPublishSeoPage).toHaveBeenCalled();
    expect(mocks.adminSnapshotManualSaveRevision).not.toHaveBeenCalled();
  });

  it("does NOT snapshot a manual_save revision on autosave", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
      status: "draft",
    });

    await autosaveSeoPageDraft(pageId, {
      title: "Coffee Vending Adelaide",
      slug: "coffee-vending-adelaide",
      routePrefix: "/resources",
      targetKeyword: "coffee vending",
      seoTitle: "Coffee vending machines",
      metaDescription: "Coffee vending machines for Adelaide workplaces.",
      canonicalUrl: "",
      internalTags: "",
      topicCluster: "",
      campaignLabel: "",
      funnelStage: "",
      reviewPeriodMonths: 6,
      nextReviewAt: "",
      lifecycleStatus: "drafting",
      ogTitle: "",
      ogDescription: "",
      scheduledPublishAt: "",
      scheduledPublishAtBaseline: "",
      cancelScheduledPublish: false,
      noindex: false,
      sitemapEnabled: true,
      pageType: "resource",
      templateKey: "blank",
      structuredDataSettings: { breadcrumb: true, faq: false },
      draftContent: validContent,
    });

    expect(mocks.adminSnapshotManualSaveRevision).not.toHaveBeenCalled();
  });

  it("still reports the save as successful when the snapshot fails", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
      route_prefix: "/resources",
      route_path: "/resources/coffee-vending-adelaide",
      status: "draft",
    });
    mocks.adminSnapshotManualSaveRevision.mockRejectedValue(
      new Error("snapshot boom"),
    );

    const result = await saveSeoPage(
      { status: "idle" },
      pageForm({ id: pageId }),
    );

    expect(result.status).toBe("saved");
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalled();
  });

  it("auto-creates a new editor draft with AI-generated SEO fields", async () => {
    mocks.adminCreateSeoPage.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
    });

    const result = await createSeoPageDraftForEditor({
      title: "Coffee Vending Adelaide",
      slug: "coffee-vending-adelaide",
      targetKeyword: "coffee vending adelaide",
      seoTitle: "Coffee Vending Adelaide",
      metaDescription: "Compare coffee vending machines for Adelaide offices.",
      routePrefix: "/blog",
      pageType: "blog",
      templateKey: "blog-standard",
      draftContent: validContent,
    });

    expect(result).toEqual({ status: "created", pageId });
    expect(mocks.adminCreateSeoPage).toHaveBeenCalledWith({
      slug: "coffee-vending-adelaide",
      routePrefix: "/blog",
      title: "Coffee Vending Adelaide",
      targetKeyword: "coffee vending adelaide",
      seoTitle: "Coffee Vending Adelaide",
      metaDescription: "Compare coffee vending machines for Adelaide offices.",
      pageType: "blog",
      templateKey: "blog-standard",
      draftContent: validContent,
      createdBy: "admin_1",
    });
  });

  it("stores published page edits as draft content and draft settings", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "old-coffee-vending",
      status: "published",
    });

    const result = await saveSeoPage(
      { status: "idle" },
      pageForm({
        id: pageId,
        slug: "new-coffee-vending",
        internalTags: "Revenue, Compliance",
        topicCluster: "Workplace coffee",
        campaignLabel: "FY26 expansion",
        funnelStage: "consideration",
        reviewPeriodMonths: 12,
        nextReviewAt: "2026-07-15",
        lifecycleStatus: "needs_review",
        ogTitle: "Coffee vending for workplaces",
        ogDescription: "Compare managed coffee vending options.",
      }),
    );

    expect(result).toEqual({ status: "saved", message: "Draft saved." });
    expect(mocks.adminUpdateSeoPageSlug).not.toHaveBeenCalled();
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        draftContent: validContent,
        draftSettings: {
          slug: "new-coffee-vending",
          routePrefix: "/resources",
          routePath: "/resources/new-coffee-vending",
          title: "Coffee Vending Adelaide",
          targetKeyword: "coffee vending",
          seoTitle: "Coffee vending machines",
          metaDescription: "Coffee vending machines for Adelaide workplaces.",
          canonicalUrl: null,
          noindex: false,
          sitemapEnabled: true,
          structuredDataSettings: { breadcrumb: true, faq: false },
        },
        internalTags: ["revenue", "compliance"],
        topicCluster: "Workplace coffee",
        campaignLabel: "FY26 expansion",
        funnelStage: "consideration",
        reviewPeriodMonths: 12,
        nextReviewAt: "2026-07-15T00:00:00.000Z",
        lifecycleStatus: "needs_review",
        ogTitle: "Coffee vending for workplaces",
        ogDescription: "Compare managed coffee vending options.",
        updatedBy: "admin_1",
      }),
    );
    expect(mocks.adminPublishSeoPage).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/pages/${pageId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pages");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(
      "/resources/new-coffee-vending",
    );
  });

  it("publishes after persisting published page draft settings and revalidates old and new slugs", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "old-coffee-vending",
      route_path: "/resources/old-coffee-vending",
      status: "published",
    });

    const result = await saveSeoPage(
      { status: "idle" },
      pageForm({
        id: pageId,
        slug: "new-coffee-vending",
        intent: "publish",
        publishNote: "Ready for launch",
      }),
    );

    expect(result).toEqual({ status: "saved", message: "Page published." });
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        draftContent: validContent,
        draftSettings: expect.objectContaining({
          slug: "new-coffee-vending",
        }),
      }),
    );
    expect(mocks.adminPublishSeoPage).toHaveBeenCalledWith(pageId, {
      actorId: "admin_1",
      publishNote: "Ready for launch",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/resources/new-coffee-vending",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/resources/old-coffee-vending",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });

  it("updates an unpublished page through canonical draft fields and revalidates old and new slugs", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "old-coffee-vending",
      route_prefix: "/resources",
      route_path: "/resources/old-coffee-vending",
      status: "draft",
    });

    const result = await saveSeoPage(
      { status: "idle" },
      pageForm({ id: pageId, slug: "new-coffee-vending" }),
    );

    expect(result).toEqual({ status: "saved", message: "Draft saved." });
    expect(mocks.adminUpdateSeoPageSlug).toHaveBeenCalledWith(
      pageId,
      "new-coffee-vending",
      { actorId: "admin_1", routePrefix: "/resources" },
    );
    const draftPayload = mocks.adminSaveSeoPageDraft.mock.calls[0]?.[1];
    expect(draftPayload).toMatchObject({
      title: "Coffee Vending Adelaide",
      slug: "new-coffee-vending",
      routePrefix: "/resources",
      targetKeyword: "coffee vending",
      seoTitle: "Coffee vending machines",
      metaDescription: "Coffee vending machines for Adelaide workplaces.",
      canonicalUrl: null,
      noindex: false,
      sitemapEnabled: true,
      structuredDataSettings: { breadcrumb: true, faq: false },
      internalTags: [],
      topicCluster: null,
      campaignLabel: null,
      funnelStage: null,
      reviewPeriodMonths: 6,
      nextReviewAt: null,
      lifecycleStatus: "drafting",
      ogTitle: null,
      ogDescription: null,
      draftContent: validContent,
      updatedBy: "admin_1",
    });
    expect(draftPayload).not.toHaveProperty("draftSettings");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/resources/new-coffee-vending",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/resources/old-coffee-vending",
    );
  });

  it("saves scheduled publish metadata as UTC from Pacific Time input", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
      route_prefix: "/resources",
      route_path: "/resources/coffee-vending-adelaide",
      status: "draft",
    });

    const result = await saveSeoPage(
      { status: "idle" },
      pageForm({ id: pageId, scheduledPublishAt: "2026-06-03T09:30" }),
    );

    expect(result).toEqual({ status: "saved", message: "Draft saved." });
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        scheduledPublishAt: "2026-06-03T16:30:00.000Z",
        scheduledPublishStatus: "scheduled",
        scheduledPublishError: null,
        scheduledPublishAttempts: 0,
        scheduledPublishLastAttemptAt: null,
        scheduledPublishLockedAt: null,
      }),
    );
  });

  it("saves scheduled updates for already-published pages without publishing immediately", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "old-coffee-vending",
      route_path: "/resources/old-coffee-vending",
      status: "published",
    });

    const result = await saveSeoPage(
      { status: "idle" },
      pageForm({
        id: pageId,
        slug: "new-coffee-vending",
        scheduledPublishAt: "2026-06-03T09:30",
      }),
    );

    expect(result).toEqual({ status: "saved", message: "Draft saved." });
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        draftContent: validContent,
        draftSettings: expect.objectContaining({
          slug: "new-coffee-vending",
        }),
        scheduledPublishAt: "2026-06-03T16:30:00.000Z",
        scheduledPublishStatus: "scheduled",
        scheduledPublishError: null,
        scheduledPublishAttempts: 0,
        scheduledPublishLastAttemptAt: null,
        scheduledPublishLockedAt: null,
      }),
    );
    expect(mocks.adminPublishSeoPage).not.toHaveBeenCalled();
  });

  it("cancels a scheduled publish explicitly without needing a raw status field", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
      route_prefix: "/resources",
      route_path: "/resources/coffee-vending-adelaide",
      status: "draft",
    });

    const result = await saveSeoPage(
      { status: "idle" },
      pageForm({ id: pageId, cancelScheduledPublish: true }),
    );

    expect(result).toEqual({ status: "saved", message: "Draft saved." });
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        scheduledPublishAt: null,
        scheduledPublishStatus: "cancelled",
        scheduledPublishError: null,
        scheduledPublishAttempts: 0,
        scheduledPublishLastAttemptAt: null,
        scheduledPublishLockedAt: null,
      }),
    );
  });

  it("leaves scheduler state untouched when the schedule field is unchanged", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
      route_prefix: "/resources",
      route_path: "/resources/coffee-vending-adelaide",
      status: "draft",
    });

    const result = await saveSeoPage(
      { status: "idle" },
      pageForm({
        id: pageId,
        scheduledPublishAt: "2026-06-03T09:30",
        scheduledPublishAtBaseline: "2026-06-03T09:30",
      }),
    );

    expect(result).toEqual({ status: "saved", message: "Draft saved." });
    const patch = mocks.adminSaveSeoPageDraft.mock.calls[0][1];
    expect(patch).not.toHaveProperty("scheduledPublishAt");
    expect(patch).not.toHaveProperty("scheduledPublishStatus");
    expect(patch).not.toHaveProperty("scheduledPublishAttempts");
    expect(patch).not.toHaveProperty("scheduledPublishLockedAt");
  });

  it("cancels the schedule when the user clears the schedule field", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
      route_prefix: "/resources",
      route_path: "/resources/coffee-vending-adelaide",
      status: "draft",
    });

    const result = await saveSeoPage(
      { status: "idle" },
      pageForm({
        id: pageId,
        scheduledPublishAt: "",
        scheduledPublishAtBaseline: "2026-06-03T09:30",
      }),
    );

    expect(result).toEqual({ status: "saved", message: "Draft saved." });
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        scheduledPublishAt: null,
        scheduledPublishStatus: "cancelled",
        scheduledPublishLockedAt: null,
      }),
    );
  });

  it("rejects schedule times that do not exist in Pacific Time instead of silently dropping them", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
      route_prefix: "/resources",
      route_path: "/resources/coffee-vending-adelaide",
      status: "draft",
    });

    // 2:30 AM on 8 March 2026 is inside the PT spring-forward gap.
    const result = await saveSeoPage(
      { status: "idle" },
      pageForm({ id: pageId, scheduledPublishAt: "2026-03-08T02:30" }),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("Pacific Time");
    expect(mocks.adminSaveSeoPageDraft).not.toHaveBeenCalled();
  });

  it("autosave with an unchanged schedule field never resets the runner lock", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
      status: "published",
    });

    const result = await autosaveSeoPageDraft(pageId, {
      title: "Coffee Vending Adelaide",
      slug: "coffee-vending-adelaide",
      routePrefix: "/resources",
      targetKeyword: "coffee vending",
      seoTitle: "Coffee vending machines",
      metaDescription: "Coffee vending machines for Adelaide workplaces.",
      canonicalUrl: "",
      internalTags: "",
      topicCluster: "",
      campaignLabel: "",
      funnelStage: "",
      reviewPeriodMonths: 6,
      nextReviewAt: "",
      lifecycleStatus: "drafting",
      ogTitle: "",
      ogDescription: "",
      scheduledPublishAt: "2026-06-03T09:30",
      scheduledPublishAtBaseline: "2026-06-03T09:30",
      cancelScheduledPublish: false,
      noindex: false,
      sitemapEnabled: true,
      pageType: "resource",
      templateKey: "blank",
      structuredDataSettings: { breadcrumb: true, faq: false },
      draftContent: validContent,
    });

    expect(result.status).toBe("saved");
    const patch = mocks.adminSaveSeoPageDraft.mock.calls[0][1];
    expect(patch).not.toHaveProperty("scheduledPublishStatus");
    expect(patch).not.toHaveProperty("scheduledPublishAttempts");
    expect(patch).not.toHaveProperty("scheduledPublishLockedAt");
  });

  it("autosaves unpublished page slug changes before preview creation", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "old-coffee-vending",
      status: "draft",
    });

    const result = await autosaveSeoPageDraft(pageId, {
      title: "Coffee Vending Adelaide",
      slug: "new-coffee-vending",
      routePrefix: "/resources",
      targetKeyword: "coffee vending",
      seoTitle: "Coffee vending machines",
      metaDescription: "Coffee vending machines for Adelaide workplaces.",
      canonicalUrl: "",
      internalTags: "Revenue, Compliance",
      topicCluster: "Office vending",
      campaignLabel: "FY26",
      funnelStage: "consideration",
      reviewPeriodMonths: 12,
      nextReviewAt: "2026-07-15",
      lifecycleStatus: "needs_review",
      ogTitle: "Coffee vending social",
      ogDescription: "Coffee vending social description.",
      scheduledPublishAt: "2026-06-03T09:30",
      scheduledPublishAtBaseline: "",
      cancelScheduledPublish: false,
      noindex: false,
      sitemapEnabled: true,
      pageType: "resource",
      templateKey: "blank",
      structuredDataSettings: { breadcrumb: true, faq: false },
      draftContent: validContent,
    });

    expect(result.status).toBe("saved");
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        slug: "new-coffee-vending",
        routePrefix: "/resources",
        title: "Coffee Vending Adelaide",
        targetKeyword: "coffee vending",
        seoTitle: "Coffee vending machines",
        metaDescription: "Coffee vending machines for Adelaide workplaces.",
        canonicalUrl: null,
        internalTags: ["revenue", "compliance"],
        topicCluster: "Office vending",
        campaignLabel: "FY26",
        funnelStage: "consideration",
        reviewPeriodMonths: 12,
        nextReviewAt: "2026-07-15T00:00:00.000Z",
        lifecycleStatus: "needs_review",
        ogTitle: "Coffee vending social",
        ogDescription: "Coffee vending social description.",
        scheduledPublishAt: "2026-06-03T16:30:00.000Z",
        scheduledPublishStatus: "scheduled",
        scheduledPublishError: null,
        scheduledPublishAttempts: 0,
        scheduledPublishLastAttemptAt: null,
        scheduledPublishLockedAt: null,
        noindex: false,
        sitemapEnabled: true,
        structuredDataSettings: { breadcrumb: true, faq: false },
        draftContent: validContent,
        updatedBy: "admin_1",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/pages/${pageId}`);
  });

  it("saves a new page before creating a preview link", async () => {
    mocks.adminCreateSeoPage.mockResolvedValue({
      id: pageId,
      slug: "coffee-vending-adelaide",
    });
    mocks.adminCreateSeoPagePreviewToken.mockResolvedValue({
      previewPath: "/resources/coffee-vending-adelaide?preview=token",
    });

    const result = await saveSeoPageDraftAndCreatePreviewLink(
      { status: "idle" },
      pageForm(),
    );

    expect(result).toEqual({
      status: "created",
      message: "Draft saved and preview opened.",
      previewPath: "/resources/coffee-vending-adelaide?preview=token",
      pageId,
      editorPath: `/admin/pages/${pageId}?saved=1`,
    });
    expect(mocks.adminCreateSeoPage).toHaveBeenCalled();
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        seoTitle: "Coffee vending machines",
        updatedBy: "admin_1",
      }),
    );
    expect(mocks.adminCreateSeoPagePreviewToken).toHaveBeenCalledWith(pageId, {
      actorId: "admin_1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/resources/coffee-vending-adelaide",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/pages/${pageId}`);
  });

  it("saves published page preview changes into draft settings without public revalidation", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "old-coffee-vending",
      status: "published",
    });
    mocks.adminCreateSeoPagePreviewToken.mockResolvedValue({
      previewPath: "/resources/new-coffee-vending?preview=token",
    });

    const result = await saveSeoPageDraftAndCreatePreviewLink(
      { status: "idle" },
      pageForm({ id: pageId, slug: "new-coffee-vending" }),
    );

    expect(result).toEqual({
      status: "created",
      message: "Preview link created.",
      previewPath: "/resources/new-coffee-vending?preview=token",
      pageId,
      editorPath: `/admin/pages/${pageId}?saved=1`,
    });
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        draftContent: validContent,
        draftSettings: expect.objectContaining({
          slug: "new-coffee-vending",
          title: "Coffee Vending Adelaide",
        }),
        internalTags: [],
        lifecycleStatus: "drafting",
        updatedBy: "admin_1",
      }),
    );
    expect(mocks.adminCreateSeoPagePreviewToken).toHaveBeenCalledWith(pageId, {
      actorId: "admin_1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/pages/${pageId}`);
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(
      "/resources/new-coffee-vending",
    );
  });

  it("duplicates a page from the list and opens the copied draft", async () => {
    const formData = new FormData();
    formData.set("id", pageId);
    mocks.adminDuplicateSeoPage.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      route_path: "/resources/draft-abcd1234",
    });

    await duplicateSeoPageFromList(formData);

    expect(mocks.adminDuplicateSeoPage).toHaveBeenCalledWith(pageId, {
      actorId: "admin_1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pages");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/pages/33333333-3333-4333-8333-333333333333?saved=1",
    );
  });

  it("archives a page from the list and returns to the preserved list view", async () => {
    const formData = new FormData();
    formData.set("id", pageId);
    formData.set(
      "returnTo",
      "/admin/pages?view=metadata-issues&sort=title-asc",
    );
    mocks.adminArchiveSeoPage.mockResolvedValue({
      id: pageId,
      route_path: "/resources/vending-in-colleges",
    });

    await archiveSeoPageFromList(formData);

    expect(mocks.adminArchiveSeoPage).toHaveBeenCalledWith(pageId, {
      actorId: "admin_1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pages");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/resources/vending-in-colleges",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/pages?view=metadata-issues&sort=title-asc",
    );
  });

  it("redirects failed archive-from-list attempts to the page error state", async () => {
    const formData = new FormData();
    formData.set("id", pageId);
    formData.set(
      "returnTo",
      "/admin/pages?view=metadata-issues&sort=title-asc",
    );
    mocks.adminArchiveSeoPage.mockRejectedValue(new Error("rpc failed"));

    await archiveSeoPageFromList(formData);

    expect(mocks.adminArchiveSeoPage).toHaveBeenCalledWith(pageId, {
      actorId: "admin_1",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/admin/pages");
    expect(mocks.redirect).toHaveBeenCalledWith(
      `/admin/pages/${pageId}?error=archive`,
    );
  });

  it("bulk-archives every selected page and returns to the preserved list view", async () => {
    const secondId = "44444444-4444-4444-8444-444444444444";
    const formData = new FormData();
    formData.append("ids", pageId);
    formData.append("ids", secondId);
    formData.set("returnTo", "/admin/pages?view=metadata-issues");
    mocks.adminArchiveSeoPage.mockResolvedValue({
      id: pageId,
      route_path: "/resources/x",
    });

    await bulkArchiveSeoPagesFromList(formData);

    expect(mocks.adminArchiveSeoPage).toHaveBeenCalledWith(pageId, {
      actorId: "admin_1",
    });
    expect(mocks.adminArchiveSeoPage).toHaveBeenCalledWith(secondId, {
      actorId: "admin_1",
    });
    // The result redirect carries an explicit archived count for the banner.
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/pages?view=metadata-issues&archived=2",
    );
  });

  it("dedupes ids and reports partial failures in the result redirect", async () => {
    const failingId = "44444444-4444-4444-8444-444444444444";
    const formData = new FormData();
    formData.append("ids", pageId);
    formData.append("ids", pageId); // duplicate — must archive once
    formData.append("ids", failingId);
    formData.set("returnTo", "/admin/pages");
    mocks.adminArchiveSeoPage.mockImplementation((id: string) => {
      if (id === failingId) return Promise.reject(new Error("rpc failed"));
      return Promise.resolve({ id, route_path: "/resources/x" });
    });

    await bulkArchiveSeoPagesFromList(formData);

    expect(mocks.adminArchiveSeoPage).toHaveBeenCalledTimes(2);
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/pages?archived=1&failed=1",
    );
  });

  it("ignores invalid ids and errors when no valid id is selected", async () => {
    const formData = new FormData();
    formData.append("ids", "../settings");
    formData.append("ids", "not-a-uuid");

    await bulkArchiveSeoPagesFromList(formData);

    expect(mocks.adminArchiveSeoPage).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/pages?error=bulk-archive",
    );
  });

  it("publishes a page from the list and revalidates the public path", async () => {
    const formData = new FormData();
    formData.set("id", pageId);
    mocks.adminPublishSeoPage.mockResolvedValue({
      page: {
        id: pageId,
        route_path: "/resources/vending-in-colleges",
      },
    });

    await publishSeoPageFromList(formData);

    expect(mocks.adminPublishSeoPage).toHaveBeenCalledWith(pageId, {
      actorId: "admin_1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pages");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/resources/vending-in-colleges",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/pages");
  });

  it("moves a page to draft from the list and revalidates the public path", async () => {
    const formData = new FormData();
    formData.set("id", pageId);
    mocks.adminUnpublishSeoPage.mockResolvedValue({
      id: pageId,
      route_path: "/resources/vending-in-colleges",
    });

    await moveSeoPageToDraftFromList(formData);

    expect(mocks.adminUnpublishSeoPage).toHaveBeenCalledWith(pageId, {
      actorId: "admin_1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pages");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/resources/vending-in-colleges",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/pages");
  });

  it("creates page comments and revalidates the editor on success", async () => {
    const formData = new FormData();
    formData.set("pageId", pageId);
    formData.set("blockId", "block_intro");
    formData.set("body", "Check this proof point.");

    await createSeoPageComment(formData);

    expect(mocks.adminCreatePageComment).toHaveBeenCalledWith({
      pageId,
      blockId: "block_intro",
      body: "Check this proof point.",
      createdBy: "admin_1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/pages/${pageId}`);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects invalid comment page IDs without calling the comment service", async () => {
    const formData = new FormData();
    formData.set("pageId", "../settings");
    formData.set("body", "Check this proof point.");

    await createSeoPageComment(formData);

    expect(mocks.adminCreatePageComment).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/pages");
  });

  it("redirects failed comment creation back to the editor with visible error state", async () => {
    const formData = new FormData();
    formData.set("pageId", pageId);
    formData.set("blockId", "block_intro");
    formData.set("body", "Check this proof point.");
    mocks.adminCreatePageComment.mockRejectedValue(new Error("insert failed"));

    await createSeoPageComment(formData);

    expect(mocks.adminCreatePageComment).toHaveBeenCalledWith({
      pageId,
      blockId: "block_intro",
      body: "Check this proof point.",
      createdBy: "admin_1",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(
      `/admin/pages/${pageId}`,
    );
    expect(mocks.redirect).toHaveBeenCalledWith(
      `/admin/pages/${pageId}?error=comment`,
    );
  });

  it("maps missing page IDs without calling the AI proposal service", async () => {
    const result = await generateAiSeoPageProposal("");

    expect(result).toEqual({
      status: "error",
      message: "Save the page before running AI.",
    });
    expect(mocks.adminGenerateOpenAiSeoPageProposal).not.toHaveBeenCalled();
  });

  it("maps OpenAI configuration errors to a safe admin-facing message", async () => {
    mocks.adminGenerateOpenAiSeoPageProposal.mockRejectedValue(
      new SeoAgentConfigurationError("sk-secret is missing"),
    );

    const result = await generateAiSeoPageProposal(pageId);

    expect(result).toEqual({
      status: "error",
      message: "OpenAI is not configured for the SEO agent.",
    });
    expect(JSON.stringify(result)).not.toContain("sk-secret");
    expect(mocks.adminGenerateOpenAiSeoPageProposal).toHaveBeenCalledWith(
      pageId,
      { actorId: "admin_1" },
    );
  });

  it("creates an AI proposal for review", async () => {
    mocks.adminGenerateOpenAiSeoPageProposal.mockResolvedValue({
      id: proposalId,
    });

    const result = await generateAiSeoPageProposal(pageId);

    expect(result).toEqual({
      status: "created",
      message: "AI proposal created for review.",
      proposalId,
    });
    expect(mocks.adminGenerateOpenAiSeoPageProposal).toHaveBeenCalledWith(
      pageId,
      { actorId: "admin_1" },
    );
  });

  it("rejects invalid proposal insert payloads before calling the service", async () => {
    const result = await acceptAiSeoProposalBlocks("not-a-uuid", proposalId, [
      "block_ai",
    ]);

    expect(result.status).toBe("error");
    expect(result.proposalId).toBe(proposalId);
    expect(result.message).toMatch(/Invalid UUID/);
    expect(mocks.adminAcceptAiProposalBlocks).not.toHaveBeenCalled();
  });

  it("returns inserted AI blocks with parsed draft content", async () => {
    mocks.adminAcceptAiProposalBlocks.mockResolvedValue({
      page: { draft_content: validContent },
    });

    const result = await acceptAiSeoProposalBlocks(pageId, proposalId, [
      "block_ai",
    ]);

    expect(result).toEqual({
      status: "inserted",
      message: "1 AI block inserted into the draft.",
      proposalId,
      insertedBlockIds: ["block_ai"],
      content: validContent,
    });
    expect(mocks.adminAcceptAiProposalBlocks).toHaveBeenCalledWith(
      pageId,
      proposalId,
      ["block_ai"],
      { actorId: "admin_1" },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/pages/${pageId}`);
  });

  it("surfaces AI proposal validation errors without inserting blocks", async () => {
    mocks.adminAcceptAiProposalBlocks.mockRejectedValue(
      new AiProposalValidationError([
        {
          code: "missing_source",
          path: "blocks.0",
          message: "AI proposals can only use selected approved source data.",
        },
      ]),
    );

    const result = await acceptAiSeoProposalBlocks(pageId, proposalId, [
      "block_ai",
    ]);

    expect(result).toEqual({
      status: "error",
      proposalId,
      message: "AI proposals can only use selected approved source data.",
    });
  });

  it("discards a never-saved auto-draft and revalidates the pages list", async () => {
    mocks.adminDeleteNeverSavedSeoPageDraft.mockResolvedValue({
      status: "deleted",
    });

    const result = await deleteNeverSavedSeoPageDraft(pageId);

    expect(result).toEqual({ status: "deleted" });
    expect(mocks.adminDeleteNeverSavedSeoPageDraft).toHaveBeenCalledWith(
      pageId,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pages");
  });

  it("treats an already-gone draft as discarded so the user can leave", async () => {
    mocks.adminDeleteNeverSavedSeoPageDraft.mockResolvedValue({
      status: "not_found",
    });

    const result = await deleteNeverSavedSeoPageDraft(pageId);

    expect(result).toEqual({ status: "deleted" });
  });

  it("refuses to discard a page the server reports as already saved", async () => {
    mocks.adminDeleteNeverSavedSeoPageDraft.mockResolvedValue({
      status: "protected",
    });

    const result = await deleteNeverSavedSeoPageDraft(pageId);

    expect(result).toEqual({
      status: "error",
      message: "This page was already saved, so it was kept.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/admin/pages");
  });

  it("rejects an invalid page id without calling the delete service", async () => {
    const result = await deleteNeverSavedSeoPageDraft("../settings");

    expect(result).toEqual({
      status: "error",
      message: "Invalid page reference.",
    });
    expect(mocks.adminDeleteNeverSavedSeoPageDraft).not.toHaveBeenCalled();
  });

  it("maps an unexpected delete failure to a safe message", async () => {
    mocks.adminDeleteNeverSavedSeoPageDraft.mockRejectedValue(
      new Error("delete exploded"),
    );

    const result = await deleteNeverSavedSeoPageDraft(pageId);

    expect(result).toEqual({
      status: "error",
      message: "Could not discard the draft. Use Save draft to keep it.",
    });
  });
});
