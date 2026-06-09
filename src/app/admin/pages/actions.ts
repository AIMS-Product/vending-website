"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AiProposalValidationError,
  adminAcceptAiProposalBlocks,
} from "@/lib/services/ai-page-proposals";
import type { StructuredDataSettings } from "@/lib/page-builder/structured-data-settings";
import {
  adminArchiveSeoPage,
  SeoPageValidationError,
  adminCreateSeoPagePreviewToken,
  adminCreatePageComment,
  adminCreateSeoPage,
  adminDuplicateSeoPage,
  adminGetSeoPageById,
  adminPublishSeoPage,
  adminRefreshSeoPageLibraryReferences,
  adminRevokeSeoPagePreviewToken,
  adminRollbackSeoPageRevision,
  adminSaveSeoPageDraft,
  adminUnpublishSeoPage,
  adminUpdateSeoPageSlug,
  type SeoPageDraftSettings,
} from "@/lib/services/seo-pages";
import {
  SeoAgentConfigurationError,
  SeoAgentGenerationError,
  SeoAgentSourceError,
  adminGenerateOpenAiSeoPageProposal,
} from "@/lib/services/openai-seo-agent";
import { pageContentSchema, type PageContent } from "@/lib/page-builder/blocks";
import { pagePathForSlug } from "@/lib/page-builder/page-paths";
import { zonedDateTimeLocalToUtcIso } from "@/lib/page-builder/scheduled-publishing";
import {
  defaultSeoAgentProvider,
  type SeoAgentProvider,
} from "@/lib/page-builder/seo-agent-provider";
import { requireAdmin as requireAuth } from "@/lib/supabase/auth";

export type PageEditorActionState =
  | { status: "idle"; message?: string }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

export type PageAutosaveResult =
  | { status: "saved"; savedAt: string }
  | { status: "skipped"; message: string }
  | { status: "error"; message: string };

export type PageAiProposalResult =
  | { status: "idle"; message?: string; proposalId?: string }
  | { status: "created"; message: string; proposalId: string }
  | { status: "error"; message: string; proposalId?: string };

export type PageAiProposalInsertResult =
  | { status: "idle"; message?: string; proposalId?: string }
  | {
      status: "inserted";
      message: string;
      proposalId: string;
      insertedBlockIds: string[];
      content: PageContent;
    }
  | { status: "error"; message: string; proposalId?: string };

export type PagePreviewLinkActionState =
  | { status: "idle"; message?: string; previewPath?: string }
  | {
      status: "created";
      message: string;
      previewPath: string;
      pageId?: string;
      editorPath?: string;
    }
  | { status: "error"; message: string; previewPath?: string };

export type PageAutosavePayload = {
  title: string;
  slug: string;
  routePrefix: string;
  targetKeyword: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  internalTags: string;
  topicCluster: string;
  campaignLabel: string;
  funnelStage: string;
  reviewPeriodMonths: number;
  nextReviewAt: string;
  lifecycleStatus: string;
  ogTitle: string;
  ogDescription: string;
  scheduledPublishAt: string;
  scheduledPublishAtBaseline: string;
  cancelScheduledPublish: boolean;
  noindex: boolean;
  sitemapEnabled: boolean;
  pageType: string;
  templateKey: string;
  structuredDataSettings: StructuredDataSettings;
  draftContent: PageContent;
};

const formObjectSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3, "Title needs at least 3 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-safe slug."),
  routePrefix: z
    .string()
    .trim()
    .regex(
      /^\/(resources|blog|landing|videos|solutions)$/,
      "Choose a supported route prefix.",
    )
    .default("/resources"),
  targetKeyword: z.string().trim().max(180, "Target keyword is too long."),
  seoTitle: z.string().trim().max(80, "SEO title is too long."),
  metaDescription: z.string().trim().max(180, "Meta description is too long."),
  canonicalUrl: z.string().trim().max(500, "Canonical URL is too long."),
  internalTags: z.string().trim().max(500).default(""),
  topicCluster: z.string().trim().max(120).default(""),
  campaignLabel: z.string().trim().max(120).default(""),
  funnelStage: z.string().trim().max(80).default(""),
  reviewPeriodMonths: z.coerce
    .number()
    .int()
    .refine((value) => [3, 6, 9, 12, 15, 18].includes(value), {
      message: "Choose a supported review period.",
    })
    .default(6),
  nextReviewAt: z.string().trim().max(40).default(""),
  lifecycleStatus: z
    .enum(["drafting", "updating", "needs_review", "approved"])
    .default("drafting"),
  ogTitle: z.string().trim().max(80, "Social title is too long.").default(""),
  ogDescription: z
    .string()
    .trim()
    .max(180, "Social description is too long.")
    .default(""),
  scheduledPublishAt: z.string().trim().max(40).default(""),
  scheduledPublishAtBaseline: z.string().trim().max(40).default(""),
  cancelScheduledPublish: z.boolean().default(false),
  noindex: z.boolean(),
  sitemapEnabled: z.boolean(),
  pageType: z.string().trim().min(1).default("resource"),
  templateKey: z.string().trim().min(1).default("blank"),
  structuredDataSettings: z.object({
    breadcrumb: z.boolean(),
    faq: z.boolean(),
  }),
  draftContent: pageContentSchema,
  publishNote: z.string().trim().max(240).optional(),
  intent: z.enum(["save", "publish"]),
});
const formSchema = formObjectSchema.superRefine((data, ctx) => {
  if (
    !data.cancelScheduledPublish &&
    data.scheduledPublishAt.length > 0 &&
    data.scheduledPublishAt !== data.scheduledPublishAtBaseline &&
    !zonedDateTimeLocalToUtcIso(data.scheduledPublishAt)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["scheduledPublishAt"],
      message:
        "Scheduled publish time is not valid in Pacific Time. Pick a different time.",
    });
  }
});
type ParsedPageForm = z.infer<typeof formSchema>;

const ADMIN_PAGES_PATH = "/admin/pages";
const seoAgentProviderSchema = z.enum(["openai", "cerebras"]);

type PersistedPageDraft = {
  pageId: string;
  created: boolean;
  existingWasPublished: boolean;
  previousPath?: string;
};

export async function saveSeoPage(
  _prev: PageEditorActionState,
  formData: FormData,
): Promise<PageEditorActionState> {
  const admin = await requireAuth();
  const parsed = parsePageFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.message };
  }

  const page = parsed.data;
  let redirectTo: string | null = null;

  try {
    const persisted = await persistPageEditorDraft(page, admin.user.id);
    if (!persisted) {
      return { status: "error", message: "Page not found." };
    }

    if (page.intent === "publish") {
      await adminPublishSeoPage(persisted.pageId, {
        actorId: admin.user.id,
        publishNote: page.publishNote,
      });
    }

    if (persisted.created) {
      revalidatePagePaths(pagePathForSlug(page.slug, page.routePrefix));
      redirectTo = `${ADMIN_PAGES_PATH}/${persisted.pageId}?saved=1`;
    } else if (persisted.existingWasPublished && page.intent === "save") {
      revalidatePath(`${ADMIN_PAGES_PATH}/${persisted.pageId}`);
      revalidatePath(ADMIN_PAGES_PATH);
    } else {
      revalidatePagePaths(
        pagePathForSlug(page.slug, page.routePrefix),
        persisted.previousPath,
      );
    }
  } catch (error) {
    return pageActionError(error);
  }

  if (redirectTo) redirect(redirectTo);
  return { status: "saved", message: statusMessage(page.intent) };
}

export async function createSeoPageComment(formData: FormData) {
  const admin = await requireAuth();
  const parsedPageId = z.uuid().safeParse(String(formData.get("pageId") ?? ""));
  if (!parsedPageId.success) {
    redirect(ADMIN_PAGES_PATH);
    return;
  }
  const pageId = parsedPageId.data;
  const pagePath = `${ADMIN_PAGES_PATH}/${pageId}`;
  try {
    await adminCreatePageComment({
      pageId,
      blockId: String(formData.get("blockId") ?? "") || null,
      body: String(formData.get("body") ?? ""),
      createdBy: admin.user.id,
    });
    revalidatePath(pagePath);
  } catch (error) {
    console.error("failed to create SEO page comment", {
      adminUserId: admin.user.id,
      pageId,
      error,
    });
    redirect(`${pagePath}?error=comment`);
  }
}

export type CreateDraftForEditorResult =
  | { status: "created"; pageId: string }
  | { status: "error"; message: string };

const createDraftForEditorSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  routePrefix: z.string().trim().min(1).default("/resources"),
  targetKeyword: z.string().trim().optional(),
  seoTitle: z.string().trim().optional(),
  metaDescription: z.string().trim().optional(),
  pageType: z.string().trim().min(1).default("resource"),
  templateKey: z.string().trim().min(1).default("blank"),
});

// S3b: auto-create a draft row once the user has actually started a new page
// (a real title exists), so autosave can protect their work from then on. Only
// fires after a title is entered — it never creates blank "Untitled" rows.
export async function createSeoPageDraftForEditor(input: {
  title: string;
  slug: string;
  routePrefix?: string;
  targetKeyword?: string;
  seoTitle?: string;
  metaDescription?: string;
  pageType?: string;
  templateKey?: string;
  draftContent?: unknown;
}): Promise<CreateDraftForEditorResult> {
  const admin = await requireAuth();
  const parsed = createDraftForEditorSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Add a title before auto-saving." };
  }

  try {
    const page = await adminCreateSeoPage({
      title: parsed.data.title,
      slug: parsed.data.slug,
      routePrefix: parsed.data.routePrefix,
      targetKeyword: parsed.data.targetKeyword ?? null,
      seoTitle: parsed.data.seoTitle ?? null,
      metaDescription: parsed.data.metaDescription ?? null,
      pageType: parsed.data.pageType,
      templateKey: parsed.data.templateKey,
      draftContent: input.draftContent,
      createdBy: admin.user.id,
    });
    revalidatePath(ADMIN_PAGES_PATH);
    return { status: "created", pageId: page.id };
  } catch (error) {
    console.error("failed to auto-create SEO page draft", {
      adminUserId: admin.user.id,
      error,
    });
    return {
      status: "error",
      message: "Could not start the draft automatically — use Save draft.",
    };
  }
}

export async function autosaveSeoPageDraft(
  pageId: string,
  payload: PageAutosavePayload,
): Promise<PageAutosaveResult> {
  const admin = await requireAuth();
  const parsed = formSchema.safeParse({
    id: pageId,
    title: payload.title,
    slug: payload.slug,
    routePrefix: payload.routePrefix,
    targetKeyword: payload.targetKeyword,
    seoTitle: payload.seoTitle,
    metaDescription: payload.metaDescription,
    canonicalUrl: payload.canonicalUrl,
    internalTags: payload.internalTags,
    topicCluster: payload.topicCluster,
    campaignLabel: payload.campaignLabel,
    funnelStage: payload.funnelStage,
    reviewPeriodMonths: payload.reviewPeriodMonths,
    nextReviewAt: payload.nextReviewAt,
    lifecycleStatus: payload.lifecycleStatus,
    ogTitle: payload.ogTitle,
    ogDescription: payload.ogDescription,
    scheduledPublishAt: payload.scheduledPublishAt,
    scheduledPublishAtBaseline: payload.scheduledPublishAtBaseline,
    cancelScheduledPublish: payload.cancelScheduledPublish,
    noindex: payload.noindex,
    sitemapEnabled: payload.sitemapEnabled,
    pageType: payload.pageType,
    templateKey: payload.templateKey,
    structuredDataSettings: payload.structuredDataSettings,
    draftContent: payload.draftContent,
    intent: "save",
  });

  if (!parsed.success) {
    return { status: "error", message: firstIssue(parsed.error) };
  }

  try {
    const existing = await adminGetSeoPageById(pageId);
    if (!existing) {
      return { status: "error", message: "Page not found." };
    }

    if (existing.status === "published") {
      await adminSaveSeoPageDraft(pageId, {
        draftContent: parsed.data.draftContent,
        draftSettings: draftSettingsFromPageForm(parsed.data),
        ...governanceMetadataFromPageForm(parsed.data),
        ...scheduledPublishMetadataFromPageForm(parsed.data),
        updatedBy: admin.user.id,
      });
    } else {
      await adminSaveSeoPageDraft(pageId, {
        slug: parsed.data.slug,
        routePrefix: parsed.data.routePrefix,
        title: parsed.data.title,
        targetKeyword: nullable(parsed.data.targetKeyword),
        ...draftMetadataFromPageForm(parsed.data),
        draftContent: parsed.data.draftContent,
        updatedBy: admin.user.id,
      });
    }
    revalidatePath(`${ADMIN_PAGES_PATH}/${pageId}`);
    return { status: "saved", savedAt: new Date().toISOString() };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof SeoPageValidationError
          ? error.issues[0]?.message || "Invalid page content."
          : "Autosave failed.",
    };
  }
}

