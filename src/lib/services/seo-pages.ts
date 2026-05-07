import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createEmptyPageContent,
  flattenBlocks,
  normalizeSlug,
  pageContentSchema,
  resourcePathForSlug,
  validatePageContent,
  type PageBuilderValidationIssue,
  type PageContent,
} from "@/lib/page-builder/blocks";
import { assessSeoReadiness } from "@/lib/page-builder/seo-readiness";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables, TablesInsert } from "@/types/database";

type SeoPage = Tables<"seo_pages">;
type PageRevision = Tables<"page_revisions">;
type MediaAsset = Tables<"media_assets">;
type CtaPreset = Tables<"cta_presets">;
type ProofItem = Tables<"proof_items">;
type RedirectInsert = TablesInsert<"redirects">;
type SeoPageClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

type ServiceDeps = {
  client?: SeoPageClient;
  now?: () => Date;
};

export type CreateSeoPageInput = {
  slug: string;
  title: string;
  targetKeyword?: string | null;
  pageType?: string;
  templateKey?: string;
  draftContent?: unknown;
  createdBy?: string | null;
};

export type SaveSeoPageDraftInput = {
  slug?: string;
  title?: string;
  targetKeyword?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean;
  sitemapEnabled?: boolean;
  structuredDataSettings?: Json;
  draftContent?: unknown;
  updatedBy?: string | null;
};

export type PublishSeoPageOptions = ServiceDeps & {
  actorId?: string | null;
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
  "id, slug, title, status, target_keyword, page_type, template_key, draft_content, published_content, published_revision_id, seo_title, meta_description, canonical_url, noindex, sitemap_enabled, og_asset_id, structured_data_settings, published_at, archived_at, archive_behavior, archive_redirect_url, created_by, updated_by, created_at, updated_at" as const;

const PAGE_REVISION_FIELDS =
  "id, page_id, revision_type, label, content_snapshot, seo_snapshot, created_by, created_at" as const;

const PAGE_PREVIEW_TOKEN_FIELDS =
  "id, page_id, token_prefix, expires_at, revoked_at, created_by, created_at" as const;

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
  const draftContent = parseDraftContent(
    input.draftContent ?? createEmptyPageContent(),
  );

  const row: TablesInsert<"seo_pages"> = {
    slug: normalizeSlug(input.slug),
    title: input.title.trim(),
    status: "draft",
    target_keyword: input.targetKeyword ?? null,
    page_type: input.pageType ?? "resource",
    template_key: input.templateKey ?? "standard",
    draft_content: draftContent as unknown as Json,
    structured_data_settings: {},
    created_by: input.createdBy ?? null,
    updated_by: input.createdBy ?? null,
  };

  const { data, error } = await client
    .from("seo_pages")
    .insert(row)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) throw new Error("Could not create SEO page.");
  return data;
}

export async function adminSaveSeoPageDraft(
  pageId: string,
  input: SaveSeoPageDraftInput,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const patch: Database["public"]["Tables"]["seo_pages"]["Update"] = {};

  if (input.slug !== undefined) patch.slug = normalizeSlug(input.slug);
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
    patch.structured_data_settings = input.structuredDataSettings;
  }
  if (input.draftContent !== undefined) {
    patch.draft_content = parseDraftContent(
      input.draftContent,
    ) as unknown as Json;
  }
  if (input.updatedBy !== undefined) patch.updated_by = input.updatedBy;

  const { data, error } = await client
    .from("seo_pages")
    .update(patch)
    .eq("id", pageId)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) throw new Error("Could not save SEO page draft.");
  return data;
}

export async function adminPublishSeoPage(
  pageId: string,
  options: PublishSeoPageOptions = {},
): Promise<{ page: SeoPage; revision: PageRevision }> {
  const client = options.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const page = await loadSeoPageForPublish(client, pageId);
  const draftContent = await resolveReusableContent(
    client,
    parseDraftContent(page.draft_content),
  );

  const readiness = assessSeoReadiness(draftContent, {
    slug: page.slug,
    title: page.title,
    targetKeyword: page.target_keyword,
    seoTitle: page.seo_title,
    metaDescription: page.meta_description,
    canonicalUrl: page.canonical_url,
    noindex: page.noindex,
    sitemapEnabled: page.sitemap_enabled,
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
    resourcePathForSlug(page.slug),
  );
  if (redirectConflict) {
    issues.push({
      code: "redirect_conflict",
      path: "slug",
      message: "A database redirect already owns this resource path.",
    });
  }

  const duplicateMetadataIssues = await findDuplicateMetadataIssues(
    client,
    page,
  );
  issues.push(...duplicateMetadataIssues);

  const mediaValidation = await validateReferencedMedia(client, draftContent);
  issues.push(...mediaValidation.issues);
  if (issues.length > 0) throw new SeoPageValidationError(issues);

  const publishedContent = resolvePublishedContent(
    draftContent,
    mediaValidation.assets,
  );
  const publishedAt = now().toISOString();
  const revision = await insertPageRevision(client, {
    page_id: page.id,
    revision_type: "publish",
    label: `Publish ${publishedAt}`,
    content_snapshot: publishedContent as unknown as Json,
    seo_snapshot: buildSeoSnapshot(page),
    created_by: options.actorId ?? null,
  });

  const { data, error } = await client
    .from("seo_pages")
    .update({
      status: "published",
      published_content: publishedContent as unknown as Json,
      published_revision_id: revision.id,
      published_at: publishedAt,
      archived_at: null,
      archive_behavior: "not_found",
      archive_redirect_url: null,
      updated_by: options.actorId ?? null,
    })
    .eq("id", pageId)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) throw new Error("Could not publish SEO page.");
  return { page: data, revision };
}

