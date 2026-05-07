import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables, TablesInsert } from "@/types/database";

export type ProofItem = Tables<"proof_items">;
export type CtaPreset = Tables<"cta_presets">;
export type SourceDocument = Tables<"source_documents">;
export type SourceExcerpt = Tables<"source_excerpts">;
export type ApprovedClaim = Tables<"approved_claims">;

type LibraryClient = Pick<SupabaseClient<Database>, "from">;

type ServiceDeps = {
  client?: LibraryClient;
  now?: () => Date;
};

export type PageBuilderLibraries = {
  proofItems: ProofItem[];
  ctaPresets: CtaPreset[];
  sourceDocuments: SourceDocument[];
  sourceExcerpts: SourceExcerpt[];
  approvedClaims: ApprovedClaim[];
};

export type CreateCtaPresetInput = {
  label: string;
  href: string;
  stylePreset: string;
  trackingName: string;
};

export type CreateProofItemInput = {
  kind: string;
  body: string;
  name?: string | null;
  roleOrContext?: string | null;
  sourceRightsNotes?: string | null;
  approved?: boolean;
};

export type CreateSourceDocumentInput = {
  title: string;
  sourceType: string;
  body: string;
  tags?: string[];
  createdBy?: string | null;
};

export type CreateSourceExcerptInput = {
  sourceDocumentId: string;
  excerpt: string;
  topicTags?: string[];
  approved?: boolean;
  approvedBy?: string | null;
};

export type CreateApprovedClaimInput = {
  claim: string;
  claimType: string;
  sourceExcerptId: string;
  usageNotes?: string | null;
  riskLevel: string;
  approvedBy?: string | null;
};

const PROOF_ITEM_FIELDS =
  "id, kind, name, role_or_context, body, asset_id, source_rights_notes, approved, created_at, updated_at" as const;
const CTA_PRESET_FIELDS =
  "id, label, href, style_preset, tracking_name, created_at, updated_at" as const;
const SOURCE_DOCUMENT_FIELDS =
  "id, title, source_type, body, asset_id, tags, created_by, created_at, updated_at" as const;
const SOURCE_EXCERPT_FIELDS =
  "id, source_document_id, excerpt, topic_tags, approved, approved_by, approved_at, created_at, updated_at" as const;
const APPROVED_CLAIM_FIELDS =
  "id, claim, claim_type, source_excerpt_id, usage_notes, risk_level, approved_by, approved_at, created_at, updated_at" as const;

const PROOF_KINDS = new Set(["testimonial", "stat", "case_study", "quote"]);
const CTA_STYLES = new Set(["primary", "secondary", "text"]);
const SOURCE_TYPES = new Set([
  "paste",
  "file",
  "url_reference",
  "existing_site_content",
]);
const CLAIM_RISK_LEVELS = new Set(["low", "medium", "high"]);

export async function adminListPageBuilderLibraries(
  deps: ServiceDeps = {},
): Promise<PageBuilderLibraries> {
  const client = deps.client ?? createAdminClient();
  const [
    proofItems,
    ctaPresets,
    sourceDocuments,
    sourceExcerpts,
    approvedClaims,
  ] = await Promise.all([
    listTable<ProofItem>(client, "proof_items", PROOF_ITEM_FIELDS),
    listTable<CtaPreset>(client, "cta_presets", CTA_PRESET_FIELDS),
    listTable<SourceDocument>(
      client,
      "source_documents",
      SOURCE_DOCUMENT_FIELDS,
    ),
    listTable<SourceExcerpt>(client, "source_excerpts", SOURCE_EXCERPT_FIELDS),
    listTable<ApprovedClaim>(client, "approved_claims", APPROVED_CLAIM_FIELDS),
  ]);

  return {
    proofItems,
    ctaPresets,
    sourceDocuments,
    sourceExcerpts,
    approvedClaims,
  };
}

export async function adminCreateCtaPreset(
  input: CreateCtaPresetInput,
  deps: ServiceDeps = {},
) {
  const row: TablesInsert<"cta_presets"> = {
    label: requiredText(input.label, "CTA label"),
    href: normalizeHref(input.href),
    style_preset: requiredAllowed(
      input.stylePreset,
      CTA_STYLES,
      "CTA style preset",
    ),
    tracking_name: requiredText(input.trackingName, "CTA tracking name"),
  };

  return insertSingle<CtaPreset>(
    deps.client ?? createAdminClient(),
    "cta_presets",
    row,
    CTA_PRESET_FIELDS,
    "Could not create CTA preset.",
  );
}

