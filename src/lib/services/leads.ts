import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "@/lib/config";
import {
  buildPaidAttributionProperties,
  channelFromAttributionSignals,
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
import {
  isDuplicateDedupeError,
  leadCreateOrUpdateDedupeKey,
} from "@/lib/close/dedupe";
import type { Database, Json, Tables } from "@/types/database";

type LeadRow = Tables<"lead_submissions">;
type LeadInsert = Database["public"]["Tables"]["lead_submissions"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["lead_submissions"]["Update"];
type CloseSyncEventInsert =
  Database["public"]["Tables"]["close_sync_events"]["Insert"];
type LeadClient = Pick<SupabaseClient<Database>, "from">;
type StoredLead = Pick<
  LeadRow,
  | "id"
  | "status"
  | "notification_error"
  | "notification_sent_at"
  | "close_contact_id"
  | "close_lead_id"
  | "close_sync_status"
>;

export type LeadActionFormType = "apply" | "contact" | "newsletter";

export type LeadNotificationEnv = {
  RESEND_API_KEY?: string;
  LEAD_NOTIFICATION_TO?: string;
  LEAD_NOTIFICATION_FROM?: string;
  LEAD_NOTIFICATION_SUBJECT_PREFIX?: string;
  SLACK_WEBHOOK_URL?: string;
  MONEY_PAGE_INGEST_URL?: string;
  MONEY_PAGE_SECRET?: string;
};

export type SubmitLeadResult = {
  status: "accepted";
  leadId: string;
  duplicate: boolean;
  notificationStatus: LeadRow["status"];
  notificationError: string | null;
};

export type SubmitLeadDeps = {
  client?: LeadClient;
  env?: LeadNotificationEnv;
  fetchImpl?: typeof fetch;
  idFactory?: () => string;
  now?: () => Date;
};

const metadataSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .optional()
  .default({});

const leadInputSchema = z
  .object({
    formType: z.enum(["apply", "contact", "newsletter"]),
    idempotencyKey: optionalText("Submission key", 160),
    fullName: requiredText("Name", 140),
    email: emailText(),
    phone: optionalText("Phone", 60),
    city: optionalText("City", 120),
    stateRegion: optionalText("State", 120),
    businessStage: optionalText("Business stage", 160),
    budget: optionalText("Budget", 120),
    timeline: optionalText("Timeline", 120),
    message: optionalText("Message", 3000),
    ...leadSourceSchemaFields,
    metadata: metadataSchema,
  })
  .superRefine((lead, ctx) => {
    if (lead.formType !== "apply") return;

    for (const field of applyQualificationFields) {
      if (lead[field.key]) continue;
      ctx.addIssue({
        code: "custom",
        path: [field.key],
        message: `${field.label} is required.`,
      });
    }
  });

const applyQualificationFields = [
  { key: "stateRegion", label: "State" },
  { key: "businessStage", label: "Business stage" },
  { key: "budget", label: "Budget" },
  { key: "timeline", label: "Timeline" },
] as const;
const STORED_LEAD_FIELDS =
  "id,status,notification_error,notification_sent_at,close_contact_id,close_lead_id,close_sync_status" as const;

export type SubmitLeadInput = LeadSourceInputFields & {
  formType: LeadActionFormType;
  fullName: unknown;
  email: unknown;
  idempotencyKey?: unknown;
  phone?: unknown;
  city?: unknown;
  stateRegion?: unknown;
  businessStage?: unknown;
  budget?: unknown;
  timeline?: unknown;
  message?: unknown;
  metadata?: Record<string, string | number | boolean | null>;
};
type ValidLeadInput = z.output<typeof leadInputSchema>;

/**
 * What the notification channels actually read. A fully validated lead
 * satisfies it, and so does the narrower shape the inline qualification funnel
 * has on hand — that funnel never collects the apply-form fields, so it cannot
 * produce a `ValidLeadInput`. Every optional field is rendered through
 * `fieldLine`, which drops blanks.
 */
type NotifiableLead = Pick<ValidLeadInput, "formType" | "fullName" | "email"> &
  Partial<ValidLeadInput>;

export class LeadValidationError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>) {
    super("Invalid lead submission");
    this.name = "LeadValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export async function submitLead(
  input: SubmitLeadInput,
  deps: SubmitLeadDeps = {},
): Promise<SubmitLeadResult> {
  const lead = parseLeadInput(input);
  const client = deps.client ?? createAdminClient();
  const env = deps.env ?? notificationEnvFromConfig();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());
  const idFactory = deps.idFactory ?? (() => crypto.randomUUID());
  const idempotencyKey = lead.idempotencyKey ?? idFactory();
  const closeSyncQueuedAt = now().toISOString();

  const existing = await findExistingLead(client, idempotencyKey);
  if (existing) {
    await ensurePublicLeadCloseSync(client, lead, existing, closeSyncQueuedAt);
    return {
      status: "accepted",
      leadId: existing.id,
      duplicate: true,
      notificationStatus: existing.status,
      notificationError: existing.notification_error,
    };
  }

  const inserted = await insertLead(client, lead, idempotencyKey, env);
  await ensurePublicLeadCloseSync(client, lead, inserted, closeSyncQueuedAt);
  const notification = await sendLeadNotifications(lead, {
    env,
    fetchImpl,
  });
  const attemptedAt = now().toISOString();

  const patch: LeadUpdate = notification.ok
    ? {
        status: "notified",
        notification_attempted_at: attemptedAt,
        notification_sent_at: attemptedAt,
        notification_error: null,
      }
    : {
        status: "notification_failed",
        notification_attempted_at: attemptedAt,
        notification_sent_at: null,
        notification_error: notification.error,
      };

  await updateNotificationStatus(client, inserted.id, patch);
  const moneyPageTracking = await sendMoneyPageLeadEvent(lead, inserted.id, {
    env,
    fetchImpl,
  });
  if (!moneyPageTracking.ok) {
    console.warn("money page lead tracking failed", {
      leadId: inserted.id,
      error: moneyPageTracking.error,
    });
  }

  return {
    status: "accepted",
    leadId: inserted.id,
    duplicate: false,
    notificationStatus: patch.status ?? "received",
    notificationError: patch.notification_error ?? null,
  };
}