export async function createSeoPagePreviewLink(
  _prev: PagePreviewLinkActionState,
  formData: FormData,
): Promise<PagePreviewLinkActionState> {
  const admin = await requireAuth();
  const pageId = String(formData.get("pageId") ?? "");
  if (!pageId) return { status: "error", message: "Missing page ID." };

  try {
    const preview = await adminCreateSeoPagePreviewToken(pageId, {
      actorId: admin.user.id,
    });
    revalidatePath(`${ADMIN_PAGES_PATH}/${pageId}`);
    return {
      status: "created",
      message: "Preview link created.",
      previewPath: preview.previewPath,
    };
  } catch (error) {
    return pagePreviewActionError(error);
  }
}

export async function saveSeoPageDraftAndCreatePreviewLink(
  _prev: PagePreviewLinkActionState,
  formData: FormData,
): Promise<PagePreviewLinkActionState> {
  const admin = await requireAuth();
  const parsed = parsePageFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.message };
  }

  const page = parsed.data;

  try {
    const persisted = await persistPageEditorDraft(page, admin.user.id);
    if (!persisted) {
      return { status: "error", message: "Page not found." };
    }

    const preview = await adminCreateSeoPagePreviewToken(persisted.pageId, {
      actorId: admin.user.id,
    });
    if (persisted.created) {
      revalidatePagePaths(
        pagePathForSlug(page.slug, page.routePrefix),
        persisted.previousPath,
      );
    }
    revalidatePath(`${ADMIN_PAGES_PATH}/${persisted.pageId}`);
    return {
      status: "created",
      message: page.id
        ? "Preview link created."
        : "Draft saved and preview opened.",
      previewPath: preview.previewPath,
      pageId: persisted.pageId,
      editorPath: `${ADMIN_PAGES_PATH}/${persisted.pageId}?saved=1`,
    };
  } catch (error) {
    return pagePreviewActionError(error);
  }
}

export async function generateAiSeoPageProposal(
  pageId: string,
  providerInput: SeoAgentProvider = defaultSeoAgentProvider,
): Promise<PageAiProposalResult> {
  const admin = await requireAuth();
  if (!pageId) {
    return { status: "error", message: "Save the page before running AI." };
  }

  const provider = seoAgentProviderSchema
    .catch(defaultSeoAgentProvider)
    .parse(providerInput);

  try {
    const proposal = await adminGenerateOpenAiSeoPageProposal(pageId, {
      actorId: admin.user.id,
      provider,
    });
    revalidatePath(`${ADMIN_PAGES_PATH}/${pageId}`);
    return {
      status: "created",
      message:
        provider === "cerebras"
          ? "Cerebras proposal created for review."
          : "AI proposal created for review.",
      proposalId: proposal.id,
    };
  } catch (error) {
    return pageAiProposalActionError(error);
  }
}

export async function acceptAiSeoProposalBlocks(
  pageId: string,
  proposalId: string,
  blockIds: string[],
): Promise<PageAiProposalInsertResult> {
  const admin = await requireAuth();
  const parsed = z
    .object({
      pageId: z.uuid(),
      proposalId: z.uuid(),
      blockIds: z.array(z.string().trim().min(1)).min(1),
    })
    .safeParse({ pageId, proposalId, blockIds });
  if (!parsed.success) {
    return {
      status: "error",
      proposalId,
      message: firstIssue(parsed.error),
    };
  }

  try {
    const result = await adminAcceptAiProposalBlocks(
      parsed.data.pageId,
      parsed.data.proposalId,
      parsed.data.blockIds,
      { actorId: admin.user.id },
    );
    const content = parseAcceptedPageContent(result.page);
    revalidatePath(`${ADMIN_PAGES_PATH}/${parsed.data.pageId}`);
    return {
      status: "inserted",
      message: `${parsed.data.blockIds.length} AI block${
        parsed.data.blockIds.length === 1 ? "" : "s"
      } inserted into the draft.`,
      proposalId: parsed.data.proposalId,
      // The service may remap IDs that collide with existing draft blocks.
      insertedBlockIds: result.insertedBlockIds ?? parsed.data.blockIds,
      content,
    };
  } catch (error) {
    return pageAiProposalInsertActionError(error, proposalId);
  }
}

