import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageContent } from "@/lib/page-builder/blocks";
import {
  acceptAiSeoProposalBlocks,
  generateAiSeoPageProposal,
  saveSeoPage,
  saveSeoPageDraftAndCreatePreviewLink,
} from "./actions";
import { SeoAgentConfigurationError } from "@/lib/services/openai-seo-agent";
import { AiProposalValidationError } from "@/lib/services/ai-page-proposals";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  adminGenerateOpenAiSeoPageProposal: vi.fn(),
  adminAcceptAiProposalBlocks: vi.fn(),
  adminArchiveSeoPage: vi.fn(),
  adminCreateSeoPagePreviewToken: vi.fn(),
  adminCreateSeoPage: vi.fn(),
  adminGetSeoPageById: vi.fn(),
  adminPublishSeoPage: vi.fn(),
  adminRefreshSeoPageLibraryReferences: vi.fn(),
  adminRevokeSeoPagePreviewToken: vi.fn(),
  adminRollbackSeoPageRevision: vi.fn(),
  adminSaveSeoPageDraft: vi.fn(),
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
    adminCreateSeoPagePreviewToken: mocks.adminCreateSeoPagePreviewToken,
    adminCreateSeoPage: mocks.adminCreateSeoPage,
    adminGetSeoPageById: mocks.adminGetSeoPageById,
    adminPublishSeoPage: mocks.adminPublishSeoPage,
    adminRefreshSeoPageLibraryReferences:
      mocks.adminRefreshSeoPageLibraryReferences,
    adminRevokeSeoPagePreviewToken: mocks.adminRevokeSeoPagePreviewToken,
    adminRollbackSeoPageRevision: mocks.adminRollbackSeoPageRevision,
    adminSaveSeoPageDraft: mocks.adminSaveSeoPageDraft,
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
  targetKeyword?: string;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  sitemapEnabled?: boolean;
  structuredDataBreadcrumb?: boolean;
  structuredDataFaq?: boolean;
  draftContent?: PageContent;
  publishNote?: string;
  intent?: "save" | "publish";
};

function pageForm(overrides: PageFormOverrides = {}) {
  const values = {
    title: "Coffee Vending Adelaide",
    slug: "coffee-vending-adelaide",
    targetKeyword: "coffee vending",
    seoTitle: "Coffee vending machines",
    metaDescription: "Coffee vending machines for Adelaide workplaces.",
    canonicalUrl: "",
    noindex: false,
    sitemapEnabled: true,
    structuredDataBreadcrumb: true,
    structuredDataFaq: false,
    draftContent: validContent,
    publishNote: "",
    intent: "save" as const,
    ...overrides,
  };
  const formData = new FormData();
  if (values.id) formData.set("id", values.id);
  formData.set("title", values.title);
  formData.set("slug", values.slug);
  formData.set("targetKeyword", values.targetKeyword);
  formData.set("seoTitle", values.seoTitle);
  formData.set("metaDescription", values.metaDescription);
  formData.set("canonicalUrl", values.canonicalUrl);
  if (values.noindex) formData.set("noindex", "on");
  if (values.sitemapEnabled) formData.set("sitemapEnabled", "on");
  if (values.structuredDataBreadcrumb) {
    formData.set("structuredDataBreadcrumb", "on");
  }
  if (values.structuredDataFaq) formData.set("structuredDataFaq", "on");
  formData.set("draftContent", JSON.stringify(values.draftContent));
  formData.set("publishNote", values.publishNote);
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
      title: "Coffee Vending Adelaide",
      targetKeyword: "coffee vending",
      draftContent: validContent,
      createdBy: "admin_1",
    });
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(pageId, {
      seoTitle: "Coffee vending machines",
      metaDescription: "Coffee vending machines for Adelaide workplaces.",
      canonicalUrl: null,
      noindex: false,
      sitemapEnabled: true,
      structuredDataSettings: { breadcrumb: true, faq: false },
      updatedBy: "admin_1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pages");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/resources/coffee-vending-adelaide",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(mocks.redirect).toHaveBeenCalledWith(
      `/admin/pages/${pageId}?saved=1`,
    );
  });

  it("stores published page edits as draft content and draft settings", async () => {
    mocks.adminGetSeoPageById.mockResolvedValue({
      id: pageId,
      slug: "old-coffee-vending",
      status: "published",
    });

    const result = await saveSeoPage(
      { status: "idle" },
      pageForm({ id: pageId, slug: "new-coffee-vending" }),
    );

    expect(result).toEqual({ status: "saved", message: "Draft saved." });
    expect(mocks.adminUpdateSeoPageSlug).not.toHaveBeenCalled();
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(pageId, {
      draftContent: validContent,
      draftSettings: {
        slug: "new-coffee-vending",
        title: "Coffee Vending Adelaide",
        targetKeyword: "coffee vending",
        seoTitle: "Coffee vending machines",
        metaDescription: "Coffee vending machines for Adelaide workplaces.",
        canonicalUrl: null,
        noindex: false,
        sitemapEnabled: true,
        structuredDataSettings: { breadcrumb: true, faq: false },
      },
      updatedBy: "admin_1",
    });
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
      { actorId: "admin_1" },
    );
    const draftPayload = mocks.adminSaveSeoPageDraft.mock.calls[0]?.[1];
    expect(draftPayload).toMatchObject({
      title: "Coffee Vending Adelaide",
      targetKeyword: "coffee vending",
      seoTitle: "Coffee vending machines",
      metaDescription: "Coffee vending machines for Adelaide workplaces.",
      canonicalUrl: null,
      noindex: false,
      sitemapEnabled: true,
      structuredDataSettings: { breadcrumb: true, faq: false },
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
    expect(mocks.adminSaveSeoPageDraft).toHaveBeenCalledWith(pageId, {
      draftContent: validContent,
      draftSettings: expect.objectContaining({
        slug: "new-coffee-vending",
        title: "Coffee Vending Adelaide",
      }),
      updatedBy: "admin_1",
    });
    expect(mocks.adminCreateSeoPagePreviewToken).toHaveBeenCalledWith(pageId, {
      actorId: "admin_1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/pages/${pageId}`);
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(
      "/resources/new-coffee-vending",
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
});
