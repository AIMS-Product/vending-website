import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import {
  proposedBlockHasSourceSupport,
  validateAiPageProposal,
  type AiPageProposal,
} from "@/lib/page-builder/ai-proposals";
import {
  flattenBlocks,
  pageContentSchema,
  richTextDocumentPlainText,
  type PageBlock,
} from "@/lib/page-builder/blocks";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";
import { adminCreateAiPageProposal } from "./ai-page-proposals";

type SeoAgentClient = Pick<SupabaseClient<Database>, "from" | "rpc">;
type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SeoAgentPageRow = Pick<
  Tables<"seo_pages">,
  | "id"
  | "slug"
  | "title"
  | "target_keyword"
  | "seo_title"
  | "meta_description"
  | "draft_content"
  | "status"
>;

type SourceDocumentRow = Pick<
  Tables<"source_documents">,
  "id" | "title" | "source_type" | "tags"
>;
type SourceExcerptRow = Pick<
  Tables<"source_excerpts">,
  "id" | "source_document_id" | "excerpt" | "topic_tags" | "updated_at"
>;
type ApprovedClaimRow = Pick<
  Tables<"approved_claims">,
  | "id"
  | "claim"
  | "claim_type"
  | "source_excerpt_id"
  | "usage_notes"
  | "risk_level"
>;

export type SeoAgentSourceBundle = {
  documents: SourceDocumentRow[];
  excerpts: SourceExcerptRow[];
  approvedClaims: ApprovedClaimRow[];
};

export type GenerateOpenAiSeoProposalInput = {
  page: SeoAgentPageRow;
  sourceBundle: SeoAgentSourceBundle;
  model?: string;
  reasoningEffort?: OpenAiReasoningEffort;
  promptVersion?: string;
};

export type AdminGenerateOpenAiSeoPageProposalOptions = {
  actorId?: string | null;
  client?: SeoAgentClient;
  fetchFn?: FetchLike;
  apiKey?: string;
  model?: string;
  reasoningEffort?: OpenAiReasoningEffort;
  promptVersion?: string;
};

export type OpenAiReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export const SEO_AGENT_PROMPT_VERSION = "seo-source-bound-proposal-v1";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_EXCERPTS = 8;
const MAX_CLAIMS = 16;

export class SeoAgentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeoAgentConfigurationError";
  }
}

export class SeoAgentSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeoAgentSourceError";
  }
}

export class SeoAgentGenerationError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = "SeoAgentGenerationError";
    this.status = options?.status;
    this.code = options?.code;
  }
}

export async function adminGenerateOpenAiSeoPageProposal(
  pageId: string,
  options: AdminGenerateOpenAiSeoPageProposalOptions = {},
) {
  const client = options.client ?? createAdminClient();
  const page = await loadSeoAgentPage(client, pageId);
  const sourceBundle = await loadApprovedSourceBundle(client, page);
  const model = options.model ?? config.OPENAI_SEO_MODEL;
  const promptVersion = options.promptVersion ?? SEO_AGENT_PROMPT_VERSION;
  const proposal = await generateOpenAiSeoProposalFromSources(
    {
      page,
      sourceBundle,
      model,
      reasoningEffort:
        options.reasoningEffort ?? config.OPENAI_SEO_REASONING_EFFORT,
      promptVersion,
    },
    {
      apiKey: options.apiKey,
      fetchFn: options.fetchFn,
    },
  );

  return adminCreateAiPageProposal(
    {
      pageId: page.id,
      model,
      promptVersion,
      selectedSourceDocumentIds: sourceBundle.documents.map(
        (source) => source.id,
      ),
      selectedSourceExcerptIds: sourceBundle.excerpts.map(
        (source) => source.id,
      ),
      selectedApprovedClaimIds: sourceBundle.approvedClaims.map(
        (claim) => claim.id,
      ),
      proposal,
      createdBy: options.actorId ?? null,
    },
    { client },
  );
}

