"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AiProposalValidationError,
  adminAcceptAiProposalBlocks,
} from "@/lib/services/ai-page-proposals";
import {
  SeoPageValidationError,
  adminCreateSeoPagePreviewToken,
  adminCreateSeoPage,
  adminGetSeoPageById,
  adminPublishSeoPage,
  adminRefreshSeoPageLibraryReferences,
  adminRevokeSeoPagePreviewToken,
  adminRollbackSeoPageRevision,
  adminSaveSeoPageDraft,
  adminUpdateSeoPageSlug,
} from "@/lib/services/seo-pages";
import {
  SeoAgentConfigurationError,
  SeoAgentGenerationError,
  SeoAgentSourceError,
  adminGenerateOpenAiSeoPageProposal,
} from "@/lib/services/openai-seo-agent";
import { pageContentSchema, type PageContent } from "@/lib/page-builder/blocks";
import { requireAdmin } from "@/lib/supabase/auth";

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
  | { status: "created"; message: string; previewPath: string }
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
  draftContent: pageContentSchema,
  intent: z.enum(["save", "publish"]),
});

const ADMIN_PAGES_PATH = "/admin/pages";
const PUBLIC_RESOURCES_PATH = "/resources";

export async function saveSeoPage(
  _prev: PageEditorActionState,
  formData: FormData,
): Promise<PageEditorActionState> {
  const admin = await requireAdmin();
  const parsed = parsePageFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.message };
  }

  const page = parsed.data;
  let redirectTo: string | null = null;

  try {
    if (!page.id) {
      const created = await adminCreateSeoPage({
        slug: page.slug,
        title: page.title,
        targetKeyword: nullable(page.targetKeyword),
        draftContent: page.draftContent,
        createdBy: admin.user.id,
      });

      await adminSaveSeoPageDraft(created.id, {
        seoTitle: nullable(page.seoTitle),
        metaDescription: nullable(page.metaDescription),
        canonicalUrl: nullable(page.canonicalUrl),
        noindex: page.noindex,
        sitemapEnabled: page.sitemapEnabled,
        updatedBy: admin.user.id,
      });

      if (page.intent === "publish") {
        await adminPublishSeoPage(created.id, { actorId: admin.user.id });
      }

      revalidatePagePaths(created.slug);
      redirectTo = `${ADMIN_PAGES_PATH}/${created.id}?saved=1`;
    } else {
      const existing = await adminGetSeoPageById(page.id);
      if (!existing) {
        return { status: "error", message: "Page not found." };
      }

      if (existing.slug !== page.slug) {
        await adminUpdateSeoPageSlug(page.id, page.slug, {
          actorId: admin.user.id,
        });
      }

      await adminSaveSeoPageDraft(page.id, {
        title: page.title,
        targetKeyword: nullable(page.targetKeyword),
        seoTitle: nullable(page.seoTitle),
        metaDescription: nullable(page.metaDescription),
        canonicalUrl: nullable(page.canonicalUrl),
        noindex: page.noindex,
        sitemapEnabled: page.sitemapEnabled,
        draftContent: page.draftContent,
        updatedBy: admin.user.id,
      });

      if (page.intent === "publish") {
        await adminPublishSeoPage(page.id, { actorId: admin.user.id });
      }

      revalidatePagePaths(page.slug, existing.slug);
      return { status: "saved", message: statusMessage(page.intent) };
    }
  } catch (error) {
    return pageActionError(error);
  }

  if (redirectTo) redirect(redirectTo);
  return { status: "saved", message: statusMessage(page.intent) };
}

export async function autosaveSeoPageDraft(
  pageId: string,
  payload: PageAutosavePayload,
): Promise<PageAutosaveResult> {
  const admin = await requireAdmin();
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
    draftContent: payload.draftContent,
    intent: "save",
  });

  if (!parsed.success) {
    return { status: "error", message: firstIssue(parsed.error) };
  }

  try {
    await adminSaveSeoPageDraft(pageId, {
      title: parsed.data.title,
      targetKeyword: nullable(parsed.data.targetKeyword),
      seoTitle: nullable(parsed.data.seoTitle),
      metaDescription: nullable(parsed.data.metaDescription),
      canonicalUrl: nullable(parsed.data.canonicalUrl),
      noindex: parsed.data.noindex,
      sitemapEnabled: parsed.data.sitemapEnabled,
      draftContent: parsed.data.draftContent,
      updatedBy: admin.user.id,
    });
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
  const admin = await requireAdmin();
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

export async function generateAiSeoPageProposal(
  pageId: string,
): Promise<PageAiProposalResult> {
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
  const pageId = String(formData.get("pageId") ?? "");
  if (!pageId) redirect(ADMIN_PAGES_PATH);

  await adminRefreshSeoPageLibraryReferences(pageId, {
    actorId: admin.user.id,
  });
  revalidatePath(`${ADMIN_PAGES_PATH}/${pageId}`);
  redirect(`${ADMIN_PAGES_PATH}/${pageId}?saved=1`);
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
    draftContent,
    intent: formData.get("intent") ?? "save",
  });

  if (!parsed.success) {
    return { success: false as const, message: firstIssue(parsed.error) };
  }

  return { success: true as const, data: parsed.data };
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
    message: "Could not insert AI proposal blocks.",
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
        message: "AI blocks were inserted but the updated draft is invalid.",
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

function nullable(value: string) {
  return value.length > 0 ? value : null;
}

function statusMessage(intent: "save" | "publish") {
  return intent === "publish" ? "Page published." : "Draft saved.";
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid page fields.";
}
