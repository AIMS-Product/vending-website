import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createEmptyPageContent,
  flattenBlocks,
  normalizeSlug,
  pageContentSchema,
  validatePageContent,
  type PageBuilderValidationIssue,
  type PageContent,
} from "@/lib/page-builder/blocks";
import {
  isBuilderRoutePath,
  normalizeRoutePrefix,
  pagePathForPage,
  pagePathForSlug,
} from "@/lib/page-builder/page-paths";
import { normalizePageTemplateSelection } from "@/lib/page-builder/page-templates";
import { assessSeoReadiness } from "@/lib/page-builder/seo-readiness";
import {
  defaultStructuredDataSettings,
  parseStructuredDataSettings,
} from "@/lib/page-builder/structured-data-settings";
import { config } from "@/lib/config";
import { collectMediaAssetReferences } from "@/lib/media/referenced-assets";
import {
  buildSeoPageDraftPatch,
  draftSettingsToSeoPagePatch,
  effectivePublishSettings,
  parseSeoPageDraftSettings,
} from "@/lib/services/seo-page-draft-patches";
import {
  buildSeoSnapshot,
  seoPatchFromSnapshot,
} from "@/lib/services/seo-page-snapshots";
import { deriveCopySlug } from "@/lib/services/duplicate-slug";
import { validateMediaAssetReferences } from "@/lib/services/media-assets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables, TablesInsert } from "@/types/database";
import type { SaveSeoPageDraftInput } from "@/lib/services/seo-page-draft-patches";

export type {
  SaveSeoPageDraftInput,
  SeoPageDraftSettings,
} from "@/lib/services/seo-page-draft-patches";

type SeoPage = Tables<"seo_pages">;
type PageRevision = Tables<"page_revisions">;
type MediaAsset = Tables<"media_assets">;
type CtaPreset = Tables<"cta_presets">;
type ProofItem = Tables<"proof_items">;
type SeoPageClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

type ServiceDeps = {
  client?: SeoPageClient;
  now?: () => Date;
};

export type CreateSeoPageInput = {
  slug: string;
  routePrefix?: string | null;
  title: string;
  targetKeyword?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  pageType?: string;
  templateKey?: string;
  draftContent?: unknown;
  createdBy?: string | null;
};

export type PublishSeoPageOptions = ServiceDeps & {
  actorId?: string | null;
  publishNote?: string | null;
};

export type ArchiveSeoPageOptions = ServiceDeps & {
  actorId?: string | null;
  archiveBehavior?: "not_found" | "redirect";
  archiveRedirectUrl?: string | null;
  currentSlug?: string | null;
};

export type SeoPageListOptions = {
  status?: SeoPage["status"];
};

export type CreatePreviewTokenOptions = ServiceDeps & {
  actorId?: string | null;
  expiresInHours?: number;
  now?: () => Date;
  token?: string;
};

export type DuplicateSeoPageOptions = ServiceDeps & {
  actorId?: string | null;
  now?: () => Date;
};

export type UpdateBuilderRedirectInput = {
  id: string;
  sourcePath: string;
  destinationPath: string;
  statusCode?: number;
};

export type CreateBuilderRedirectInput = {
  sourcePath: string;
  destinationPath: string;
  statusCode?: number;
  pageId?: string | null;
  createdBy?: string | null;
  createdReason?: string;
};

export type CreatePageCommentInput = {
  pageId: string;
  blockId?: string | null;
  body: string;
  createdBy?: string | null;
};

export type PreviewSeoPage = Omit<SeoPage, "published_content"> & {
  published_content: PageContent;
};

export class SeoPageValidationError extends Error {
  issues: PageBuilderValidationIssue[];

  constructor(issues: PageBuilderValidationIssue[]) {
    super("Invalid SEO page");
    this.name = "SeoPageValidationError";
    this.issues = issues;
  }
}

const SEO_PAGE_FIELDS =
  "id, slug, route_prefix, route_path, title, status, target_keyword, page_type, template_key, draft_content, draft_settings, published_content, published_revision_id, seo_title, meta_description, canonical_url, noindex, sitemap_enabled, og_asset_id, og_title, og_description, structured_data_settings, internal_tags, topic_cluster, campaign_label, funnel_stage, review_period_months, next_review_at, lifecycle_status, scheduled_publish_at, scheduled_publish_status, scheduled_publish_error, scheduled_publish_attempts, scheduled_publish_last_attempt_at, scheduled_publish_locked_at, footer_variant, published_at, archived_at, archive_behavior, archive_redirect_url, created_by, updated_by, created_at, updated_at" as const;

const PAGE_REVISION_FIELDS =
  "id, page_id, revision_type, label, content_snapshot, seo_snapshot, created_by, created_at" as const;

const PAGE_PREVIEW_TOKEN_FIELDS =
  "id, page_id, token_prefix, expires_at, revoked_at, created_by, created_at" as const;

const BUILDER_REDIRECT_FIELDS =
  "id, source_path, destination_path, status_code, page_id, created_reason, created_by, created_at" as const;

export async function adminListSeoPages(
  { status }: SeoPageListOptions = {},
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  let query = client
    .from("seo_pages")
    .select(SEO_PAGE_FIELDS)
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error("Could not list SEO pages.");
  return data ?? [];
}

export async function adminGetSeoPageById(
  pageId: string,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("seo_pages")
    .select(SEO_PAGE_FIELDS)
    .eq("id", pageId)
    .maybeSingle();

  if (error) throw new Error("Could not load SEO page.");
  return data;
}