export async function generateOpenAiSeoProposalFromSources(
  input: GenerateOpenAiSeoProposalInput,
  deps: { apiKey?: string; fetchFn?: FetchLike } = {},
): Promise<AiPageProposal> {
  const apiKey =
    deps.apiKey !== undefined ? deps.apiKey.trim() : config.OPENAI_API_KEY;
  if (!apiKey) {
    throw new SeoAgentConfigurationError(
      "OpenAI API key is not configured for the SEO agent.",
    );
  }

  ensureSourceBundleHasUsableEvidence(input.sourceBundle);

  const model = input.model ?? config.OPENAI_SEO_MODEL;
  const promptVersion = input.promptVersion ?? SEO_AGENT_PROMPT_VERSION;
  const response = await (deps.fetchFn ?? fetch)(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: seoAgentInstructions(),
      input: JSON.stringify(buildPromptPayload(input)),
      reasoning: { effort: input.reasoningEffort ?? "medium" },
      max_output_tokens: 6000,
      store: false,
      metadata: {
        page_id: input.page.id,
        prompt_version: promptVersion,
      },
      text: {
        format: {
          type: "json_schema",
          name: "seo_page_proposal",
          strict: true,
          schema: aiPageProposalJsonSchema,
        },
      },
    }),
  });

  const payload = await readOpenAiResponse(response);
  if (!response.ok) throw generationErrorFromPayload(response.status, payload);

  const text = extractOpenAiOutputText(payload);
  const parsed = parseJson(text);
  const proposal = validateAiPageProposal(parsed);
  if (!proposal.success) {
    throw new SeoAgentGenerationError(
      `OpenAI returned a proposal that failed validation: ${
        proposal.error.issues[0]?.message ?? "Invalid proposal"
      }`,
    );
  }

  validateProposalSourceReferences(proposal.data, input.sourceBundle);
  return proposal.data;
}

async function loadSeoAgentPage(client: SeoAgentClient, pageId: string) {
  const { data, error } = await client
    .from("seo_pages")
    .select(
      "id, slug, title, target_keyword, seo_title, meta_description, draft_content, status",
    )
    .eq("id", pageId)
    .single();

  if (error || !data) throw new SeoAgentSourceError("Could not load page.");
  return data as SeoAgentPageRow;
}

async function loadApprovedSourceBundle(
  client: SeoAgentClient,
  page: SeoAgentPageRow,
): Promise<SeoAgentSourceBundle> {
  const { data: excerptData, error: excerptError } = await client
    .from("source_excerpts")
    .select("id, source_document_id, excerpt, topic_tags, updated_at")
    .eq("approved", true)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (excerptError) {
    throw new SeoAgentSourceError("Could not load approved source excerpts.");
  }

  const excerpts = (excerptData ?? []) as SourceExcerptRow[];
  if (excerpts.length === 0) {
    throw new SeoAgentSourceError(
      "Add approved source excerpts before running the SEO agent.",
    );
  }

  const selectedExcerpts = rankExcerptsForPage(excerpts, page).slice(
    0,
    MAX_EXCERPTS,
  );
  const selectedExcerptIds = selectedExcerpts.map((excerpt) => excerpt.id);
  const selectedDocumentIds = unique(
    selectedExcerpts.map((excerpt) => excerpt.source_document_id),
  );

  const [documents, approvedClaims] = await Promise.all([
    loadSourceDocuments(client, selectedDocumentIds),
    loadApprovedClaims(client, selectedExcerptIds),
  ]);

  return {
    documents,
    excerpts: selectedExcerpts,
    approvedClaims: approvedClaims.slice(0, MAX_CLAIMS),
  };
}

async function loadSourceDocuments(
  client: SeoAgentClient,
  documentIds: string[],
) {
  if (documentIds.length === 0) return [];
  const { data, error } = await client
    .from("source_documents")
    .select("id, title, source_type, tags")
    .in("id", documentIds);
  if (error) throw new SeoAgentSourceError("Could not load source documents.");
  return (data ?? []) as SourceDocumentRow[];
}

async function loadApprovedClaims(
  client: SeoAgentClient,
  excerptIds: string[],
) {
  if (excerptIds.length === 0) return [];
  const { data, error } = await client
    .from("approved_claims")
    .select("id, claim, claim_type, source_excerpt_id, usage_notes, risk_level")
    .in("source_excerpt_id", excerptIds)
    .order("updated_at", { ascending: false })
    .limit(MAX_CLAIMS);
  if (error) throw new SeoAgentSourceError("Could not load approved claims.");
  return (data ?? []) as ApprovedClaimRow[];
}

