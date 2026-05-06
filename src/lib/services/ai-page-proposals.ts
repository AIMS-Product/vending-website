import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  proposedBlockHasSourceSupport,
  proposedBlockHasUnsupportedWarnings,
  validateAiPageProposal,
  type AiPageProposal,
} from "@/lib/page-builder/ai-proposals";
import { pageContentSchema } from "@/lib/page-builder/blocks";
import { ensureEditablePageContent } from "@/lib/page-builder/content-ops";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, TablesInsert } from "@/types/database";

type ProposalClient = Pick<SupabaseClient<Database>, "from">;

type ServiceDeps = {
  client?: ProposalClient;
  now?: () => Date;
};

export class AiProposalValidationError extends Error {
  issues: Array<{ code: string; message: string; path?: string }>;

  constructor(issues: Array<{ code: string; message: string; path?: string }>) {
    super("Invalid AI page proposal");
    this.name = "AiProposalValidationError";
    this.issues = issues;
  }
}

export type CreateAiPageProposalInput = {
  pageId: string;
  model: string;
  promptVersion: string;
  selectedSourceDocumentIds?: string[];
  selectedSourceExcerptIds?: string[];
  selectedApprovedClaimIds?: string[];
  proposal: unknown;
  createdBy?: string | null;
};

const AI_PROPOSAL_FIELDS =
  "id, page_id, status, model, prompt_version, selected_source_document_ids, selected_source_excerpt_ids, selected_approved_claim_ids, proposal_json, warnings, accepted_block_ids, created_by, accepted_by, accepted_at, created_at, updated_at" as const;

export async function adminCreateAiPageProposal(
  input: CreateAiPageProposalInput,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const proposal = parseProposal(input.proposal);
  await validateSelectedSources(client, {
    sourceDocumentIds: input.selectedSourceDocumentIds ?? [],
    sourceExcerptIds: input.selectedSourceExcerptIds ?? [],
    approvedClaimIds: input.selectedApprovedClaimIds ?? [],
  });

  const row: TablesInsert<"ai_page_proposals"> = {
    page_id: input.pageId,
    status: "proposed",
    model: input.model,
    prompt_version: input.promptVersion,
    selected_source_document_ids: input.selectedSourceDocumentIds ?? [],
    selected_source_excerpt_ids: input.selectedSourceExcerptIds ?? [],
    selected_approved_claim_ids: input.selectedApprovedClaimIds ?? [],
    proposal_json: proposal as unknown as Json,
    warnings: proposal.warnings as unknown as Json,
    created_by: input.createdBy ?? null,
  };

  const { data, error } = await client
    .from("ai_page_proposals")
    .insert(row)
    .select(AI_PROPOSAL_FIELDS)
    .single();

  if (error) throw new Error("Could not create AI page proposal.");
  return data;
}