export async function adminCreateSeoPage(
  input: CreateSeoPageInput,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const templateSelection = parseTemplateSelection(input);
  const draftContent = parseDraftContent(
    input.draftContent ?? templateSelection.content ?? createEmptyPageContent(),
  );

  const row: TablesInsert<"seo_pages"> = {
    slug: normalizeSlug(input.slug),
    route_prefix: normalizeRoutePrefix(
      input.routePrefix,
      templateSelection.pageType,
    ),
    title: input.title.trim(),
    status: "draft",
    target_keyword: input.targetKeyword ?? null,
    seo_title: input.seoTitle ?? null,
    meta_description: input.metaDescription ?? null,
    page_type: templateSelection.pageType,
    template_key: templateSelection.templateKey,
    draft_content: draftContent as unknown as Json,
    structured_data_settings: defaultStructuredDataSettings as unknown as Json,
    created_by: input.createdBy ?? null,
    updated_by: input.createdBy ?? null,
  };
  row.route_path = pagePathForSlug(row.slug, row.route_prefix);

  const { data, error } = await client
    .from("seo_pages")
    .insert(row)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) {
    throwSeoPageMutationError(
      error,
      "Could not create SEO page.",
      row.route_path,
    );
  }
  return data;
}

export async function adminDuplicateSeoPage(
  pageId: string,
  options: DuplicateSeoPageOptions = {},
) {
  const client = options.client ?? createAdminClient();
  const source = await adminGetSeoPageById(pageId, { client });
  if (!source) throw new Error("Could not load SEO page.");

  const title = `Copy of ${source.title}`;
  const routePrefix = normalizeRoutePrefix(
    source.route_prefix,
    source.page_type,
  );
  // Human-readable duplicate slug ({source}-copy, -copy-2, …). Collision scope
  // matches the DB's seo_pages_active_route_path_unique_idx: route_path among
  // non-archived pages (archived pages do not reserve a slug).
  const slug = await deriveCopySlug(source.slug, async (candidate) =>
    isActiveRoutePathTaken(client, pagePathForSlug(candidate, routePrefix)),
  );

  const duplicated = await adminCreateSeoPage(
    {
      slug,
      routePrefix,
      title,
      targetKeyword: source.target_keyword,
      seoTitle: source.seo_title,
      metaDescription: source.meta_description,
      pageType: source.page_type,
      templateKey: source.template_key,
      draftContent: source.draft_content,
      createdBy: options.actorId ?? null,
    },
    { client },
  );

  await adminSaveSeoPageDraft(
    duplicated.id,
    {
      title,
      slug,
      routePrefix,
      targetKeyword: source.target_keyword,
      seoTitle: source.seo_title,
      metaDescription: source.meta_description,
      canonicalUrl: source.canonical_url,
      noindex: source.noindex,
      sitemapEnabled: source.sitemap_enabled,
      structuredDataSettings: parseStructuredDataSettings(
        source.structured_data_settings,
      ),
      draftContent: parseDraftContent(source.draft_content),
      updatedBy: options.actorId ?? null,
    },
    { client },
  );

  return duplicated;
}

function parseTemplateSelection(input: CreateSeoPageInput) {
  try {
    return normalizePageTemplateSelection({
      pageType: input.pageType,
      templateKey: input.templateKey,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid page template.";
    throw new SeoPageValidationError([
      {
        code:
          message === "Unknown page type."
            ? "invalid_page_type"
            : "invalid_template",
        path: message === "Unknown page type." ? "pageType" : "templateKey",
        message,
      },
    ]);
  }
}

export async function adminSaveSeoPageDraft(
  pageId: string,
  input: SaveSeoPageDraftInput,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const patch = buildSeoPageDraftPatch(input, parseDraftContent);

  const { data, error } = await client
    .from("seo_pages")
    .update(patch)
    .eq("id", pageId)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) {
    throwSeoPageMutationError(
      error,
      "Could not save SEO page draft.",
      typeof patch.route_path === "string" ? patch.route_path : undefined,
    );
  }
  return data;
}

export async function adminPublishSeoPage(
  pageId: string,
  options: PublishSeoPageOptions = {},
): Promise<{ page: SeoPage; revision: PageRevision }> {
  const client = options.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const page = await loadSeoPageForPublish(client, pageId);
  const publishSettings = effectivePublishSettings(page);
  const draftContent = await resolveReusableContent(
    client,
    parseDraftContent(page.draft_content),
  );

  const readiness = assessSeoReadiness(draftContent, {
    slug: publishSettings.slug,
    title: publishSettings.title,
    targetKeyword: publishSettings.targetKeyword,
    seoTitle: publishSettings.seoTitle,
    metaDescription: publishSettings.metaDescription,
    canonicalUrl: publishSettings.canonicalUrl,
    noindex: publishSettings.noindex,
    sitemapEnabled: publishSettings.sitemapEnabled,
    structuredDataSettings: publishSettings.structuredDataSettings,
  });
  if (readiness.blockers.length > 0) {
    throw new SeoPageValidationError(
      readiness.blockers.map(({ code, path, message }) => ({
        code,
        path,
        message,
      })),
    );
  }

  const issues: PageBuilderValidationIssue[] = [];
  const redirectConflict = await findRedirectBySourcePath(
    client,
    publishSettings.routePath,
  );
  if (redirectConflict) {
    issues.push({
      code: "redirect_conflict",
      path: "slug",
      message: "A database redirect already owns this page path.",
    });
  }

  const duplicateMetadataIssues = await findDuplicateMetadataIssues(client, {
    id: page.id,
    seo_title: publishSettings.seoTitle,
    meta_description: publishSettings.metaDescription,
  });
  issues.push(...duplicateMetadataIssues);

  const mediaValidation = await validateReferencedMedia(client, draftContent);
  issues.push(...mediaValidation.issues);
  if (issues.length > 0) throw new SeoPageValidationError(issues);

  const publishedContent = resolvePublishedContent(
    draftContent,
    mediaValidation.assets,
  );
  const publishedAt = now().toISOString();
  const { data, error } = await client.rpc("publish_seo_page_atomically", {
    p_page_id: pageId,
    p_slug: publishSettings.slug,
    p_route_prefix: publishSettings.routePrefix,
    p_route_path: publishSettings.routePath,
    p_title: publishSettings.title,
    p_target_keyword: publishSettings.targetKeyword,
    p_seo_title: publishSettings.seoTitle,
    p_meta_description: publishSettings.metaDescription,
    p_canonical_url: publishSettings.canonicalUrl,
    p_noindex: publishSettings.noindex,
    p_sitemap_enabled: publishSettings.sitemapEnabled,
    p_structured_data_settings:
      publishSettings.structuredDataSettings as unknown as Json,
    p_published_content: publishedContent as unknown as Json,
    p_seo_snapshot: buildSeoSnapshot(page, publishSettings),
    p_actor_id: options.actorId ?? null,
    p_published_at: publishedAt,
    p_revision_label: publishRevisionLabel(publishedAt, options.publishNote),
  });

  if (error) {
    throwSeoPageMutationError(
      error,
      "Could not publish SEO page.",
      publishSettings.routePath,
    );
  }
  const result = parseAtomicRevisionResult(data, "Could not publish SEO page.");
  try {
    await capturePublishedBlocks(client, result.page, result.revision);
  } catch (error) {
    console.error("failed to capture published page content", {
      pageId: result.page.id,
      revisionId: result.revision.id,
      error,
    });
  }
  return {
    page: await clearPublishedScheduleStateBestEffort(client, result.page),
    revision: result.revision,
  };
}

async function clearPublishedScheduleStateBestEffort(
  client: SeoPageClient,
  page: SeoPage,
) {
  try {
    return await clearPublishedScheduleState(client, page);
  } catch (error) {
    console.error("failed to clear published schedule state", {
      pageId: page.id,
      error,
    });
    return page;
  }
}

async function clearPublishedScheduleState(
  client: SeoPageClient,
  page: SeoPage,
) {
  if (
    page.scheduled_publish_status !== "scheduled" &&
    page.scheduled_publish_status !== "failed" &&
    page.scheduled_publish_status !== "cancelled" &&
    !page.scheduled_publish_at &&
    !page.scheduled_publish_error &&
    !page.scheduled_publish_attempts &&
    !page.scheduled_publish_last_attempt_at &&
    !page.scheduled_publish_locked_at
  ) {
    return page;
  }

  const { data, error } = await client
    .from("seo_pages")
    .update({
      scheduled_publish_at: null,
      scheduled_publish_error: null,
      scheduled_publish_attempts: 0,
      scheduled_publish_last_attempt_at: null,
      scheduled_publish_locked_at: null,
      scheduled_publish_status: "published",
    })
    .eq("id", page.id)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) throw new Error("Could not clear scheduled publish state.");
  return data;
}