export async function adminUpdateSeoPageSlug(
  pageId: string,
  slug: string,
  options: ServiceDeps & { actorId?: string | null } = {},
) {
  const client = options.client ?? createAdminClient();
  const nextSlug = normalizeSlug(slug);
  const page = await loadSeoPageSlugState(client, pageId);

  if (page.slug === nextSlug) return page;

  if (page.status === "published") {
    const { data, error } = await client.rpc(
      "update_seo_page_slug_with_redirect",
      {
        p_page_id: pageId,
        p_next_slug: nextSlug,
        p_actor_id: options.actorId ?? null,
      },
    );
    if (error || !data) throw new Error("Could not update SEO page slug.");
    return data as SeoPage;
  }

  const { data, error } = await client
    .from("seo_pages")
    .update({
      slug: nextSlug,
      updated_by: options.actorId ?? null,
    })
    .eq("id", pageId)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) throw new Error("Could not update SEO page slug.");
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

    const currentSlug =
      options.currentSlug ?? (await loadSeoPageSlugState(client, pageId)).slug;
    archiveRedirectUrl = normalizeDestinationPath(archiveRedirectUrl);
    await adminCreateBuilderRedirect(
      {
        sourcePath: resourcePathForSlug(currentSlug),
        destinationPath: archiveRedirectUrl,
        statusCode: 301,
        pageId,
        createdReason: "page_archived",
        createdBy: options.actorId ?? null,
      },
      { client },
    );
  }

  const { data, error } = await client
    .from("seo_pages")
    .update({
      status: "archived",
      archived_at: now().toISOString(),
      archive_behavior: behavior,
      archive_redirect_url: archiveRedirectUrl,
      updated_by: options.actorId ?? null,
    })
    .eq("id", pageId)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) throw new Error("Could not archive SEO page.");
  return data;
}

export async function adminCreateBuilderRedirect(
  input: {
    sourcePath: string;
    destinationPath: string;
    statusCode?: 301 | 302 | 307 | 308;
    pageId?: string | null;
    createdReason?: "slug_changed" | "page_archived" | "manual";
    createdBy?: string | null;
  },
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const row: RedirectInsert = {
    source_path: normalizeSourcePath(input.sourcePath),
    destination_path: normalizeDestinationPath(input.destinationPath),
    status_code: input.statusCode ?? 301,
    page_id: input.pageId ?? null,
    created_reason: input.createdReason ?? "manual",
    created_by: input.createdBy ?? null,
  };

  if (row.source_path === row.destination_path) {
    throw new SeoPageValidationError([
      {
        code: "self_redirect",
        path: "destination_path",
        message: "Redirect source and destination must differ.",
      },
    ]);
  }

  const { data, error } = await client
    .from("redirects")
    .insert(row)
    .select(
      "id, source_path, destination_path, status_code, page_id, created_reason, created_by, created_at",
    )
    .single();

  if (error) throw new Error("Could not create builder redirect.");
  return data;
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

  const revision = await insertPageRevision(client, {
    page_id: pageId,
    revision_type: "manual_save",
    label: "Refresh library references",
    content_snapshot: refreshedContent as unknown as Json,
    seo_snapshot: buildSeoSnapshot(page),
    created_by: options.actorId ?? null,
  });

  const { data, error } = await client
    .from("seo_pages")
    .update({
      draft_content: refreshedContent as unknown as Json,
      updated_by: options.actorId ?? null,
    })
    .eq("id", pageId)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) throw new Error("Could not refresh SEO page libraries.");
  return { page: data, revision };
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
  const rollbackRevision = await insertPageRevision(client, {
    page_id: pageId,
    revision_type: "rollback",
    label: `Rollback from ${revision.id}`,
    content_snapshot: draftContent as unknown as Json,
    seo_snapshot: revision.seo_snapshot,
    created_by: options.actorId ?? null,
  });

  const { data, error } = await client
    .from("seo_pages")
    .update({
      ...seoPatch,
      draft_content: draftContent as unknown as Json,
      updated_by: options.actorId ?? null,
    })
    .eq("id", pageId)
    .select(SEO_PAGE_FIELDS)
    .single();

  if (error) throw new Error("Could not rollback SEO page revision.");
  return { page: data, revision: rollbackRevision };
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
  return {
    ...page,
    published_content: draftContent,
  };
}

function hashPreviewToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function seoPatchFromSnapshot(snapshot: Json) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {};
  }

  const values = snapshot as Record<string, Json | undefined>;
  const patch: Database["public"]["Tables"]["seo_pages"]["Update"] = {};
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
  return patch;
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

async function loadSeoPageSlugState(client: SeoPageClient, pageId: string) {
  const { data, error } = await client
    .from("seo_pages")
    .select("id, slug, status")
    .eq("id", pageId)
    .single();

  if (error || !data) throw new Error("Could not load SEO page slug.");
  return data;
}

async function insertPageRevision(
  client: SeoPageClient,
  row: TablesInsert<"page_revisions">,
) {
  const { data, error } = await client
    .from("page_revisions")
    .insert(row)
    .select(PAGE_REVISION_FIELDS)
    .single();

  if (error) throw new Error("Could not create SEO page revision.");
  return data;
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
      message: `Another resource page already uses this SEO title: ${resourcePathForSlug(titleConflict.slug)}.`,
    });
  }
  if (descriptionConflict) {
    issues.push({
      code: "duplicate_meta_description",
      path: "meta_description",
      message: `Another resource page already uses this meta description: ${resourcePathForSlug(descriptionConflict.slug)}.`,
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
    .select("id, slug, seo_title, meta_description, status")
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
      blocks
        .filter((block) => block.type === "cta" && block.props.presetId)
        .map((block) => (block.type === "cta" ? block.props.presetId : null))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const proofItemIds = [
    ...new Set(
      blocks
        .filter((block) => block.type === "proof" && block.props.proofItemId)
        .map((block) =>
          block.type === "proof" ? block.props.proofItemId : null,
        )
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const issues: PageBuilderValidationIssue[] = [];
  const ctaPresets = await loadCtaPresets(client, ctaPresetIds, issues);
  const proofItems = await loadProofItems(client, proofItemIds, issues);
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
  const assetIds = [
    ...new Set(
      flattenBlocks(content)
        .filter((block) => block.type === "image" && block.props.assetId)
        .map((block) => (block.type === "image" ? block.props.assetId : null))
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  if (assetIds.length === 0) {
    return { issues: [], assets: new Map() };
  }

  const { data, error } = await client
    .from("media_assets")
    .select(
      "id, asset_type, alt_text, source_rights_notes, storage_bucket, storage_path, external_url",
    )
    .in("id", assetIds);

  if (error) throw new Error("Could not validate referenced media.");

  const rows = new Map((data ?? []).map((row) => [row.id, row as MediaAsset]));
  const issues: PageBuilderValidationIssue[] = [];

  for (const assetId of assetIds) {
    const row = rows.get(assetId);
    if (!row) {
      issues.push({
        code: "missing_media_asset",
        path: `media_assets.${assetId}`,
        message: "Referenced image asset does not exist.",
      });
      continue;
    }
    if (row.asset_type !== "image") {
      issues.push({
        code: "invalid_media_asset_type",
        path: `media_assets.${assetId}`,
        message: "Image blocks must reference image assets.",
      });
    }
    if (!row.external_url && !(row.storage_bucket && row.storage_path)) {
      issues.push({
        code: "missing_media_source",
        path: `media_assets.${assetId}`,
        message: "Referenced image asset requires a public source.",
      });
    }
    if (!row.alt_text?.trim()) {
      issues.push({
        code: "missing_image_alt",
        path: `media_assets.${assetId}.alt_text`,
        message: "Referenced image asset requires alt text.",
      });
    }
    if (!row.source_rights_notes?.trim()) {
      issues.push({
        code: "missing_media_rights",
        path: `media_assets.${assetId}.source_rights_notes`,
        message: "Referenced image asset requires source and rights notes.",
      });
    }
  }

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
          if (block.type !== "image" || !block.props.assetId) return block;
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

function buildSeoSnapshot(page: SeoPage): Json {
  return {
    slug: page.slug,
    title: page.title,
    target_keyword: page.target_keyword,
    seo_title: page.seo_title,
    meta_description: page.meta_description,
    canonical_url: page.canonical_url,
    noindex: page.noindex,
    sitemap_enabled: page.sitemap_enabled,
    structured_data_settings: page.structured_data_settings,
  };
}

function normalizeSourcePath(path: string) {
  const normalized = normalizeInternalPath(path);
  if (!normalized.startsWith("/resources/")) {
    throw new SeoPageValidationError([
      {
        code: "invalid_redirect_source",
        path: "source_path",
        message: "Builder redirect sources must be resource paths.",
      },
    ]);
  }
  return normalized;
}

function normalizeDestinationPath(path: string) {
  const trimmed = path.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
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

function normalizeInternalPath(path: string) {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
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