export async function revokeSeoPagePreviewLink(formData: FormData) {
  const admin = await requireAuth();
  const pageId = String(formData.get("pageId") ?? "");
  const tokenId = String(formData.get("tokenId") ?? "");
  if (!pageId || !tokenId) redirect(ADMIN_PAGES_PATH);

  const pagePath = `${ADMIN_PAGES_PATH}/${pageId}`;
  let redirectPath = pagePath;
  try {
    await adminRevokeSeoPagePreviewToken(tokenId);
    revalidatePath(pagePath);
  } catch (error) {
    console.error("failed to revoke SEO page preview token", {
      adminUserId: admin.user.id,
      pageId,
      tokenId,
      error,
    });
    redirectPath = `${pagePath}?error=preview-revoke`;
  }
  redirect(redirectPath);
}

export async function rollbackSeoPageRevision(formData: FormData) {
  const admin = await requireAuth();
  const pageId = String(formData.get("pageId") ?? "");
  const revisionId = String(formData.get("revisionId") ?? "");
  if (!pageId || !revisionId) redirect(ADMIN_PAGES_PATH);

  const pagePath = `${ADMIN_PAGES_PATH}/${pageId}`;
  let redirectPath = `${pagePath}?saved=1`;
  try {
    await adminRollbackSeoPageRevision(pageId, revisionId, {
      actorId: admin.user.id,
    });
    revalidatePath(pagePath);
  } catch (error) {
    console.error("failed to restore SEO page revision as draft", {
      adminUserId: admin.user.id,
      pageId,
      revisionId,
      error,
    });
    redirectPath = `${pagePath}?error=rollback`;
  }
  redirect(redirectPath);
}

export async function refreshSeoPageLibraryReferences(formData: FormData) {
  const admin = await requireAuth();
  const parsedPageId = z.uuid().safeParse(String(formData.get("pageId") ?? ""));
  if (!parsedPageId.success) {
    redirect(`${ADMIN_PAGES_PATH}?error=invalid-id`);
    return;
  }
  const pageId = parsedPageId.data;
  const pagePath = `${ADMIN_PAGES_PATH}/${pageId}`;
  let redirectPath = `${pagePath}?saved=1`;
  try {
    await adminRefreshSeoPageLibraryReferences(pageId, {
      actorId: admin.user.id,
    });
    revalidatePath(pagePath);
  } catch (error) {
    console.error("failed to refresh SEO page library references", {
      adminUserId: admin.user.id,
      pageId,
      error,
    });
    redirectPath = `${pagePath}?error=refresh`;
  }
  redirect(redirectPath);
}

export async function publishSeoPageFromList(formData: FormData) {
  const admin = await requireAuth();
  const pageId = parseListPageId(formData, "publish");
  const returnTo = adminPageListReturnPath(formData);
  let redirectPath = returnTo;

  try {
    const { page } = await adminPublishSeoPage(pageId, {
      actorId: admin.user.id,
    });
    revalidatePagePaths(page.route_path);
  } catch (error) {
    console.error("failed to publish SEO page from list", {
      adminUserId: admin.user.id,
      pageId,
      error,
    });
    redirectPath = `${ADMIN_PAGES_PATH}/${pageId}?error=publish`;
  }

  redirect(redirectPath);
}

export async function duplicateSeoPageFromList(formData: FormData) {
  const admin = await requireAuth();
  const pageId = parseListPageId(formData, "duplicate");
  let redirectPath = `${ADMIN_PAGES_PATH}/${pageId}?error=duplicate`;

  try {
    const page = await adminDuplicateSeoPage(pageId, {
      actorId: admin.user.id,
    });
    revalidatePath(ADMIN_PAGES_PATH);
    redirectPath = `${ADMIN_PAGES_PATH}/${page.id}?saved=1`;
  } catch (error) {
    console.error("failed to duplicate SEO page from list", {
      adminUserId: admin.user.id,
      pageId,
      error,
    });
  }
  redirect(redirectPath);
}