async function capturePublishedBlocks(
  client: SeoPageClient,
  page: SeoPage,
  revision: PageRevision,
) {
  const revisionContent = validatePageContent(revision.content_snapshot);
  const pageContent = validatePageContent(page.published_content);
  const content = revisionContent.ok
    ? revisionContent.content
    : pageContent.ok
      ? pageContent.content
      : null;
  if (!content) return;
  const blocks = flattenBlocks(content);
  const internalTags = Array.isArray(page.internal_tags)
    ? page.internal_tags
    : [];
  const rows = blocks.map((block) => ({
    source_page_id: page.id,
    source_revision_id: revision.id,
    source_block_id: block.id,
    block_type: block.type,
    block_variant: block.variant,
    page_type: page.page_type,
    route_path: page.route_path,
    title: page.title,
    payload: block as unknown as Json,
    internal_tags: internalTags,
    provenance: {
      source: "publish",
      pageTitle: page.title,
      publishedAt: page.published_at,
    } as Json,
  }));

  if (rows.length === 0) return;
  const { error } = await client
    .from("page_builder_content_pieces")
    .upsert(rows, { onConflict: "source_revision_id,source_block_id" });
  if (error) throw new Error("Could not capture published page content.");
}

export async function adminUnpublishSeoPage(
  pageId: string,
  options: ServiceDeps & { actorId?: string | null } = {},
) {
  const client = options.client ?? createAdminClient();
  const existing = await loadSeoPageScheduleState(client, pageId);
  const { data, error } = await client
    .from("seo_pages")
    .update({
      status: "draft",
      published_at: null,
      published_content: null,
      published_revision_id: null,
      archived_at: null,
      archive_behavior: "not_found",
      archive_redirect_url: null,
      // Moving to draft is an explicit takedown: a pending schedule must not
      // republish the page behind the admin's back.
      scheduled_publish_at: null,
      scheduled_publish_status:
        existing.scheduled_publish_status === "scheduled" ||
        existing.scheduled_publish_status === "failed"
          ? "cancelled"
          : existing.scheduled_publish_status,
      scheduled_publish_error: null,
      scheduled_publish_locked_at: null,
      updated_by: options.actorId ?? null,
    })
    .eq("id", pageId)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) throw new Error("Could not move SEO page to draft.");
  await deleteArchivedPageRedirects(client, pageId);
  return data;
}

export async function adminUpdateSeoPageSlug(
  pageId: string,
  slug: string,
  options: ServiceDeps & {
    actorId?: string | null;
    routePrefix?: string | null;
  } = {},
) {
  const client = options.client ?? createAdminClient();
  const nextSlug = normalizeSlug(slug);
  const nextRoutePrefix = normalizeRoutePrefix(options.routePrefix);
  const nextRoutePath = pagePathForSlug(nextSlug, nextRoutePrefix);
  const page = await loadSeoPageSlugState(client, pageId);

  if (page.slug === nextSlug && page.route_path === nextRoutePath) return page;

  if (page.status === "published") {
    const { data, error } = await client.rpc(
      "update_seo_page_slug_with_redirect",
      {
        p_page_id: pageId,
        p_next_slug: nextSlug,
        p_next_route_prefix: nextRoutePrefix,
        p_next_route_path: nextRoutePath,
        p_actor_id: options.actorId ?? null,
      },
    );
    if (error) {
      throwSeoPageMutationError(
        error,
        "Could not update SEO page slug.",
        nextRoutePath,
      );
    }
    if (!data) throw new Error("Could not update SEO page slug.");
    return data as SeoPage;
  }

  const { data, error } = await client
    .from("seo_pages")
    .update({
      slug: nextSlug,
      route_prefix: nextRoutePrefix,
      route_path: nextRoutePath,
      updated_by: options.actorId ?? null,
    })
    .eq("id", pageId)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) {
    throwSeoPageMutationError(
      error,
      "Could not update SEO page slug.",
      nextRoutePath,
    );
  }
  return data;
}

