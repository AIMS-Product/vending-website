import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  buildPaidAttributionProperties,
  paidAttributionMetadata,
} from "@/lib/paid-attribution";
import {
  emailText,
  leadSourceSchemaFields,
  optionalText,
  requiredText,
  type LeadSourceInputFields,
} from "@/lib/services/lead-source-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/types/database";
import { assignInvestVariant } from "@/lib/qualification/scoring";
import {
  getQualificationFormVersion,
  resolveDefaultQualificationFormVersion,
  resolvePublishedQualificationFormVersion,
  type QualificationPublishedVersion,
} from "./qualification-forms";

type LeadRow = Tables<"lead_submissions">;
type LeadInsert = Database["public"]["Tables"]["lead_submissions"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["lead_submissions"]["Update"];
type QualificationSessionInsert =
  Database["public"]["Tables"]["qualification_sessions"]["Insert"];
type CloseSyncEventInsert =
  Database["public"]["Tables"]["close_sync_events"]["Insert"];
type QualificationIntakeClient = Pick<SupabaseClient<Database>, "from">;

export type CreateQualificationIntakeInput = LeadSourceInputFields & {
  idempotencyKey?: unknown;
  fullName: unknown;
  email: unknown;
  phone: unknown;
  qualificationFormId?: unknown;
  qualificationFormVersionId?: unknown;
  completionRedirectPath?: unknown;
  experimentKey?: unknown;
  variantKey?: unknown;
};

export type CreateQualificationIntakeDeps = {
  client?: QualificationIntakeClient;
  now?: () => Date;
  tokenFactory?: () => string;
  idFactory?: () => string;
};

export type CreateQualificationIntakeResult = {
  status: "accepted";
  leadId: string;
  sessionId: string;
  formId: string;
  formVersionId: string;
  qualificationUrl: string;
  staleAt: string;
  expiresAt: string;
  // The raw (unhashed) session token, for server-side callers that drive the
  // session further in the same request (e.g. the inline qualification
  // orchestrator). Only the hash is ever persisted; callers must not forward
  // this value to the browser or include it in a returned action state.
  sessionToken: string;
};

class QualificationIntakeServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QualificationIntakeServiceError";
  }
}

export class QualificationIntakeValidationError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>) {
    super("Invalid qualification intake");
    this.name = "QualificationIntakeValidationError";
    this.fieldErrors = fieldErrors;
  }
}

const intakeInputSchema = z.object({
  idempotencyKey: optionalText("Submission key", 160),
  fullName: requiredText("Name", 140),
  email: emailText(),
  phone: requiredText("Phone", 60),
  qualificationFormId: optionalText("Qualification form", 80),
  qualificationFormVersionId: optionalText("Qualification form version", 80),
  completionRedirectPath: optionalText("Completion redirect", 500),
  ...leadSourceSchemaFields,
  experimentKey: optionalText("Experiment key", 120),
  variantKey: optionalText("Variant key", 120),
});

type ValidIntakeInput = z.output<typeof intakeInputSchema>;

const LEAD_FIELDS =
  "id,idempotency_key,status,notification_error,close_contact_id,close_lead_id,created_at" as const;