function rankExcerptsForPage(
  excerpts: SourceExcerptRow[],
  page: SeoAgentPageRow,
) {
  const tokens = tokenize(
    [page.title, page.target_keyword, page.slug, page.seo_title]
      .filter(Boolean)
      .join(" "),
  );
  if (tokens.length === 0) return excerpts;

  return [...excerpts].sort((a, b) => {
    const scoreDelta = scoreExcerpt(b, tokens) - scoreExcerpt(a, tokens);
    if (scoreDelta !== 0) return scoreDelta;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

function scoreExcerpt(excerpt: SourceExcerptRow, tokens: string[]) {
  const haystack = tokenize(
    [excerpt.excerpt, ...excerpt.topic_tags].join(" "),
  ).join(" ");
  return tokens.reduce(
    (score, token) => score + (haystack.includes(token) ? 1 : 0),
    0,
  );
}

function buildPromptPayload(input: GenerateOpenAiSeoProposalInput) {
  return {
    promptVersion: input.promptVersion ?? SEO_AGENT_PROMPT_VERSION,
    page: {
      id: input.page.id,
      slug: input.page.slug,
      status: input.page.status,
      title: input.page.title,
      targetKeyword: input.page.target_keyword,
      seoTitle: input.page.seo_title,
      metaDescription: input.page.meta_description,
      visibleDraftText: summarizeDraft(input.page.draft_content),
    },
    sourceMaterial: {
      documents: input.sourceBundle.documents.map((source) => ({
        id: source.id,
        title: source.title,
        sourceType: source.source_type,
        tags: source.tags,
      })),
      excerpts: input.sourceBundle.excerpts.map((source) => ({
        id: source.id,
        sourceDocumentId: source.source_document_id,
        excerpt: truncate(source.excerpt, 1400),
        topicTags: source.topic_tags,
      })),
      approvedClaims: input.sourceBundle.approvedClaims.map((claim) => ({
        id: claim.id,
        sourceExcerptId: claim.source_excerpt_id,
        claim: truncate(claim.claim, 700),
        claimType: claim.claim_type,
        usageNotes: claim.usage_notes,
        riskLevel: claim.risk_level,
      })),
    },
    allowedBlockTypes: ["hero", "rich_text", "faq", "card_grid", "cta"],
  };
}

function seoAgentInstructions() {
  return [
    "You are the SEO Page Builder proposal agent.",
    "Return only structured proposal JSON matching the provided schema.",
    "Do not publish, mutate drafts, create redirects, or invent facts.",
    "Use only the selected source excerpts and approved claims in the input.",
    "Every proposed block that contains factual copy must include sourceExcerptIds or approvedClaimIds.",
    "If evidence is missing, add a warning with code needs_source or unsupported_claim instead of inventing.",
    "Prefer a practical resource-page structure: hero, useful sections, FAQ/schema candidates, and CTA.",
    "Use stable block IDs beginning with ai_ and keep copy concise enough for a marketer to edit visually.",
  ].join("\n");
}

function summarizeDraft(input: unknown) {
  const parsed = pageContentSchema.safeParse(input);
  if (!parsed.success) return "";
  const parts: string[] = [];
  for (const block of flattenBlocks(parsed.data)) {
    parts.push(...textForBlock(block));
  }
  return truncate(parts.join(" ").replace(/\s+/g, " ").trim(), 1600);
}

function textForBlock(block: PageBlock) {
  if (block.type === "hero") {
    return [block.props.eyebrow, block.props.heading, block.props.body];
  }
  if (block.type === "rich_text") {
    return [
      block.props.eyebrow,
      block.props.heading,
      richTextDocumentPlainText(block.props.body),
    ];
  }
  if (block.type === "faq") {
    return block.props.items.flatMap((item) => [item.question, item.answer]);
  }
  if (block.type === "card_grid") {
    return block.props.cards.flatMap((card) => [card.title, card.body]);
  }
  if (block.type === "cta") return [block.props.label, block.props.href];
  if (block.type === "lead_form")
    return [block.props.heading, block.props.body];
  if (block.type === "proof") {
    return [block.props.eyebrow, block.props.body, block.props.name];
  }
  if (block.type === "video") return [block.props.title, block.props.caption];
  if (block.type === "image") return [block.props.altText, block.props.caption];
  return [];
}

function ensureSourceBundleHasUsableEvidence(bundle: SeoAgentSourceBundle) {
  if (bundle.excerpts.length === 0 && bundle.approvedClaims.length === 0) {
    throw new SeoAgentSourceError(
      "Add approved source material before running the SEO agent.",
    );
  }
}

function validateProposalSourceReferences(
  proposal: AiPageProposal,
  bundle: SeoAgentSourceBundle,
) {
  const documentIds = new Set(bundle.documents.map((source) => source.id));
  const excerptIds = new Set(bundle.excerpts.map((source) => source.id));
  const claimIds = new Set(bundle.approvedClaims.map((claim) => claim.id));
  const badRefs: string[] = [];

  for (const proposed of proposal.blocks) {
    for (const id of proposed.sourceDocumentIds) {
      if (!documentIds.has(id)) badRefs.push(`${proposed.block.id}:${id}`);
    }
    for (const id of proposed.sourceExcerptIds) {
      if (!excerptIds.has(id)) badRefs.push(`${proposed.block.id}:${id}`);
    }
    for (const id of proposed.approvedClaimIds) {
      if (!claimIds.has(id)) badRefs.push(`${proposed.block.id}:${id}`);
    }
    if (
      !proposedBlockHasSourceSupport(proposed) &&
      proposed.warnings.length === 0
    ) {
      badRefs.push(`${proposed.block.id}:missing-source-warning`);
    }
  }

  if (badRefs.length > 0) {
    throw new SeoAgentGenerationError(
      "OpenAI returned a proposal with unselected or missing source references.",
    );
  }
}

async function readOpenAiResponse(response: Response) {
  const body = await response.text();
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new SeoAgentGenerationError("OpenAI returned invalid JSON.", {
      status: response.status,
    });
  }
}

function generationErrorFromPayload(status: number, payload: unknown) {
  const error =
    typeof payload === "object" && payload && "error" in payload
      ? (payload as { error?: { code?: string; message?: string } }).error
      : null;
  const code = error?.code;
  const detail = code ? ` (${code})` : "";
  return new SeoAgentGenerationError(
    `OpenAI rejected the SEO agent request${detail}.`,
    { status, code },
  );
}

function extractOpenAiOutputText(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload &&
    "output_text" in payload &&
    typeof (payload as { output_text?: unknown }).output_text === "string"
  ) {
    return (payload as { output_text: string }).output_text;
  }

  const output =
    typeof payload === "object" && payload && "output" in payload
      ? (payload as { output?: unknown }).output
      : null;
  if (!Array.isArray(output)) {
    throw new SeoAgentGenerationError("OpenAI response did not include text.");
  }

  const chunks: string[] = [];
  for (const item of output) {
    if (
      typeof item !== "object" ||
      !item ||
      !("content" in item) ||
      !Array.isArray((item as { content?: unknown }).content)
    ) {
      continue;
    }
    for (const part of (item as { content: unknown[] }).content) {
      if (
        typeof part === "object" &&
        part &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        chunks.push((part as { text: string }).text);
      }
    }
  }

  const text = chunks.join("").trim();
  if (!text) {
    throw new SeoAgentGenerationError("OpenAI response did not include text.");
  }
  return text;
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SeoAgentGenerationError(
      "OpenAI returned text that was not valid proposal JSON.",
    );
  }
}