export async function adminArchiveSeoPage(
  pageId: string,
  options: ArchiveSeoPageOptions = {},
) {
  const client = options.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const behavior = options.archiveBehavior ?? "not_found";
  let archiveRedirectUrl = options.archiveRedirectUrl ?? null;

  if (behavior === "redirect") {
    if (!archiveRedirectUrl) {
      throw new SeoPageValidationError([
        {
          code: "missing_archive_redirect",
          path: "archive_redirect_url",
          message: "Archived pages using redirects need a destination.",
        },
      ]);
    }

    archiveRedirectUrl = normalizeDestinationPath(archiveRedirectUrl);
    if (!options.currentSlug) {
      // Self-redirects against a caller-supplied slug are enforced inside the
      // RPC, which knows the page's real route prefix without an extra read.
      const slugState = await loadSeoPageSlugState(client, pageId);
      validateRedirectPaths(pagePathForPage(slugState), archiveRedirectUrl);
    }
  }

  const { data, error } = await client.rpc("archive_seo_page_atomically", {
    p_page_id: pageId,
    p_archive_behavior: behavior,
    p_archive_redirect_url: archiveRedirectUrl,
    p_current_slug: options.currentSlug ?? null,
    p_actor_id: options.actorId ?? null,
    p_archived_at: now().toISOString(),
  });

  if (error) throw new Error("Could not archive SEO page.");
  return parseAtomicPageResult(data, "Could not archive SEO page.");
}

export async function adminRefreshSeoPageLibraryReferences(
  pageId: string,
  options: ServiceDeps & { actorId?: string | null } = {},
) {
  const client = options.client ?? createAdminClient();
  const page = await adminGetSeoPageById(pageId, { client });
  if (!page) throw new Error("Could not load SEO page.");
  const refreshedContent = await resolveReusableContent(
    client,
    parseDraftContent(page.draft_content),
  );

  const { data, error } = await client.rpc(
    "apply_seo_page_revision_update_atomically",
    {
      p_page_id: pageId,
      p_revision_type: "manual_save",
      p_revision_label: "Refresh library references",
      p_content_snapshot: refreshedContent as unknown as Json,
      p_seo_snapshot: buildSeoSnapshot(page),
      p_draft_content: refreshedContent as unknown as Json,
      p_seo_patch: {},
      p_actor_id: options.actorId ?? null,
    },
  );

  if (error) throw new Error("Could not refresh SEO page libraries.");
  return parseAtomicRevisionResult(
    data,
    "Could not refresh SEO page libraries.",
  );
}