export async function adminAcceptAiProposalBlocks(
  pageId: string,
  proposalId: string,
  blockIds: string[],
  options: ServiceDeps & { actorId?: string | null } = {},
) {
  const client = options.client ?? createAdminClient();
  const now = options.now ?? (() => new Date());
  const proposalRow = await loadProposal(client, pageId, proposalId);
  if (!proposalRow || proposalRow.status !== "proposed") {
    throw new Error("AI proposal is not available for insertion.");
  }

  const proposal = parseProposal(proposalRow.proposal_json);
  const acceptedBlocks = proposal.blocks.filter((entry) =>
    blockIds.includes(entry.block.id),
  );
  if (acceptedBlocks.length === 0) {
    throw new AiProposalValidationError([
      {
        code: "missing_selected_blocks",
        message: "Select at least one proposed block to insert.",
      },
    ]);
  }

  const issues = acceptedBlocks.flatMap((entry) => {
    const blockIssues: Array<{ code: string; message: string; path?: string }> =
      [];
    if (!proposedBlockHasSourceSupport(entry)) {
      blockIssues.push({
        code: "missing_source_reference",
        path: entry.block.id,
        message: "Accepted AI blocks require source or approved-claim IDs.",
      });
    }
    if (proposedBlockHasUnsupportedWarnings(entry)) {
      blockIssues.push({
        code: "unsupported_claim",
        path: entry.block.id,
        message: "Blocks with unsupported-claim warnings cannot be inserted.",
      });
    }
    return blockIssues;
  });
  if (issues.length > 0) throw new AiProposalValidationError(issues);

  const page = await loadPage(client, pageId);
  const content = ensureEditablePageContent(
    pageContentSchema.parse(page.draft_content),
  );
  const nextContent = {
    ...content,
    sections: content.sections.map((section, sectionIndex) =>
      sectionIndex === 0
        ? {
            ...section,
            columns: section.columns.map((column, columnIndex) =>
              columnIndex === 0
                ? {
                    ...column,
                    blocks: [
                      ...column.blocks,
                      ...acceptedBlocks.map((entry) => entry.block),
                    ],
                  }
                : column,
            ),
          }
        : section,
    ),
  };

  const { data: revision, error: revisionError } = await client
    .from("page_revisions")
    .insert({
      page_id: pageId,
      revision_type: "ai_insert",
      label: `AI insert ${now().toISOString()}`,
      content_snapshot: nextContent as unknown as Json,
      seo_snapshot: {
        slug: page.slug,
        title: page.title,
        target_keyword: page.target_keyword,
        seo_title: page.seo_title,
        meta_description: page.meta_description,
      } satisfies Json,
      created_by: options.actorId ?? null,
    })
    .select(
      "id, page_id, revision_type, label, content_snapshot, seo_snapshot, created_by, created_at",
    )
    .single();
  if (revisionError) throw new Error("Could not create AI insert revision.");

  const { data: updatedPage, error: pageError } = await client
    .from("seo_pages")
    .update({
      draft_content: nextContent as unknown as Json,
      updated_by: options.actorId ?? null,
    })
    .eq("id", pageId)
    .select("id, draft_content, updated_by, updated_at")
    .single();
  if (pageError) throw new Error("Could not insert AI proposal blocks.");

  const { data: updatedProposal, error: proposalError } = await client
    .from("ai_page_proposals")
    .update({
      status: "accepted",
      accepted_block_ids: acceptedBlocks.map((entry) => entry.block.id),
      accepted_by: options.actorId ?? null,
      accepted_at: now().toISOString(),
    })
    .eq("id", proposalId)
    .select(AI_PROPOSAL_FIELDS)
    .single();
  if (proposalError) throw new Error("Could not mark AI proposal accepted.");

  return {
    page: updatedPage,
    proposal: updatedProposal,
    revision,
  };
}

function parseProposal(input: unknown): AiPageProposal {
  const parsed = validateAiPageProposal(input);
  if (parsed.success) return parsed.data;
  throw new AiProposalValidationError(
    parsed.error.issues.map((issue) => ({
      code: "invalid_schema",
      path: issue.path.join("."),
      message: issue.message,
    })),
  );
}

async function validateSelectedSources(
  client: ProposalClient,
  refs: {
    sourceDocumentIds: string[];
    sourceExcerptIds: string[];
    approvedClaimIds: string[];
  },
) {
  const issues: Array<{ code: string; message: string; path?: string }> = [];
  await requireRows(client, "source_documents", refs.sourceDocumentIds, issues);
  await requireRows(client, "source_excerpts", refs.sourceExcerptIds, issues, {
    approved: true,
  });
  await requireRows(client, "approved_claims", refs.approvedClaimIds, issues);
  if (issues.length > 0) throw new AiProposalValidationError(issues);
}

async function requireRows(
  client: ProposalClient,
  table: "source_documents" | "source_excerpts" | "approved_claims",
  ids: string[],
  issues: Array<{ code: string; message: string; path?: string }>,
  required?: { approved?: boolean },
) {
  if (ids.length === 0) return;
  const result =
    table === "source_documents"
      ? await client.from("source_documents").select("id").in("id", ids)
      : table === "approved_claims"
        ? await client.from("approved_claims").select("id").in("id", ids)
        : required?.approved
          ? await client
              .from("source_excerpts")
              .select("id, approved")
              .in("id", ids)
              .eq("approved", true)
          : await client
              .from("source_excerpts")
              .select("id, approved")
              .in("id", ids);
  const { data, error } = result;
  if (error) throw new Error(`Could not validate ${table}.`);
  const found = new Set((data ?? []).map((row) => row.id));
  for (const id of ids) {
    if (!found.has(id)) {
      issues.push({
        code: "missing_source",
        path: `${table}.${id}`,
        message: "AI proposals can only use selected approved source data.",
      });
    }
  }
}

async function loadProposal(
  client: ProposalClient,
  pageId: string,
  proposalId: string,
) {
  const { data, error } = await client
    .from("ai_page_proposals")
    .select(AI_PROPOSAL_FIELDS)
    .match({ id: proposalId, page_id: pageId })
    .maybeSingle();

  if (error) throw new Error("Could not load AI page proposal.");
  return data;
}

async function loadPage(client: ProposalClient, pageId: string) {
  const { data, error } = await client
    .from("seo_pages")
    .select(
      "id, slug, title, target_keyword, draft_content, seo_title, meta_description",
    )
    .eq("id", pageId)
    .single();

  if (error || !data) throw new Error("Could not load SEO page.");
  return data;
}