function truncate(value: string | null | undefined, max: number) {
  const text = (value ?? "").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

const uuidArraySchema = {
  type: "array",
  maxItems: 12,
  items: {
    type: "string",
    pattern:
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
  },
} as const;

const warningArraySchema = {
  type: "array",
  maxItems: 12,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["code", "message", "blockId"],
    properties: {
      code: {
        type: "string",
        enum: ["unsupported_claim", "needs_source", "schema_warning"],
      },
      message: { type: "string", minLength: 1, maxLength: 500 },
      blockId: { type: "string", maxLength: 80 },
    },
  },
} as const;

const blockIdProperty = {
  id: {
    type: "string",
    pattern: "^[A-Za-z][A-Za-z0-9_-]{1,79}$",
  },
} as const;

const safeHrefProperty = {
  type: "string",
  maxLength: 500,
  pattern: "^(|/[^/].*|https?://.+)$",
} as const;

const heroBlockSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "variant", "props"],
  properties: {
    ...blockIdProperty,
    type: { type: "string", enum: ["hero"] },
    variant: { type: "string", enum: ["standard", "split", "compact"] },
    props: {
      type: "object",
      additionalProperties: false,
      required: [
        "eyebrow",
        "heading",
        "body",
        "ctaLabel",
        "ctaHref",
        "ctaTrackingName",
      ],
      properties: {
        eyebrow: { type: "string", maxLength: 80 },
        heading: { type: "string", minLength: 1, maxLength: 180 },
        body: { type: "string", maxLength: 500 },
        ctaLabel: { type: "string", maxLength: 80 },
        ctaHref: safeHrefProperty,
        ctaTrackingName: { type: "string", maxLength: 120 },
      },
    },
  },
} as const;

const richTextDocumentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "nodes"],
  properties: {
    version: { type: "number", enum: [1] },
    nodes: {
      type: "array",
      maxItems: 12,
      items: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "text"],
            properties: {
              type: { type: "string", enum: ["paragraph"] },
              text: { type: "string", maxLength: 2000 },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "level", "text"],
            properties: {
              type: { type: "string", enum: ["heading"] },
              level: { type: "number", enum: [2, 3] },
              text: { type: "string", maxLength: 180 },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "style", "items"],
            properties: {
              type: { type: "string", enum: ["list"] },
              style: { type: "string", enum: ["bullet", "numbered"] },
              items: {
                type: "array",
                maxItems: 8,
                items: { type: "string", maxLength: 300 },
              },
            },
          },
        ],
      },
    },
  },
} as const;

const richTextBlockSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "variant", "props"],
  properties: {
    ...blockIdProperty,
    type: { type: "string", enum: ["rich_text"] },
    variant: { type: "string", enum: ["default", "intro", "compact"] },
    props: {
      type: "object",
      additionalProperties: false,
      required: ["eyebrow", "heading", "body"],
      properties: {
        eyebrow: { type: "string", maxLength: 80 },
        heading: { type: "string", maxLength: 180 },
        body: richTextDocumentJsonSchema,
      },
    },
  },
} as const;

const faqBlockSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "variant", "props"],
  properties: {
    ...blockIdProperty,
    type: { type: "string", enum: ["faq"] },
    variant: { type: "string", enum: ["standard", "compact"] },
    props: {
      type: "object",
      additionalProperties: false,
      required: ["heading", "items"],
      properties: {
        heading: { type: "string", maxLength: 160 },
        items: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["question", "answer"],
            properties: {
              question: { type: "string", maxLength: 240 },
              answer: { type: "string", maxLength: 1200 },
            },
          },
        },
      },
    },
  },
} as const;

const cardGridBlockSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "variant", "props"],
  properties: {
    ...blockIdProperty,
    type: { type: "string", enum: ["card_grid"] },
    variant: { type: "string", enum: ["standard", "compact"] },
    props: {
      type: "object",
      additionalProperties: false,
      required: ["heading", "cards"],
      properties: {
        heading: { type: "string", maxLength: 160 },
        cards: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "body", "href"],
            properties: {
              title: { type: "string", maxLength: 140 },
              body: { type: "string", maxLength: 500 },
              href: safeHrefProperty,
            },
          },
        },
      },
    },
  },
} as const;

const ctaBlockSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "variant", "props"],
  properties: {
    ...blockIdProperty,
    type: { type: "string", enum: ["cta"] },
    variant: { type: "string", enum: ["primary", "secondary", "text"] },
    props: {
      type: "object",
      additionalProperties: false,
      required: ["label", "href", "trackingName"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: 80 },
        href: safeHrefProperty,
        trackingName: { type: "string", maxLength: 120 },
      },
    },
  },
} as const;

const aiPageProposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "metadata", "blocks", "warnings"],
  properties: {
    version: { type: "number", enum: [1] },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["title", "seoTitle", "metaDescription", "suggestedSlug"],
      properties: {
        title: { type: "string", maxLength: 180 },
        seoTitle: { type: "string", maxLength: 80 },
        metaDescription: { type: "string", maxLength: 180 },
        suggestedSlug: {
          type: "string",
          maxLength: 120,
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
      },
    },
    blocks: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "block",
          "sourceDocumentIds",
          "sourceExcerptIds",
          "approvedClaimIds",
          "warnings",
        ],
        properties: {
          block: {
            anyOf: [
              heroBlockSchema,
              richTextBlockSchema,
              faqBlockSchema,
              cardGridBlockSchema,
              ctaBlockSchema,
            ],
          },
          sourceDocumentIds: uuidArraySchema,
          sourceExcerptIds: uuidArraySchema,
          approvedClaimIds: uuidArraySchema,
          warnings: warningArraySchema,
        },
      },
    },
    warnings: warningArraySchema,
  },
} as const;