export async function adminListSeoPageRevisions(
  pageId: string,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("page_revisions")
    .select(PAGE_REVISION_FIELDS)
    .eq("page_id", pageId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Could not list SEO page revisions.");
  return data ?? [];
}

const MANUAL_SAVE_REVISIONS_KEPT = 20;

// Snapshot the current draft as an immutable `manual_save` revision, then prune
// older manual_save revisions for the page so only the newest N survive.
// The save itself has already committed before this runs — callers must treat
// a thrown error here as non-fatal (the user's draft is safe regardless).
export async function adminSnapshotManualSaveRevision(
  pageId: string,
  options: {
    actorId?: string | null;
    keepRevisions?: number;
    now?: () => Date;
  } = {},
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const page = await adminGetSeoPageById(pageId, { client });
  if (!page) throw new Error("Could not load SEO page to snapshot.");

  const { data: revision, error } = await client
    .from("page_revisions")
    .insert({
      page_id: pageId,
      revision_type: "manual_save",
      label: `Manual save • ${now().toISOString()}`,
      content_snapshot: page.draft_content as unknown as Json,
      seo_snapshot: buildSeoSnapshot(page),
      created_by: options.actorId ?? null,
    })
    .select(PAGE_REVISION_FIELDS)
    .single();
  if (error) throw new Error("Could not snapshot manual save revision.");

  const keep = options.keepRevisions ?? MANUAL_SAVE_REVISIONS_KEPT;
  const { data: pruned, error: pruneError } = await client.rpc(
    "prune_seo_page_manual_save_revisions",
    { p_page_id: pageId, p_keep: keep },
  );
  if (pruneError) throw new Error("Could not prune manual save revisions.");

  return { revision, pruned: pruned ?? 0 };
}

export async function adminGetSeoPageRevision(
  pageId: string,
  revisionId: string,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("page_revisions")
    .select(PAGE_REVISION_FIELDS)
    .match({ page_id: pageId, id: revisionId })
    .maybeSingle();

  if (error) throw new Error("Could not load SEO page revision.");
  return data;
}

export async function adminRollbackSeoPageRevision(
  pageId: string,
  revisionId: string,
  options: ServiceDeps & { actorId?: string | null } = {},
) {
  const client = options.client ?? createAdminClient();
  const revision = await adminGetSeoPageRevision(pageId, revisionId, {
    client,
  });
  if (!revision) throw new Error("Could not load SEO page revision.");

  const draftContent = parseDraftContent(revision.content_snapshot);
  const seoPatch = seoPatchFromSnapshot(revision.seo_snapshot);
  const { data, error } = await client.rpc(
    "apply_seo_page_revision_update_atomically",
    {
      p_page_id: pageId,
      p_revision_type: "rollback",
      p_revision_label: `Restore draft from ${revision.label ?? revision.id}`,
      p_content_snapshot: draftContent as unknown as Json,
      p_seo_snapshot: revision.seo_snapshot,
      p_draft_content: draftContent as unknown as Json,
      p_seo_patch: seoPatch as unknown as Json,
      p_actor_id: options.actorId ?? null,
    },
  );

  if (error) throw new Error("Could not rollback SEO page revision.");
  return parseAtomicRevisionResult(
    data,
    "Could not rollback SEO page revision.",
  );
}

export async function adminListSeoPagePreviewTokens(
  pageId: string,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("page_preview_tokens")
    .select(PAGE_PREVIEW_TOKEN_FIELDS)
    .eq("page_id", pageId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Could not list SEO page preview tokens.");
  return data ?? [];
}

export async function adminListBuilderRedirects(deps: ServiceDeps = {}) {
  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("redirects")
    .select(
      "id, source_path, destination_path, status_code, page_id, created_reason, created_by, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not list builder redirects.");
  return data ?? [];
}

export async function adminCreateBuilderRedirect(
  input: CreateBuilderRedirectInput,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const sourcePath = normalizeSourcePath(input.sourcePath);
  const destinationPath = normalizeDestinationPath(input.destinationPath);
  validateRedirectPaths(sourcePath, destinationPath);
  const statusCode = input.statusCode ?? 301;
  if (![301, 302, 307, 308].includes(statusCode)) {
    throw new SeoPageValidationError([
      {
        code: "invalid_redirect_status",
        path: "status_code",
        message: "Choose a supported redirect status.",
      },
    ]);
  }

  const { data, error } = await client
    .from("redirects")
    .insert({
      source_path: sourcePath,
      destination_path: destinationPath,
      status_code: statusCode,
      page_id: input.pageId ?? null,
      created_by: input.createdBy ?? null,
      created_reason: input.createdReason ?? "manual",
    })
    .select(
      "id, source_path, destination_path, status_code, page_id, created_reason, created_by, created_at",
    )
    .single();
  if (error) {
    throwSeoPageMutationError(error, "Could not create redirect.", sourcePath);
  }
  return data;
}

export async function adminUpdateBuilderRedirect(
  input: UpdateBuilderRedirectInput,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const id = input.id.trim();
  if (!id) {
    throw new SeoPageValidationError([
      {
        code: "missing_redirect_id",
        path: "id",
        message: "Choose which redirect to update.",
      },
    ]);
  }
  const sourcePath = normalizeSourcePath(input.sourcePath);
  const destinationPath = normalizeDestinationPath(input.destinationPath);
  validateRedirectPaths(sourcePath, destinationPath);
  const statusCode = assertRedirectStatusCode(input.statusCode ?? 301);

  const { data, error } = await client
    .from("redirects")
    .update({
      source_path: sourcePath,
      destination_path: destinationPath,
      status_code: statusCode,
    })
    .eq("id", id)
    .select(BUILDER_REDIRECT_FIELDS)
    .maybeSingle();
  if (error) {
    throwSeoPageMutationError(error, "Could not update redirect.", sourcePath);
  }
  if (!data) {
    throw new SeoPageValidationError([
      {
        code: "redirect_not_found",
        path: "id",
        message: "That redirect no longer exists. Refresh and try again.",
      },
    ]);
  }
  return data;
}

export async function adminDeleteBuilderRedirect(
  id: string,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const redirectId = id.trim();
  if (!redirectId) {
    throw new SeoPageValidationError([
      {
        code: "missing_redirect_id",
        path: "id",
        message: "Choose which redirect to delete.",
      },
    ]);
  }

  const { data, error } = await client
    .from("redirects")
    .delete()
    .eq("id", redirectId)
    .select("id");
  if (error) throw new Error("Could not delete redirect.");
  if (!data || data.length === 0) {
    throw new SeoPageValidationError([
      {
        code: "redirect_not_found",
        path: "id",
        message: "That redirect no longer exists. Refresh and try again.",
      },
    ]);
  }
  return { id: redirectId };
}

function assertRedirectStatusCode(statusCode: number) {
  if (![301, 302, 307, 308].includes(statusCode)) {
    throw new SeoPageValidationError([
      {
        code: "invalid_redirect_status",
        path: "status_code",
        message: "Choose a supported redirect status.",
      },
    ]);
  }
  return statusCode;
}

export async function adminListPageComments(
  pageId: string,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("page_builder_comments")
    .select(
      "id, page_id, block_id, body, resolved_at, resolved_by, created_by, created_at, updated_at",
    )
    .eq("page_id", pageId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not list page comments.");
  return data ?? [];
}

export async function adminCreatePageComment(
  input: CreatePageCommentInput,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const body = input.body.trim();
  if (body.length < 2) throw new Error("Comment body is required.");
  const { data, error } = await client
    .from("page_builder_comments")
    .insert({
      page_id: input.pageId,
      block_id: input.blockId ?? null,
      body,
      created_by: input.createdBy ?? null,
    })
    .select(
      "id, page_id, block_id, body, resolved_at, resolved_by, created_by, created_at, updated_at",
    )
    .single();
  if (error) throw new Error("Could not create page comment.");
  return data;
}

export async function adminResolvePageComment(
  commentId: string,
  options: ServiceDeps & { actorId?: string | null; now?: () => Date } = {},
) {
  const client = options.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const { data, error } = await client
    .from("page_builder_comments")
    .update({
      resolved_at: now().toISOString(),
      resolved_by: options.actorId ?? null,
    })
    .eq("id", commentId)
    .select(
      "id, page_id, block_id, body, resolved_at, resolved_by, created_by, created_at, updated_at",
    )
    .single();
  if (error) throw new Error("Could not resolve page comment.");
  return data;
}

export async function adminCreateSeoPagePreviewToken(
  pageId: string,
  options: CreatePreviewTokenOptions = {},
) {
  const client = options.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const createdAt = now();
  const expiresInHours = options.expiresInHours ?? 72;
  const expiresAt = new Date(
    createdAt.getTime() + expiresInHours * 60 * 60 * 1000,
  );
  if (expiresAt <= createdAt) {
    throw new SeoPageValidationError([
      {
        code: "invalid_preview_expiry",
        path: "expires_at",
        message: "Preview links must expire in the future.",
      },
    ]);
  }

  const token = options.token ?? randomBytes(32).toString("base64url");
  const { data, error } = await client
    .from("page_preview_tokens")
    .insert({
      page_id: pageId,
      token_hash: hashPreviewToken(token),
      token_prefix: token.slice(0, 8),
      expires_at: expiresAt.toISOString(),
      created_by: options.actorId ?? null,
      created_at: createdAt.toISOString(),
    })
    .select(PAGE_PREVIEW_TOKEN_FIELDS)
    .single();

  if (error) throw new Error("Could not create SEO page preview link.");
  return {
    token,
    previewPath: `/resources/preview/${token}`,
    row: data,
  };
}

export async function adminRevokeSeoPagePreviewToken(
  tokenId: string,
  options: ServiceDeps & { now?: () => Date } = {},
) {
  const client = options.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const { data, error } = await client
    .from("page_preview_tokens")
    .update({ revoked_at: now().toISOString() })
    .eq("id", tokenId)
    .select(PAGE_PREVIEW_TOKEN_FIELDS)
    .single();

  if (error) throw new Error("Could not revoke SEO page preview link.");
  return data;
}

export async function getSeoPagePreviewByToken(
  token: string,
  options: ServiceDeps & { now?: () => Date } = {},
): Promise<PreviewSeoPage | null> {
  const client = options.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const { data: tokenRow, error: tokenError } = await client
    .from("page_preview_tokens")
    .select("id, page_id, expires_at, revoked_at")
    .eq("token_hash", hashPreviewToken(token))
    .maybeSingle();

  if (tokenError) throw new Error("Could not load SEO page preview link.");
  if (!tokenRow || tokenRow.revoked_at) return null;
  if (new Date(tokenRow.expires_at).getTime() <= now().getTime()) return null;

  const page = await adminGetSeoPageById(tokenRow.page_id, { client });
  if (!page) return null;

  const draftContent = parseDraftContent(page.draft_content);
  const draftSettings = parseSeoPageDraftSettings(
    page.draft_settings,
    parseStructuredDataSettings(page.structured_data_settings),
  );
  return {
    ...page,
    ...draftSettingsToSeoPagePatch(draftSettings),
    published_content: draftContent,
  };
}

export async function hasActiveSeoPagePreviewToken(
  token: string,
  options: ServiceDeps & { now?: () => Date } = {},
) {
  const client = options.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const { data: tokenRow, error } = await client
    .from("page_preview_tokens")
    .select("id, expires_at, revoked_at")
    .eq("token_hash", hashPreviewToken(token))
    .maybeSingle();

  if (error) throw new Error("Could not load SEO page preview link.");
  if (!tokenRow || tokenRow.revoked_at) return false;
  return new Date(tokenRow.expires_at).getTime() > now().getTime();
}

function hashPreviewToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseDraftContent(content: unknown): PageContent {
  const result = validatePageContent(content);
  if (!result.ok) throw new SeoPageValidationError(result.issues);
  return result.content;
}

async function loadSeoPageForPublish(client: SeoPageClient, pageId: string) {
  const { data, error } = await client
    .from("seo_pages")
    .select(SEO_PAGE_FIELDS)
    .eq("id", pageId)
    .single();

  if (error || !data) throw new Error("Could not load SEO page.");
  return data;
}

async function loadSeoPageScheduleState(client: SeoPageClient, pageId: string) {
  const { data, error } = await client
    .from("seo_pages")
    .select("id, scheduled_publish_status")
    .eq("id", pageId)
    .single();

  if (error || !data) throw new Error("Could not load SEO page.");
  return data;
}

async function loadSeoPageSlugState(client: SeoPageClient, pageId: string) {
  const { data, error } = await client
    .from("seo_pages")
    .select("id, slug, route_prefix, route_path, page_type, status")
    .eq("id", pageId)
    .single();

  if (error || !data) throw new Error("Could not load SEO page slug.");
  return data;
}

function parseAtomicRevisionResult(
  data: unknown,
  errorMessage: string,
): { page: SeoPage; revision: PageRevision } {
  if (!isRecord(data) || !isRecord(data.page) || !isRecord(data.revision)) {
    throw new Error(errorMessage);
  }
  return {
    page: data.page as SeoPage,
    revision: data.revision as PageRevision,
  };
}

function parseAtomicPageResult(data: unknown, errorMessage: string): SeoPage {
  if (!isRecord(data)) throw new Error(errorMessage);
  return data as SeoPage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function throwSeoPageMutationError(
  error: unknown,
  fallbackMessage: string,
  slug?: string,
): never {
  if (isDuplicateSeoPageSlugError(error)) {
    throw new SeoPageValidationError([
      {
        code: "duplicate_slug",
        path: "slug",
        message: `Another active page already uses ${slug ?? "this path"}. Choose a different slug or prefix.`,
      },
    ]);
  }
  throw new Error(fallbackMessage);
}

function isDuplicateSeoPageSlugError(error: unknown) {
  if (!isRecord(error)) return false;
  const text = [
    error.code,
    error.message,
    error.details,
    error.hint,
    error.constraint,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return (
    text.includes("23505") &&
    (text.includes("slug") || text.includes("route_path"))
  );
}

async function deleteArchivedPageRedirects(
  client: SeoPageClient,
  pageId: string,
) {
  const { error } = await client
    .from("redirects")
    .delete()
    .match({ page_id: pageId, created_reason: "page_archived" });

  if (error) throw new Error("Could not clear archived SEO page redirect.");
}

// True when a non-archived page already owns this route_path — the exact scope
// of seo_pages_active_route_path_unique_idx, so a duplicate slug we hand back
// can be inserted without tripping the unique index.
async function isActiveRoutePathTaken(
  client: SeoPageClient,
  routePath: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("seo_pages")
    .select("id")
    .eq("route_path", routePath)
    .neq("status", "archived")
    .maybeSingle();

  if (error) throw new Error("Could not check duplicate slug availability.");
  return data !== null;
}

async function findRedirectBySourcePath(
  client: SeoPageClient,
  sourcePath: string,
) {
  const { data, error } = await client
    .from("redirects")
    .select("id, source_path")
    .eq("source_path", sourcePath)
    .maybeSingle();

  if (error) throw new Error("Could not check redirect conflicts.");
  return data;
}

async function findDuplicateMetadataIssues(
  client: SeoPageClient,
  page: Pick<SeoPage, "id" | "seo_title" | "meta_description">,
): Promise<PageBuilderValidationIssue[]> {
  const seoTitle = normalizeMetadataValue(page.seo_title);
  const metaDescription = normalizeMetadataValue(page.meta_description);
  if (!seoTitle && !metaDescription) return [];

  const [titleConflict, descriptionConflict] = await Promise.all([
    seoTitle
      ? findMetadataConflict(client, page.id, "seo_title", seoTitle)
      : Promise.resolve(null),
    metaDescription
      ? findMetadataConflict(
          client,
          page.id,
          "meta_description",
          metaDescription,
        )
      : Promise.resolve(null),
  ]);

  const issues: PageBuilderValidationIssue[] = [];
  if (titleConflict) {
    issues.push({
      code: "duplicate_seo_title",
      path: "seo_title",
      message: `Another page already uses this SEO title: ${pagePathForPage(titleConflict)}.`,
    });
  }
  if (descriptionConflict) {
    issues.push({
      code: "duplicate_meta_description",
      path: "meta_description",
      message: `Another page already uses this meta description: ${pagePathForPage(descriptionConflict)}.`,
    });
  }
  return issues;
}

async function findMetadataConflict(
  client: SeoPageClient,
  pageId: string,
  column: "seo_title" | "meta_description",
  normalizedValue: string,
) {
  const { data, error } = await client
    .from("seo_pages")
    .select(
      "id, slug, route_prefix, route_path, page_type, seo_title, meta_description, status",
    )
    .neq("id", pageId)
    .neq("status", "archived")
    .ilike(column, metadataIlikePattern(normalizedValue));

  if (error) throw new Error("Could not check duplicate SEO metadata.");
  const candidates = data ?? [];
  return (
    candidates.find(
      (candidate) =>
        normalizeMetadataValue(candidate[column]) === normalizedValue,
    ) ?? null
  );
}

function normalizeMetadataValue(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() || "";
}

function metadataIlikePattern(normalizedValue: string) {
  return normalizedValue
    .replace(/[\\%_]/g, (match) => `\\${match}`)
    .replace(/\s+/g, "%");
}

async function resolveReusableContent(
  client: SeoPageClient,
  content: PageContent,
): Promise<PageContent> {
  const blocks = flattenBlocks(content);
  const ctaPresetIds = [
    ...new Set(
      blocks.flatMap((block) =>
        block.type === "cta" && block.props.presetId
          ? [block.props.presetId]
          : [],
      ),
    ),
  ];
  const proofItemIds = [
    ...new Set(
      blocks.flatMap((block) =>
        block.type === "proof" && block.props.proofItemId
          ? [block.props.proofItemId]
          : [],
      ),
    ),
  ];

  if (ctaPresetIds.length === 0 && proofItemIds.length === 0) {
    return content;
  }

  const issues: PageBuilderValidationIssue[] = [];
  const [ctaPresets, proofItems] = await Promise.all([
    loadCtaPresets(client, ctaPresetIds, issues),
    loadProofItems(client, proofItemIds, issues),
  ]);
  if (issues.length > 0) throw new SeoPageValidationError(issues);

  return {
    ...content,
    sections: content.sections.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        blocks: column.blocks.map((block) => {
          if (block.type === "cta" && block.props.presetId) {
            const preset = ctaPresets.get(block.props.presetId);
            if (!preset) return block;
            return {
              ...block,
              variant: ctaVariant(preset.style_preset, block.variant),
              props: {
                ...block.props,
                label: preset.label,
                href: preset.href,
                trackingName: preset.tracking_name,
              },
            };
          }
          if (block.type === "proof" && block.props.proofItemId) {
            const proof = proofItems.get(block.props.proofItemId);
            if (!proof) return block;
            return {
              ...block,
              variant: proof.kind === "stat" ? "stat" : "quote",
              props: {
                ...block.props,
                body: proof.body,
                name: proof.name ?? "",
                context: proof.role_or_context ?? "",
              },
            };
          }
          return block;
        }),
      })),
    })),
  };
}