export async function createQualificationIntakeSession(
  input: CreateQualificationIntakeInput,
  deps: CreateQualificationIntakeDeps = {},
): Promise<CreateQualificationIntakeResult> {
  const intake = parseIntakeInput(input);
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();
  const nowIso = now.toISOString();
  const idFactory = deps.idFactory ?? randomUUID;
  const idempotencyKey = intake.idempotencyKey ?? idFactory();
  const token = deps.tokenFactory?.() ?? randomSessionToken();
  const tokenHash = hashSessionToken(token);
  const formVersion = await resolveFormVersion(intake, client);
  const matchingLead = await findLatestLeadByEmail(client, intake.email);
  const lead =
    (await findLeadByIdempotency(client, idempotencyKey)) ??
    (await insertQualificationLead(client, {
      intake,
      idempotencyKey,
      matchingLead,
      formVersion,
      nowIso,
    }));
  const staleAt = addDays(now, 7).toISOString();
  const expiresAt = addDays(now, 30).toISOString();

  // A/B: honour an explicit page-authored variant, otherwise assign a
  // deterministic 50/50 invest variant seeded on the stable lead id so a
  // visitor always sees the same variant across renders.
  const variantKey = intake.variantKey || assignInvestVariant(lead.id);

  const session = await insertQualificationSession(client, {
    intake,
    leadId: lead.id,
    variantKey,
    formVersion,
    tokenHash,
    nowIso,
    staleAt,
    expiresAt,
  });

  await updateLeadQualificationPointers(client, lead.id, {
    latest_qualification_form_id: formVersion.formId,
    latest_qualification_form_version_id: formVersion.versionId,
    latest_qualification_session_id: session.id,
    latest_qualification_started_at: nowIso,
    lifecycle_status: "qualification_pending",
    close_sync_status: "pending",
    close_sync_next_retry_at: nowIso,
  });

  await enqueueLeadCloseSync(client, {
    intake,
    lead,
    sessionId: session.id,
    formVersion,
    nowIso,
  });

  return {
    status: "accepted",
    leadId: lead.id,
    sessionId: session.id,
    formId: formVersion.formId,
    formVersionId: formVersion.versionId,
    qualificationUrl: `/qualify/${encodeURIComponent(token)}`,
    staleAt,
    expiresAt,
    sessionToken: token,
  };
}

function parseIntakeInput(input: CreateQualificationIntakeInput) {
  const parsed = intakeInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new QualificationIntakeValidationError(
      parsed.error.flatten().fieldErrors,
    );
  }
  return parsed.data;
}

async function resolveFormVersion(
  intake: ValidIntakeInput,
  client: QualificationIntakeClient,
) {
  if (intake.qualificationFormVersionId) {
    return getQualificationFormVersion(
      { versionId: intake.qualificationFormVersionId },
      { client },
    );
  }

  if (intake.qualificationFormId) {
    const formVersion = await resolvePublishedQualificationFormVersion(
      { formId: intake.qualificationFormId },
      { client },
    );
    if (formVersion) return formVersion;
    throw new QualificationIntakeServiceError(
      "Selected qualification form is not published.",
    );
  }

  const formVersion = await resolveDefaultQualificationFormVersion({ client });
  if (!formVersion) {
    throw new QualificationIntakeServiceError(
      "No published qualification form is available.",
    );
  }
  return formVersion;
}

async function findLeadByIdempotency(
  client: QualificationIntakeClient,
  idempotencyKey: string,
): Promise<LeadRow | null> {
  const { data, error } = await client
    .from("lead_submissions")
    .select(LEAD_FIELDS)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new QualificationIntakeServiceError(
      "Could not check qualification intake idempotency.",
    );
  }
  return data as LeadRow | null;
}

async function findLatestLeadByEmail(
  client: QualificationIntakeClient,
  email: string,
): Promise<Pick<LeadRow, "close_contact_id" | "close_lead_id"> | null> {
  const { data, error } = await client
    .from("lead_submissions")
    .select("close_contact_id,close_lead_id,created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new QualificationIntakeServiceError(
      "Could not check existing local lead mappings.",
    );
  }
  return data as Pick<LeadRow, "close_contact_id" | "close_lead_id"> | null;
}