export async function moveSeoPageToDraftFromList(formData: FormData) {
  const admin = await requireAuth();
  const pageId = parseListPageId(formData, "move to draft");
  const returnTo = adminPageListReturnPath(formData);
  let redirectPath = returnTo;

  try {
    const page = await adminUnpublishSeoPage(pageId, {
      actorId: admin.user.id,
    });
    revalidatePagePaths(page.route_path);
  } catch (error) {
    console.error("failed to move SEO page to draft from list", {
      adminUserId: admin.user.id,
      pageId,
      error,
    });
    redirectPath = `${ADMIN_PAGES_PATH}/${pageId}?error=unpublish`;
  }

  redirect(redirectPath);
}

export async function archiveSeoPageFromList(formData: FormData) {
  const admin = await requireAuth();
  const pageId = parseListPageId(formData, "archive");
  const returnTo = adminPageListReturnPath(formData);
  let redirectPath = returnTo;

  try {
    const page = await adminArchiveSeoPage(pageId, {
      actorId: admin.user.id,
    });
    revalidatePagePaths(page.route_path);
  } catch (error) {
    console.error("failed to archive SEO page from list", {
      adminUserId: admin.user.id,
      pageId,
      error,
    });
    redirectPath = `${ADMIN_PAGES_PATH}/${pageId}?error=archive`;
  }

  redirect(redirectPath);
}

function parsePageFormData(formData: FormData) {
  const contentRaw = String(formData.get("draftContent") ?? "");
  let draftContent: unknown;
  try {
    draftContent = JSON.parse(contentRaw);
  } catch {
    return {
      success: false as const,
      message: "Page content is invalid JSON.",
    };
  }

  const parsed = formSchema.safeParse({
    id: String(formData.get("id") ?? "") || undefined,
    title: formData.get("title"),
    slug: formData.get("slug"),
    routePrefix: formData.get("routePrefix") ?? "/resources",
    targetKeyword: formData.get("targetKeyword") ?? "",
    seoTitle: formData.get("seoTitle") ?? "",
    metaDescription: formData.get("metaDescription") ?? "",
    canonicalUrl: formData.get("canonicalUrl") ?? "",
    internalTags: formData.get("internalTags") ?? "",
    topicCluster: formData.get("topicCluster") ?? "",
    campaignLabel: formData.get("campaignLabel") ?? "",
    funnelStage: formData.get("funnelStage") ?? "",
    reviewPeriodMonths: formData.get("reviewPeriodMonths") ?? 6,
    nextReviewAt: formData.get("nextReviewAt") ?? "",
    lifecycleStatus: formData.get("lifecycleStatus") ?? "drafting",
    ogTitle: formData.get("ogTitle") ?? "",
    ogDescription: formData.get("ogDescription") ?? "",
    scheduledPublishAt: formData.get("scheduledPublishAt") ?? "",
    scheduledPublishAtBaseline:
      formData.get("scheduledPublishAtBaseline") ?? "",
    cancelScheduledPublish: formData.get("cancelScheduledPublish") === "on",
    noindex: formData.get("noindex") === "on",
    sitemapEnabled: formData.get("sitemapEnabled") === "on",
    pageType: formData.get("pageType") ?? "resource",
    templateKey: formData.get("templateKey") ?? "blank",
    structuredDataSettings: {
      breadcrumb: formData.get("structuredDataBreadcrumb") === "on",
      faq: formData.get("structuredDataFaq") === "on",
    },
    draftContent,
    publishNote: String(formData.get("publishNote") ?? ""),
    intent: formData.get("intent") ?? "save",
  });

  if (!parsed.success) {
    return { success: false as const, message: firstIssue(parsed.error) };
  }

  return { success: true as const, data: parsed.data };
}

