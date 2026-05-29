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
  adminCreateSeoPage,
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
  targetKeyword: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  noindex: boolean;
  sitemapEnabled: boolean;
  structuredDataSettings: StructuredDataSettings;
  draftContent: PageContent;
};

const formSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3, "Title needs at least 3 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-safe slug."),
  targetKeyword: z.string().trim().max(180, "Target keyword is too long."),
  seoTitle: z.string().trim().max(80, "SEO title is too long."),
  metaDescription: z.string().trim().max(180, "Meta description is too long."),
  canonicalUrl: z.string().trim().max(500, "Canonical URL is too long."),
  noindex: z.boolean(),
  sitemapEnabled: z.boolean(),
  structuredDataSettings: z.object({
    breadcrumb: z.boolean(),
    faq: z.boolean(),
  }),
  draftContent: pageContentSchema,
  intent: z.enum(["save", "publish"]),
});
type ParsedPageForm = z.infer<typeof formSchema>;

const ADMIN_PAGES_PATH = "/admin/pages";
const PUBLIC_RESOURCES_PATH = "/resources";

type PersistedPageDraft = {
  pageId: string;
  created: boolean;
  existingWasPublished: boolean;
  previousSlug?: string;
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
      await adminPublishSeoPage(persisted.pageId, { actorId: admin.user.id });
    }

    if (persisted.created) {
      revalidatePagePaths(page.slug);
      redirectTo = `${ADMIN_PAGES_PATH}/${persisted.pageId}?saved=1`;
    } else if (persisted.existingWasPublished && page.intent === "save") {
      revalidatePath(`${ADMIN_PAGES_PATH}/${persisted.pageId}`);
      revalidatePath(ADMIN_PAGES_PATH);
    } else {
      revalidatePagePaths(page.slug, persisted.previousSlug);
    }
  } catch (error) {
    return pageActionError(error);
  }

  if (redirectTo) redirect(redirectTo);
  return { status: "saved", message: statusMessage(page.intent) };
}

export type CreateDraftForEditorResult =
  | { status: "created"; pageId: string }
  | { status: "error"; message: string };

const createDraftForEditorSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  targetKeyword: z.string().trim().optional(),
});

// S3b: auto-create a draft row once the user has actually started a new page
// (a real title exists), so autosave can protect their work from then on. Only
// fires after a title is entered — it never creates blank "Untitled" rows.
export async function createSeoPageDraftForEditor(input: {
  title: string;
  slug: string;
  targetKeyword?: string;
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
      targetKeyword: parsed.data.targetKeyword ?? null,
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
    targetKeyword: payload.targetKeyword,
    seoTitle: payload.seoTitle,
    metaDescription: payload.metaDescription,
    canonicalUrl: payload.canonicalUrl,
    noindex: payload.noindex,
    sitemapEnabled: payload.sitemapEnabled,
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
        updatedBy: admin.user.id,
      });
    } else {
      await adminSaveSeoPageDraft(pageId, {
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
      revalidatePagePaths(page.slug, persisted.previousSlug);
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
): Promise<PageAiProposalResult> {
  const admin = await requireAuth();
  if (!pageId) {
    return { status: "error", message: "Save the page before running AI." };
  }

  try {
    const proposal = await adminGenerateOpenAiSeoPageProposal(pageId, {
      actorId: admin.user.id,
    });
    revalidatePath(`${ADMIN_PAGES_PATH}/${pageId}`);
    return {
      status: "created",
      message: "AI proposal created for review.",
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
      insertedBlockIds: parsed.data.blockIds,
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
    console.error("failed to roll back SEO page revision", {
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
  const pageId = String(formData.get("pageId") ?? "");
  if (!pageId) redirect(ADMIN_PAGES_PATH);

  await adminRefreshSeoPageLibraryReferences(pageId, {
    actorId: admin.user.id,
  });
  revalidatePath(`${ADMIN_PAGES_PATH}/${pageId}`);
  redirect(`${ADMIN_PAGES_PATH}/${pageId}?saved=1`);
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
    revalidatePagePaths(page.slug);
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

export async function moveSeoPageToDraftFromList(formData: FormData) {
  const admin = await requireAuth();
  const pageId = parseListPageId(formData, "move to draft");
  const returnTo = adminPageListReturnPath(formData);
  let redirectPath = returnTo;

  try {
    const page = await adminUnpublishSeoPage(pageId, {
      actorId: admin.user.id,
    });
    revalidatePagePaths(page.slug);
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
    revalidatePagePaths(page.slug);
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
    targetKeyword: formData.get("targetKeyword") ?? "",
    seoTitle: formData.get("seoTitle") ?? "",
    metaDescription: formData.get("metaDescription") ?? "",
    canonicalUrl: formData.get("canonicalUrl") ?? "",
    noindex: formData.get("noindex") === "on",
    sitemapEnabled: formData.get("sitemapEnabled") === "on",
    structuredDataSettings: {
      breadcrumb: formData.get("structuredDataBreadcrumb") === "on",
      faq: formData.get("structuredDataFaq") === "on",
    },
    draftContent,
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
      title: page.title,
      targetKeyword: nullable(page.targetKeyword),
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
      updatedBy: actorId,
    });
  } else {
    if (existing.slug !== page.slug) {
      await adminUpdateSeoPageSlug(page.id, page.slug, { actorId });
    }

    await adminSaveSeoPageDraft(page.id, {
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
    previousSlug: existing.slug,
  };
}

function draftMetadataFromPageForm(page: ParsedPageForm) {
  return {
    seoTitle: nullable(page.seoTitle),
    metaDescription: nullable(page.metaDescription),
    canonicalUrl: nullable(page.canonicalUrl),
    noindex: page.noindex,
    sitemapEnabled: page.sitemapEnabled,
    structuredDataSettings: page.structuredDataSettings,
  };
}

function draftSettingsFromPageForm(page: ParsedPageForm): SeoPageDraftSettings {
  return {
    slug: page.slug,
    title: page.title,
    targetKeyword: nullable(page.targetKeyword),
    ...draftMetadataFromPageForm(page),
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

function revalidatePagePaths(slug: string, previousSlug?: string) {
  revalidatePath(ADMIN_PAGES_PATH);
  revalidatePath(`${PUBLIC_RESOURCES_PATH}/${slug}`);
  revalidatePath("/sitemap.xml");
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`${PUBLIC_RESOURCES_PATH}/${previousSlug}`);
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