async function loadCtaPresets(
  client: SeoPageClient,
  ids: string[],
  issues: PageBuilderValidationIssue[],
) {
  if (ids.length === 0) return new Map<string, CtaPreset>();
  const { data, error } = await client
    .from("cta_presets")
    .select("id, label, href, style_preset, tracking_name")
    .in("id", ids);

  if (error) throw new Error("Could not load CTA presets.");
  const rows = new Map((data ?? []).map((row) => [row.id, row as CtaPreset]));
  for (const id of ids) {
    if (!rows.has(id)) {
      issues.push({
        code: "missing_cta_preset",
        path: `cta_presets.${id}`,
        message: "Referenced CTA preset does not exist.",
      });
    }
  }
  return rows;
}

async function loadProofItems(
  client: SeoPageClient,
  ids: string[],
  issues: PageBuilderValidationIssue[],
) {
  if (ids.length === 0) return new Map<string, ProofItem>();
  const { data, error } = await client
    .from("proof_items")
    .select(
      "id, kind, name, role_or_context, body, source_rights_notes, approved",
    )
    .in("id", ids);

  if (error) throw new Error("Could not load proof items.");
  const rows = new Map((data ?? []).map((row) => [row.id, row as ProofItem]));
  for (const id of ids) {
    const row = rows.get(id);
    if (!row) {
      issues.push({
        code: "missing_proof_item",
        path: `proof_items.${id}`,
        message: "Referenced proof item does not exist.",
      });
      continue;
    }
    if (!row.approved) {
      issues.push({
        code: "unapproved_proof_item",
        path: `proof_items.${id}`,
        message: "Referenced proof items must be approved before publishing.",
      });
    }
    if (!row.source_rights_notes?.trim()) {
      issues.push({
        code: "missing_proof_rights",
        path: `proof_items.${id}.source_rights_notes`,
        message: "Referenced proof items require rights notes.",
      });
    }
  }
  return rows;
}