function parseLeadInput(input: SubmitLeadInput) {
  const parsed = leadInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new LeadValidationError(parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

function notificationEnvFromConfig(): LeadNotificationEnv {
  return {
    RESEND_API_KEY: config.RESEND_API_KEY,
    LEAD_NOTIFICATION_TO: config.LEAD_NOTIFICATION_TO,
    LEAD_NOTIFICATION_FROM: config.LEAD_NOTIFICATION_FROM,
    LEAD_NOTIFICATION_SUBJECT_PREFIX: config.LEAD_NOTIFICATION_SUBJECT_PREFIX,
    SLACK_WEBHOOK_URL: config.SLACK_WEBHOOK_URL,
    MONEY_PAGE_INGEST_URL: config.MONEY_PAGE_INGEST_URL,
    MONEY_PAGE_SECRET: config.MONEY_PAGE_SECRET,
  };
}

async function findExistingLead(
  client: LeadClient,
  idempotencyKey: string,
): Promise<StoredLead | null> {
  const { data, error } = await client
    .from("lead_submissions")
    .select(STORED_LEAD_FIELDS)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) throw new Error("Could not check lead idempotency.");
  return data;
}

async function insertLead(
  client: LeadClient,
  lead: ValidLeadInput,
  idempotencyKey: string,
  env: LeadNotificationEnv,
) {
  const row: LeadInsert = {
    idempotency_key: idempotencyKey,
    form_type: lead.formType,
    status: "received",
    full_name: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    city: lead.city,
    state_region: lead.stateRegion,
    business_stage: lead.businessStage,
    budget: lead.budget,
    timeline: lead.timeline,
    message: lead.message,
    source_path: lead.sourcePath,
    landing_path: lead.landingPath,
    referrer: lead.referrer,
    source_page_id: lead.sourcePageId,
    source_page_slug: lead.sourcePageSlug,
    target_keyword: lead.targetKeyword,
    source_block_id: lead.sourceBlockId,
    source_cta_tracking_name: lead.sourceCtaTrackingName,
    user_agent: lead.userAgent,
    utm_source: lead.utmSource,
    utm_medium: lead.utmMedium,
    utm_campaign: lead.utmCampaign,
    utm_term: lead.utmTerm,
    utm_content: lead.utmContent,
    metadata: {
      ...lead.metadata,
      ...paidAttributionMetadata(lead),
      ...attributionSessionMetadata(lead),
      notification_email_configured: Boolean(
        env.RESEND_API_KEY &&
        env.LEAD_NOTIFICATION_TO &&
        env.LEAD_NOTIFICATION_FROM,
      ),
      notification_slack_configured: Boolean(env.SLACK_WEBHOOK_URL),
    } satisfies Json,
  };

  const { data, error } = await client
    .from("lead_submissions")
    .insert(row)
    .select(STORED_LEAD_FIELDS)
    .single();

  if (error) throw new Error("Could not store lead submission.");
  return data;
}

async function ensurePublicLeadCloseSync(
  client: LeadClient,
  lead: ValidLeadInput,
  storedLead: StoredLead,
  nowIso: string,
) {
  if (storedLead.close_sync_status) return;

  const { error } = await client
    .from("close_sync_events")
    .insert(buildPublicLeadCloseSyncEvent(lead, storedLead, nowIso))
    .select("id")
    .single();

  // A duplicate means this lead's push is already queued — a re-submit, not a
  // failure. Throwing here would fail a submit whose work is already done.
  if (error && !isDuplicateDedupeError(error)) {
    throw new Error("Lead was stored but Close sync was not queued.");
  }

  await updateCloseSyncStatus(client, storedLead.id, {
    close_sync_status: "pending",
    close_sync_next_retry_at: nowIso,
    close_sync_last_error: null,
  });
}

function buildPublicLeadCloseSyncEvent(
  lead: ValidLeadInput,
  storedLead: StoredLead,
  nowIso: string,
): CloseSyncEventInsert {
  return {
    lead_submission_id: storedLead.id,
    session_id: null,
    event_type: "lead_create_or_update",
    status: "pending",
    dedupe_key: leadCreateOrUpdateDedupeKey(storedLead.id),
    next_retry_at: nowIso,
    close_contact_id: storedLead.close_contact_id,
    close_lead_id: storedLead.close_lead_id,
    payload: {
      source: "public_lead_form",
      contact: {
        full_name: lead.fullName,
        email: lead.email,
        phone: lead.phone,
      },
      attribution: buildSourceAttribution(lead),
      lead: {
        formType: lead.formType,
        city: lead.city,
        stateRegion: lead.stateRegion,
        businessStage: lead.businessStage,
        budget: lead.budget,
        timeline: lead.timeline,
      },
    } satisfies Json,
  };
}

function buildSourceAttribution(lead: ValidLeadInput): Json {
  return {
    ...sourceAttributionProperties(lead),
    user_agent: lead.userAgent,
    utm_source: lead.utmSource,
    utm_medium: lead.utmMedium,
    utm_campaign: lead.utmCampaign,
    utm_term: lead.utmTerm,
    utm_content: lead.utmContent,
    ...buildPaidAttributionProperties(lead),
  };
}

function attributionSessionMetadata(
  lead: ValidLeadInput,
): Record<string, Json> {
  const attributionSession = compactObject({
    vp_session_id: lead.vpSessionId,
    first_landing_url: lead.firstLandingUrl,
    first_landing_path: lead.firstLandingPath,
    first_referrer: lead.firstReferrer,
    first_touch_at: lead.firstTouchAt,
    latest_landing_url: lead.latestLandingUrl,
    latest_landing_path: lead.latestLandingPath,
    latest_referrer: lead.latestReferrer,
    latest_touch_at: lead.latestTouchAt,
    clicked_href: lead.clickedHref,
  });
  return Object.keys(attributionSession).length
    ? { attribution_session: attributionSession }
    : {};
}

async function updateNotificationStatus(
  client: LeadClient,
  leadId: string,
  patch: LeadUpdate,
) {
  const { error } = await client
    .from("lead_submissions")
    .update(patch)
    .eq("id", leadId);

  if (error) {
    throw new Error("Lead was stored but notification status was not updated.");
  }
}

async function updateCloseSyncStatus(
  client: LeadClient,
  leadId: string,
  patch: LeadUpdate,
) {
  const { error } = await client
    .from("lead_submissions")
    .update(patch)
    .eq("id", leadId);

  if (error) {
    throw new Error("Lead was stored but Close sync status was not updated.");
  }
}

/**
 * Notify the team about a lead captured by the inline qualification funnel
 * (`/contact`, `/booking-meta`, `/booking-youtube`). Those routes submit through
 * `submitInlineQualification`, not `submitLead`, so without this they reach
 * Close but never Slack or email.
 */
export async function notifyQualificationLead(
  lead: NotifiableLead,
  {
    env = notificationEnvFromConfig(),
    fetchImpl = fetch,
  }: {
    env?: LeadNotificationEnv;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  return sendLeadNotifications(lead, { env, fetchImpl });
}

async function sendLeadNotifications(
  lead: NotifiableLead,
  {
    env,
    fetchImpl,
  }: {
    env: LeadNotificationEnv;
    fetchImpl: typeof fetch;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Each channel is independent. Send to whichever is configured (email, Slack,
  // or both) and succeed as long as every configured channel succeeds. Slack
  // works standalone — email is no longer required.
  const recipients = parseRecipients(env.LEAD_NOTIFICATION_TO);
  const resendApiKey = env.RESEND_API_KEY;
  const from = env.LEAD_NOTIFICATION_FROM;
  const slackWebhookUrl = env.SLACK_WEBHOOK_URL;
  const emailConfigured = Boolean(resendApiKey && from && recipients.length);
  const slackConfigured = Boolean(slackWebhookUrl);

  if (!emailConfigured && !slackConfigured) {
    return {
      ok: false,
      error: "Lead notifications are not configured.",
    };
  }

  const errors: string[] = [];

  if (emailConfigured && resendApiKey && from) {
    const email = await sendResendEmail(lead, {
      apiKey: resendApiKey,
      from,
      to: recipients,
      subjectPrefix: env.LEAD_NOTIFICATION_SUBJECT_PREFIX,
      fetchImpl,
    });
    if (!email.ok) errors.push(email.error);
  }

  if (slackConfigured && slackWebhookUrl) {
    const slack = await sendSlackWebhook(lead, slackWebhookUrl, fetchImpl);
    if (!slack.ok) errors.push(slack.error);
  }

  if (errors.length) {
    return { ok: false, error: errors.join("; ") };
  }
  return { ok: true };
}

async function sendResendEmail(
  lead: NotifiableLead,
  {
    apiKey,
    from,
    to,
    subjectPrefix,
    fetchImpl,
  }: {
    apiKey: string;
    from: string;
    to: string[];
    subjectPrefix?: string;
    fetchImpl: typeof fetch;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  // A rejecting fetch (DNS failure, socket hang-up, timeout) must degrade to
  // `notification_failed` like a 5xx does. Letting it throw would escape
  // submitLead before the status patch runs, so the lead row would sit at
  // "received" while the visitor is told their submission failed — even though
  // it was already stored and queued to Close.
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: `${subjectPrefix ?? "Vendingpreneurs"} ${emailSubjectLabel(lead.formType)}`,
        text: formatLeadText(lead),
      }),
    });

    if (!response.ok) {
      const body = await safeResponseText(response);
      return {
        ok: false,
        error: `Resend email failed with ${response.status}${body ? `: ${body}` : ""}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Resend email request failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

async function sendSlackWebhook(
  lead: NotifiableLead,
  webhookUrl: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // See sendResendEmail: a rejecting fetch has to become a failed notification,
  // not a failed lead submit.
  try {
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: formatSlackText(lead) }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Slack webhook failed with ${response.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Slack webhook request failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

// Money-page tracking needs the full validated lead, so it stays on the
// submitLead path only — the inline funnel does not feed it.
async function sendMoneyPageLeadEvent(
  lead: ValidLeadInput,
  leadId: string,
  {
    env,
    fetchImpl,
  }: {
    env: LeadNotificationEnv;
    fetchImpl: typeof fetch;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!env.MONEY_PAGE_INGEST_URL || !env.MONEY_PAGE_SECRET) {
    return { ok: true };
  }

  try {
    const response = await fetchImpl(env.MONEY_PAGE_INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": env.MONEY_PAGE_SECRET,
      },
      body: JSON.stringify(buildMoneyPagePayload(lead, leadId)),
    });

    if (!response.ok) {
      const body = await safeResponseText(response);
      return {
        ok: false,
        error: `Money Page webhook failed with ${response.status}${body ? `: ${body}` : ""}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

function buildMoneyPagePayload(lead: ValidLeadInput, leadId: string) {
  return {
    event_type: "lead_captured",
    external_id: `vending-website:lead_captured:${lead.vpSessionId ?? leadId}:${leadId}`,
    occurred_at: new Date().toISOString(),
    email: lead.email,
    phone: lead.phone ?? undefined,
    name: lead.fullName,
    channel: channelFromAttributionSignals(lead),
    properties: compactObject({
      lead_id: leadId,
      form_type: lead.formType,
      ...sourceAttributionProperties(lead),
      utm_source: lead.utmSource,
      utm_medium: lead.utmMedium,
      utm_campaign: lead.utmCampaign,
      utm_term: lead.utmTerm,
      utm_content: lead.utmContent,
      ...buildPaidAttributionProperties(lead),
      city: lead.city,
      state_region: lead.stateRegion,
      business_stage: lead.businessStage,
      budget: lead.budget,
      timeline: lead.timeline,
      message_present: Boolean(lead.message),
    }),
  };
}

function sourceAttributionProperties(lead: ValidLeadInput) {
  return {
    vp_session_id: lead.vpSessionId,
    source_path: lead.sourcePath,
    landing_path: lead.landingPath,
    referrer: lead.referrer,
    first_landing_url: lead.firstLandingUrl,
    first_landing_path: lead.firstLandingPath,
    first_referrer: lead.firstReferrer,
    first_touch_at: lead.firstTouchAt,
    latest_landing_url: lead.latestLandingUrl,
    latest_landing_path: lead.latestLandingPath,
    latest_referrer: lead.latestReferrer,
    latest_touch_at: lead.latestTouchAt,
    source_page_id: lead.sourcePageId,
    source_page_slug: lead.sourcePageSlug,
    target_keyword: lead.targetKeyword,
    source_block_id: lead.sourceBlockId,
    source_cta_tracking_name: lead.sourceCtaTrackingName,
    clicked_href: lead.clickedHref,
  };
}

function compactObject(
  input: Record<string, string | boolean | null | undefined>,
) {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    ),
  );
}

function parseRecipients(value?: string) {
  return (
    value?.split(",").flatMap((recipient) => {
      const trimmed = recipient.trim();
      return trimmed ? [trimmed] : [];
    }) ?? []
  );
}

function formatLeadText(lead: NotifiableLead) {
  return [
    `Form: ${lead.formType}`,
    `Name: ${lead.fullName}`,
    `Email: ${lead.email}`,
    fieldLine("Phone", lead.phone),
    fieldLine("City", lead.city),
    fieldLine("State", lead.stateRegion),
    fieldLine("Business stage", lead.businessStage),
    fieldLine("Budget", lead.budget),
    fieldLine("Timeline", lead.timeline),
    fieldLine("Source path", lead.sourcePath),
    fieldLine("Source page", lead.sourcePageSlug),
    fieldLine("Target keyword", lead.targetKeyword),
    fieldLine("Source block", lead.sourceBlockId),
    fieldLine("Source CTA", lead.sourceCtaTrackingName),
    fieldLine("Landing path", lead.landingPath),
    fieldLine("UTM source", lead.utmSource),
    fieldLine("UTM medium", lead.utmMedium),
    fieldLine("UTM campaign", lead.utmCampaign),
    "",
    "Message:",
    lead.message ?? "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function formatSlackText(lead: NotifiableLead) {
  const label = slackHeading(lead.formType);
  return [
    `*${label}*`,
    `${lead.fullName} <${lead.email}>`,
    fieldLine("Phone", lead.phone),
    fieldLine("Source", lead.sourcePath),
    fieldLine("Resource", lead.sourcePageSlug),
    fieldLine("CTA", lead.sourceCtaTrackingName),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function emailSubjectLabel(formType: LeadActionFormType) {
  if (formType === "apply") return "application lead";
  if (formType === "newsletter") return "newsletter subscriber";
  return "contact lead";
}

function slackHeading(formType: LeadActionFormType) {
  if (formType === "apply") return "New application lead";
  if (formType === "newsletter") return "New newsletter subscriber";
  return "New contact lead";
}

function fieldLine(label: string, value: string | null | undefined) {
  return value ? `${label}: ${value}` : null;
}

async function safeResponseText(response: Response) {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return "";
  }
}