async function insertQualificationLead(
  client: QualificationIntakeClient,
  {
    intake,
    idempotencyKey,
    matchingLead,
    formVersion,
    nowIso,
  }: {
    intake: ValidIntakeInput;
    idempotencyKey: string;
    matchingLead: Pick<LeadRow, "close_contact_id" | "close_lead_id"> | null;
    formVersion: QualificationPublishedVersion;
    nowIso: string;
  },
): Promise<LeadRow> {
  const row: LeadInsert = {
    idempotency_key: idempotencyKey,
    form_type: "contact",
    status: "received",
    full_name: intake.fullName,
    email: intake.email,
    phone: intake.phone,
    source_path: intake.sourcePath,
    landing_path: intake.landingPath,
    referrer: intake.referrer,
    user_agent: intake.userAgent,
    source_page_id: intake.sourcePageId,
    source_page_slug: intake.sourcePageSlug,
    target_keyword: intake.targetKeyword,
    source_block_id: intake.sourceBlockId,
    source_cta_tracking_name: intake.sourceCtaTrackingName,
    utm_source: intake.utmSource,
    utm_medium: intake.utmMedium,
    utm_campaign: intake.utmCampaign,
    utm_term: intake.utmTerm,
    utm_content: intake.utmContent,
    lifecycle_status: "qualification_pending",
    latest_qualification_form_id: formVersion.formId,
    latest_qualification_form_version_id: formVersion.versionId,
    latest_qualification_started_at: nowIso,
    close_contact_id: matchingLead?.close_contact_id ?? null,
    close_lead_id: matchingLead?.close_lead_id ?? null,
    close_sync_status: "pending",
    close_sync_next_retry_at: nowIso,
    qualification_summary: {
      status: "qualification_pending",
      form_id: formVersion.formId,
      form_version_id: formVersion.versionId,
    } satisfies Json,
    metadata: {
      qualification_intake: true,
      completion_redirect_path: intake.completionRedirectPath,
      experiment_key: intake.experimentKey,
      variant_key: intake.variantKey,
      ...paidAttributionMetadata(intake),
      ...attributionSessionMetadata(intake),
    } satisfies Json,
  };

  const { data, error } = await client
    .from("lead_submissions")
    .insert(row)
    .select(LEAD_FIELDS)
    .single();

  if (error || !data) {
    throw new QualificationIntakeServiceError(
      "Could not store qualification intake lead.",
    );
  }
  return data as LeadRow;
}

async function insertQualificationSession(
  client: QualificationIntakeClient,
  {
    intake,
    leadId,
    variantKey,
    formVersion,
    tokenHash,
    nowIso,
    staleAt,
    expiresAt,
  }: {
    intake: ValidIntakeInput;
    leadId: string;
    variantKey: string;
    formVersion: QualificationPublishedVersion;
    tokenHash: string;
    nowIso: string;
    staleAt: string;
    expiresAt: string;
  },
): Promise<Pick<Tables<"qualification_sessions">, "id">> {
  const row: QualificationSessionInsert = {
    lead_submission_id: leadId,
    form_id: formVersion.formId,
    form_version_id: formVersion.versionId,
    session_token_hash: tokenHash,
    status: "pending",
    completion_redirect_path: intake.completionRedirectPath,
    source_path: intake.sourcePath,
    landing_path: intake.landingPath,
    referrer: intake.referrer,
    user_agent: intake.userAgent,
    utm_source: intake.utmSource,
    utm_medium: intake.utmMedium,
    utm_campaign: intake.utmCampaign,
    utm_term: intake.utmTerm,
    utm_content: intake.utmContent,
    source_page_id: intake.sourcePageId,
    source_page_slug: intake.sourcePageSlug,
    target_keyword: intake.targetKeyword,
    source_block_id: intake.sourceBlockId,
    source_cta_tracking_name: intake.sourceCtaTrackingName,
    experiment_key: intake.experimentKey,
    variant_key: variantKey,
    current_question_id: formVersion.schema.questions[0]?.id ?? null,
    consent_source_attribution: buildSourceAttribution(intake),
    stale_at: staleAt,
    expires_at: expiresAt,
    started_at: nowIso,
  };

  const { data, error } = await client
    .from("qualification_sessions")
    .insert(row)
    .select("id")
    .single();

  if (error || !data) {
    throw new QualificationIntakeServiceError(
      "Could not create qualification session.",
    );
  }
  return data as Pick<Tables<"qualification_sessions">, "id">;
}

async function updateLeadQualificationPointers(
  client: QualificationIntakeClient,
  leadId: string,
  patch: LeadUpdate,
) {
  const { error } = await client
    .from("lead_submissions")
    .update(patch)
    .eq("id", leadId);

  if (error) {
    throw new QualificationIntakeServiceError(
      "Qualification session was created but lead status was not updated.",
    );
  }
}