function ctaVariant(style: string, fallback: "primary" | "secondary" | "text") {
  if (style === "primary" || style === "secondary" || style === "text") {
    return style;
  }
  return fallback;
}

async function validateReferencedMedia(
  client: SeoPageClient,
  content: PageContent,
): Promise<{
  issues: PageBuilderValidationIssue[];
  assets: Map<string, MediaAsset>;
}> {
  const references = collectMediaAssetReferences(content);
  const assetIds = [
    ...new Set(references.map((reference) => reference.assetId)),
  ];

  if (assetIds.length === 0) {
    return { issues: [], assets: new Map() };
  }

  const { data, error } = await client
    .from("media_assets")
    .select(
      "id, asset_type, alt_text, source_rights_notes, storage_bucket, storage_path, external_url, caption, title",
    )
    .in("id", assetIds);

  if (error) throw new Error("Could not validate referenced media.");

  const rows = new Map((data ?? []).map((row) => [row.id, row as MediaAsset]));
  const issues: PageBuilderValidationIssue[] = validateMediaAssetReferences(
    references,
    rows,
  ).map((issue) => ({
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }));

  return { issues, assets: rows };
}

function resolvePublishedContent(
  content: PageContent,
  assets: Map<string, MediaAsset>,
): PageContent {
  if (assets.size === 0) return content;

  return {
    ...content,
    sections: content.sections.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        blocks: column.blocks.map((block) => {
          if (block.type === "image" && block.props.assetId) {
            const asset = assets.get(block.props.assetId);
            if (!asset) return block;
            return {
              ...block,
              props: {
                ...block.props,
                src: block.props.src || publicMediaUrl(asset),
                altText: block.props.altText || asset.alt_text || "",
                sourceRightsNotes:
                  block.props.sourceRightsNotes ||
                  asset.source_rights_notes ||
                  "",
              },
            };
          }

          if (block.type === "hero" && block.props.mediaAssetId) {
            const asset = assets.get(block.props.mediaAssetId);
            if (!asset) return block;
            return {
              ...block,
              props: {
                ...block.props,
                mediaSrc: block.props.mediaSrc || publicMediaUrl(asset),
                mediaAltText: block.props.mediaAltText || asset.alt_text || "",
                mediaCaption: block.props.mediaCaption || asset.caption || "",
              },
            };
          }

          if (block.type === "video" && block.props.assetId) {
            const asset = assets.get(block.props.assetId);
            if (!asset) return block;
            return {
              ...block,
              props: {
                ...block.props,
                url: block.props.url || asset.external_url || "",
                title: block.props.title || asset.title || "",
                caption: block.props.caption || asset.caption || "",
              },
            };
          }

          return block;
        }),
      })),
    })),
  };
}