async function persistPageEditorDraft(
  page: ParsedPageForm,
  actorId: string,
): Promise<PersistedPageDraft | null> {
  if (!page.id) {
    const created = await adminCreateSeoPage({
      slug: page.slug,
      routePrefix: page.routePrefix,
      title: page.title,
      targetKeyword: nullable(page.targetKeyword),
      pageType: page.pageType,
      templateKey: page.templateKey,
      draftContent: page.draftContent,
      createdBy: actorId,
    });

    await adminSaveSeoPageDraft(created.id, {
      ...draftMetadataFromPageForm(page),
      updatedBy: actorId,
    });

    return {
      pageId: created.id,
      created: true,
      existingWasPublished: false,
    };
  }

  const existing = await adminGetSeoPageById(page.id);
  if (!existing) return null;

  if (existing.status === "published") {
    await adminSaveSeoPageDraft(page.id, {
      draftContent: page.draftContent,
      draftSettings: draftSettingsFromPageForm(page),
      ...governanceMetadataFromPageForm(page),
      ...scheduledPublishMetadataFromPageForm(page),
      updatedBy: actorId,
    });
  } else {
    if (
      existing.slug !== page.slug ||
      existing.route_prefix !== page.routePrefix
    ) {
      await adminUpdateSeoPageSlug(page.id, page.slug, {
        actorId,
        routePrefix: page.routePrefix,
      });
    }

    await adminSaveSeoPageDraft(page.id, {
      slug: page.slug,
      routePrefix: page.routePrefix,
      title: page.title,
      targetKeyword: nullable(page.targetKeyword),
      ...draftMetadataFromPageForm(page),
      draftContent: page.draftContent,
      updatedBy: actorId,
    });
  }

  return {
    pageId: page.id,
    created: false,
    existingWasPublished: existing.status === "published",
    previousPath: existing.route_path,
  };
}

function draftMetadataFromPageForm(page: ParsedPageForm) {
  return {
    ...seoDraftMetadataFromPageForm(page),
    ...governanceMetadataFromPageForm(page),
    ...scheduledPublishMetadataFromPageForm(page),
  };
}

function governanceMetadataFromPageForm(page: ParsedPageForm) {
  return {
    internalTags: parseInternalTags(page.internalTags),
    topicCluster: nullable(page.topicCluster),
    campaignLabel: nullable(page.campaignLabel),
    funnelStage: nullable(page.funnelStage),
    reviewPeriodMonths: page.reviewPeriodMonths,
    nextReviewAt: nullableDate(page.nextReviewAt),
    lifecycleStatus: page.lifecycleStatus,
    ogTitle: nullable(page.ogTitle),
    ogDescription: nullable(page.ogDescription),
  };
}

function seoDraftMetadataFromPageForm(page: ParsedPageForm) {
  return {
    seoTitle: nullable(page.seoTitle),
    metaDescription: nullable(page.metaDescription),
    canonicalUrl: nullable(page.canonicalUrl),
    noindex: page.noindex,
    sitemapEnabled: page.sitemapEnabled,
    structuredDataSettings: page.structuredDataSettings,
  };
}

// Scheduler columns are owned by explicit schedule/cancel actions and the
// publish runner. Saves and autosaves must leave them untouched unless the
// user actually edited the schedule field — otherwise a routine autosave can
// null the runner's claim lock, reset attempts, or re-arm a past schedule
// left in a stale tab.
function scheduledPublishMetadataFromPageForm(page: ParsedPageForm) {
  if (page.cancelScheduledPublish) {
    return cancelledScheduledPublishMetadata();
  }

  if (page.scheduledPublishAt === page.scheduledPublishAtBaseline) {
    return {};
  }

  if (page.scheduledPublishAt.length === 0) {
    return cancelledScheduledPublishMetadata();
  }

  const scheduledPublishAt = zonedDateTimeLocalToUtcIso(
    page.scheduledPublishAt,
  );
  if (!scheduledPublishAt) return {};

  return {
    scheduledPublishAt,
    scheduledPublishStatus: "scheduled",
    scheduledPublishError: null,
    scheduledPublishAttempts: 0,
    scheduledPublishLastAttemptAt: null,
    scheduledPublishLockedAt: null,
  };
}

function cancelledScheduledPublishMetadata() {
  return {
    scheduledPublishAt: null,
    scheduledPublishStatus: "cancelled",
    scheduledPublishError: null,
    scheduledPublishAttempts: 0,
    scheduledPublishLastAttemptAt: null,
    scheduledPublishLockedAt: null,
  };
}

function parseInternalTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
}

function nullableDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function draftSettingsFromPageForm(page: ParsedPageForm): SeoPageDraftSettings {
  return {
    slug: page.slug,
    routePrefix: page.routePrefix,
    routePath: pagePathForSlug(page.slug, page.routePrefix),
    title: page.title,
    targetKeyword: nullable(page.targetKeyword),
    ...seoDraftMetadataFromPageForm(page),
  };
}