async function enqueueLeadCloseSync(
  client: QualificationIntakeClient,
  {
    intake,
    lead,
    sessionId,
    formVersion,
    nowIso,
  }: {
    intake: ValidIntakeInput;
    lead: Pick<LeadRow, "id" | "close_contact_id" | "close_lead_id">;
    sessionId: string;
    formVersion: QualificationPublishedVersion;
    nowIso: string;
  },
) {
  const event: CloseSyncEventInsert = {
    lead_submission_id: lead.id,
    session_id: sessionId,
    event_type: "lead_create_or_update",
    status: "pending",
    dedupe_key: `lead_create_or_update:${lead.id}:${sessionId}`,
    next_retry_at: nowIso,
    close_contact_id: lead.close_contact_id,
    close_lead_id: lead.close_lead_id,
    payload: {
      source: "qualification_intake",
      contact: {
        full_name: intake.fullName,
        email: intake.email,
        phone: intake.phone,
      },
      attribution: buildSourceAttribution(intake),
      qualification: {
        status: "qualification_pending",
        formId: formVersion.formId,
        formVersionId: formVersion.versionId,
        sessionId,
        completionRedirectPath: intake.completionRedirectPath,
        experimentKey: intake.experimentKey,
        variantKey: intake.variantKey,
      },
    } satisfies Json,
  };

  const { error } = await client
    .from("close_sync_events")
    .insert(event)
    .select("id")
    .single();

  if (error) {
    throw new QualificationIntakeServiceError(
      "Qualification session was created but Close sync was not queued.",
    );
  }
}

function buildSourceAttribution(intake: ValidIntakeInput): Json {
  return {
    vp_session_id: intake.vpSessionId,
    source_path: intake.sourcePath,
    landing_path: intake.landingPath,
    referrer: intake.referrer,
    first_landing_url: intake.firstLandingUrl,
    first_landing_path: intake.firstLandingPath,
    first_referrer: intake.firstReferrer,
    first_touch_at: intake.firstTouchAt,
    latest_landing_url: intake.latestLandingUrl,
    latest_landing_path: intake.latestLandingPath,
    latest_referrer: intake.latestReferrer,
    latest_touch_at: intake.latestTouchAt,
    source_page_id: intake.sourcePageId,
    source_page_slug: intake.sourcePageSlug,
    target_keyword: intake.targetKeyword,
    source_block_id: intake.sourceBlockId,
    source_cta_tracking_name: intake.sourceCtaTrackingName,
    clicked_href: intake.clickedHref,
    user_agent: intake.userAgent,
    utm_source: intake.utmSource,
    utm_medium: intake.utmMedium,
    utm_campaign: intake.utmCampaign,
    utm_term: intake.utmTerm,
    utm_content: intake.utmContent,
    ...buildPaidAttributionProperties(intake),
    experiment_key: intake.experimentKey,
    variant_key: intake.variantKey,
  };
}

function attributionSessionMetadata(
  intake: ValidIntakeInput,
): Record<string, Json> {
  const attributionSession = compactObject({
    vp_session_id: intake.vpSessionId,
    first_landing_url: intake.firstLandingUrl,
    first_landing_path: intake.firstLandingPath,
    first_referrer: intake.firstReferrer,
    first_touch_at: intake.firstTouchAt,
    latest_landing_url: intake.latestLandingUrl,
    latest_landing_path: intake.latestLandingPath,
    latest_referrer: intake.latestReferrer,
    latest_touch_at: intake.latestTouchAt,
    clicked_href: intake.clickedHref,
  });
  return Object.keys(attributionSession).length
    ? { attribution_session: attributionSession }
    : {};
}

function compactObject(input: Record<string, string | null>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== null && value !== ""),
  );
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function randomSessionToken() {
  return randomBytes(32).toString("base64url");
}

function hashSessionToken(token: string) {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}