export async function adminCreateProofItem(
  input: CreateProofItemInput,
  deps: ServiceDeps = {},
) {
  const approved = Boolean(input.approved);
  const rightsNotes = input.sourceRightsNotes?.trim() || null;
  if (approved && !rightsNotes) {
    throw new Error("Approved proof requires source and rights notes.");
  }

  const row: TablesInsert<"proof_items"> = {
    kind: requiredAllowed(
      input.kind || "testimonial",
      PROOF_KINDS,
      "Proof kind",
    ),
    body: requiredText(input.body, "Proof body"),
    name: nullableText(input.name),
    role_or_context: nullableText(input.roleOrContext),
    source_rights_notes: rightsNotes,
    approved,
  };

  return insertSingle<ProofItem>(
    deps.client ?? createAdminClient(),
    "proof_items",
    row,
    PROOF_ITEM_FIELDS,
    "Could not create proof item.",
  );
}

export async function adminCreateSourceDocument(
  input: CreateSourceDocumentInput,
  deps: ServiceDeps = {},
) {
  const row: TablesInsert<"source_documents"> = {
    title: requiredText(input.title, "Source title"),
    source_type: normalizeAllowed(input.sourceType, SOURCE_TYPES, "paste"),
    body: requiredText(input.body, "Source body"),
    tags: input.tags ?? [],
    created_by: input.createdBy ?? null,
  };

  return insertSingle<SourceDocument>(
    deps.client ?? createAdminClient(),
    "source_documents",
    row,
    SOURCE_DOCUMENT_FIELDS,
    "Could not create source document.",
  );
}

export async function adminCreateSourceExcerpt(
  input: CreateSourceExcerptInput,
  deps: ServiceDeps = {},
) {
  const approved = Boolean(input.approved);
  const now = deps.now ?? (() => new Date());
  const row: TablesInsert<"source_excerpts"> = {
    source_document_id: requiredText(input.sourceDocumentId, "Source document"),
    excerpt: requiredText(input.excerpt, "Source excerpt"),
    topic_tags: input.topicTags ?? [],
    approved,
    approved_by: approved ? (input.approvedBy ?? null) : null,
    approved_at: approved ? now().toISOString() : null,
  };

  return insertSingle<SourceExcerpt>(
    deps.client ?? createAdminClient(),
    "source_excerpts",
    row,
    SOURCE_EXCERPT_FIELDS,
    "Could not create source excerpt.",
  );
}

export async function adminCreateApprovedClaim(
  input: CreateApprovedClaimInput,
  deps: ServiceDeps = {},
) {
  const now = deps.now ?? (() => new Date());
  const row: TablesInsert<"approved_claims"> = {
    claim: requiredText(input.claim, "Claim"),
    claim_type: requiredText(input.claimType, "Claim type"),
    source_excerpt_id: requiredText(input.sourceExcerptId, "Source excerpt"),
    usage_notes: nullableText(input.usageNotes),
    risk_level: normalizeAllowed(input.riskLevel, CLAIM_RISK_LEVELS, "low"),
    approved_by: input.approvedBy ?? null,
    approved_at: now().toISOString(),
  };

  return insertSingle<ApprovedClaim>(
    deps.client ?? createAdminClient(),
    "approved_claims",
    row,
    APPROVED_CLAIM_FIELDS,
    "Could not create approved claim.",
  );
}

async function listTable<T>(
  client: LibraryClient,
  tableName: keyof Database["public"]["Tables"],
  fields: string,
) {
  const { data, error } = await client
    .from(tableName)
    .select(fields)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not list ${tableName}.`);
  return (data ?? []) as T[];
}

async function insertSingle<T>(
  client: LibraryClient,
  tableName: keyof Database["public"]["Tables"],
  row: object,
  fields: string,
  message: string,
) {
  const { data, error } = await client
    .from(tableName)
    .insert(row as never)
    .select(fields)
    .single();
  if (error) throw new Error(message);
  return data as T;
}

function requiredText(value: string, label: string) {
  const next = value.trim();
  if (!next) throw new Error(`${label} is required.`);
  return next;
}

function nullableText(value: string | null | undefined) {
  const next = value?.trim();
  return next || null;
}

function normalizeAllowed(
  value: string,
  allowed: Set<string>,
  fallback: string,
) {
  const next = value.trim();
  return allowed.has(next) ? next : fallback;
}

function requiredAllowed(value: string, allowed: Set<string>, label: string) {
  const next = requiredText(value, label);
  if (!allowed.has(next)) throw new Error(`${label} is invalid.`);
  return next;
}

function normalizeHref(value: string) {
  const href = requiredText(value, "CTA href");
  if (
    href.startsWith("/") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return href;
  }
  throw new Error("CTA href must be a relative path or approved URL.");
}