function pageActionError(error: unknown): PageEditorActionState {
  console.error("seo page admin action failed", error);
  if (error instanceof SeoPageValidationError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "Page did not pass validation.",
    };
  }

  return {
    status: "error",
    message: "Could not save the page. Check the fields and try again.",
  };
}

function pagePreviewActionError(error: unknown): PagePreviewLinkActionState {
  console.error("seo page preview action failed", error);
  if (error instanceof SeoPageValidationError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "Preview link could not be created.",
    };
  }

  return {
    status: "error",
    message: "Could not create preview link.",
  };
}

function pageAiProposalActionError(error: unknown): PageAiProposalResult {
  console.error("seo page AI proposal action failed", error);
  if (error instanceof SeoAgentConfigurationError) {
    return {
      status: "error",
      message: "OpenAI is not configured for the SEO agent.",
    };
  }
  if (error instanceof SeoAgentSourceError) {
    return {
      status: "error",
      message: error.message,
    };
  }
  if (error instanceof SeoAgentGenerationError) {
    if (error.status === 429 || error.code === "request_quota_exceeded") {
      return {
        status: "error",
        message:
          "AI provider rate limit is temporarily unavailable. Retry shortly.",
      };
    }
    if (error.code === "insufficient_quota") {
      return {
        status: "error",
        message: "OpenAI quota is not available. Add credits, then retry.",
      };
    }
    return {
      status: "error",
      message: "OpenAI could not generate a valid source-bound proposal.",
    };
  }
  if (error instanceof AiProposalValidationError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "AI proposal did not validate.",
    };
  }

  return {
    status: "error",
    message: "Could not create an AI proposal.",
  };
}

function pageAiProposalInsertActionError(
  error: unknown,
  proposalId: string,
): PageAiProposalInsertResult {
  console.error("seo page AI proposal insert action failed", error);
  if (error instanceof AiProposalValidationError) {
    return {
      status: "error",
      proposalId,
      message: error.issues[0]?.message ?? "AI proposal did not validate.",
    };
  }
  if (error instanceof SeoPageValidationError) {
    return {
      status: "error",
      proposalId,
      message: error.issues[0]?.message ?? "Page did not pass validation.",
    };
  }
  if (error instanceof Error) {
    return {
      status: "error",
      proposalId,
      message: error.message,
    };
  }

  return {
    status: "error",
    proposalId,
    message: "Could not insert AI proposal content.",
  };
}

function parseAcceptedPageContent(page: unknown): PageContent {
  const parsed = z
    .object({
      draft_content: pageContentSchema,
    })
    .passthrough()
    .safeParse(page);
  if (!parsed.success) {
    throw new SeoPageValidationError([
      {
        code: "invalid_draft_content",
        path: "draft_content",
        message: "AI content was inserted but the updated draft is invalid.",
      },
    ]);
  }
  return parsed.data.draft_content;
}

function revalidatePagePaths(routePath: string, previousPath?: string) {
  revalidatePath(ADMIN_PAGES_PATH);
  revalidatePath(routePath);
  revalidatePath("/sitemap.xml");
  if (previousPath && previousPath !== routePath) {
    revalidatePath(previousPath);
  }
}

function adminPageListReturnPath(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? ADMIN_PAGES_PATH);
  if (returnTo === ADMIN_PAGES_PATH) return returnTo;
  if (returnTo.startsWith(`${ADMIN_PAGES_PATH}?`)) return returnTo;
  return ADMIN_PAGES_PATH;
}

function parseListPageId(formData: FormData, action: string) {
  const rawPageId = String(formData.get("id") ?? "");
  const parsed = z.uuid().safeParse(rawPageId);
  if (!parsed.success) {
    console.error("invalid SEO page id from list action", {
      action,
      rawPageId,
    });
    redirect(`${ADMIN_PAGES_PATH}?error=invalid-id`);
  }
  return parsed.data;
}

function nullable(value: string) {
  return value.length > 0 ? value : null;
}

function statusMessage(intent: "save" | "publish") {
  return intent === "publish" ? "Page published." : "Draft saved.";
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid page fields.";
}