function publicMediaUrl(asset: MediaAsset) {
  if (asset.external_url) return asset.external_url;
  if (asset.storage_bucket && asset.storage_path) {
    const base = config.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
    return `${base}/storage/v1/object/public/${asset.storage_bucket}/${asset.storage_path}`;
  }
  return "";
}

function publishRevisionLabel(
  publishedAt: string,
  publishNote?: string | null,
) {
  const note = publishNote?.trim();
  if (note) return `Publish: ${note.slice(0, 220)}`;
  return `Publish ${publishedAt}`;
}

function normalizeSourcePath(path: string) {
  const normalized = normalizeInternalPath(path);
  if (!isBuilderRoutePath(normalized)) {
    throw new SeoPageValidationError([
      {
        code: "invalid_redirect_source",
        path: "source_path",
        message: "Builder redirect sources must be builder page paths.",
      },
    ]);
  }
  return normalized;
}

function validateRedirectPaths(sourcePath: string, destinationPath: string) {
  const normalizedSource = normalizeSourcePath(sourcePath);
  const normalizedDestination = normalizeDestinationPath(destinationPath);
  if (normalizedSource === normalizedDestination) {
    throw new SeoPageValidationError([
      {
        code: "self_redirect",
        path: "destination_path",
        message: "Redirect source and destination must differ.",
      },
    ]);
  }
}

function normalizeDestinationPath(path: string) {
  const trimmed = path.trim();
  if (isRootRelativePath(trimmed)) {
    return normalizeInternalPath(trimmed);
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Fall through to validation error below.
  }

  throw new SeoPageValidationError([
    {
      code: "invalid_redirect_destination",
      path: "destination_path",
      message: "Redirect destination must be an internal path or http(s) URL.",
    },
  ]);
}

// Backslashes (raw or percent-encoded as %5C) are rejected because browsers
// normalize "\" to "/" in redirect targets, so "/\evil.com" resolves like the
// protocol-relative "//evil.com" and escapes the site despite looking like an
// internal path.
function isRootRelativePath(value: string) {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.toLowerCase().includes("%5c")
  );
}

function normalizeInternalPath(path: string) {
  const trimmed = path.trim();
  if (!isRootRelativePath(trimmed)) {
    throw new SeoPageValidationError([
      {
        code: "invalid_path",
        path: "path",
        message: "Path must be root-relative.",
      },
    ]);
  }
  if (trimmed.length > 1 && trimmed.endsWith("/")) {
    return trimmed.replace(/\/+$/, "");
  }
  return trimmed;
}

// Keep the schema visible to callers that need a stable parser without
// importing Zod internals from the block registry.
export const seoPageDraftContentSchema = pageContentSchema;
