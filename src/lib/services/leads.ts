import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/types/database";

type LeadRow = Tables<"lead_submissions">;
type LeadInsert = Database["public"]["Tables"]["lead_submissions"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["lead_submissions"]["Update"];
type LeadClient = Pick<SupabaseClient<Database>, "from">;

export type LeadActionFormType = "apply" | "contact";

export type LeadNotificationEnv = {
  RESEND_API_KEY?: string;
  LEAD_NOTIFICATION_TO?: string;
  LEAD_NOTIFICATION_FROM?: string;
  LEAD_NOTIFICATION_SUBJECT_PREFIX?: string;
  SLACK_WEBHOOK_URL?: string;
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

const requiredText = (label: string, max: number) =>
  z.preprocess(
    stringifyFormValue,
    z
      .string()
      .trim()
      .min(1, `${label} is required.`)
      .max(max, `${label} is too long.`),
  );

const optionalText = (label: string, max: number) =>
  z
    .preprocess(
      stringifyFormValue,
      z.string().trim().max(max, `${label} is too long.`),
    )
    .transform((value) => (value.length > 0 ? value : null))
    .optional()
    .transform((value) => value ?? null);

const metadataSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .optional()
  .default({});

const leadInputSchema = z.object({
  formType: z.enum(["apply", "contact"]),
  idempotencyKey: optionalText("Submission key", 160),
  fullName: requiredText("Name", 140),
  email: z
    .preprocess(stringifyFormValue, z.email())
    .transform((value) => value.toLowerCase()),
  phone: optionalText("Phone", 60),
  city: optionalText("City", 120),
  stateRegion: optionalText("State", 120),
  businessStage: optionalText("Business stage", 160),
  budget: optionalText("Budget", 120),
  timeline: optionalText("Timeline", 120),
  message: optionalText("Message", 3000),
  sourcePath: optionalText("Source path", 500),
  landingPath: optionalText("Landing path", 500),
  referrer: optionalText("Referrer", 1000),
  sourcePageId: optionalText("Source page ID", 80),
  sourcePageSlug: optionalText("Source page slug", 160),
  targetKeyword: optionalText("Target keyword", 180),
  sourceBlockId: optionalText("Source block ID", 120),
  sourceCtaTrackingName: optionalText("Source CTA tracking name", 160),
  userAgent: optionalText("User agent", 1000),
  utmSource: optionalText("UTM source", 160),
  utmMedium: optionalText("UTM medium", 160),
  utmCampaign: optionalText("UTM campaign", 200),
  utmTerm: optionalText("UTM term", 200),
  utmContent: optionalText("UTM content", 200),
  metadata: metadataSchema,
});

export type SubmitLeadInput = {
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
  sourcePath?: unknown;
  landingPath?: unknown;
  referrer?: unknown;
  sourcePageId?: unknown;
  sourcePageSlug?: unknown;
  targetKeyword?: unknown;
  sourceBlockId?: unknown;
  sourceCtaTrackingName?: unknown;
  userAgent?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmTerm?: unknown;
  utmContent?: unknown;
  metadata?: Record<string, string | number | boolean | null>;
};
type ValidLeadInput = z.output<typeof leadInputSchema>;

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

  const existing = await findExistingLead(client, idempotencyKey);
  if (existing) {
    return {
      status: "accepted",
      leadId: existing.id,
      duplicate: true,
      notificationStatus: existing.status,
      notificationError: existing.notification_error,
    };
  }

  const inserted = await insertLead(client, lead, idempotencyKey, env);
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

  return {
    status: "accepted",
    leadId: inserted.id,
    duplicate: false,
    notificationStatus: patch.status ?? "received",
    notificationError: patch.notification_error ?? null,
  };
}

function stringifyFormValue(value: unknown) {
  if (value == null) return "";
  return String(value);
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
  };
}

async function findExistingLead(
  client: LeadClient,
  idempotencyKey: string,
): Promise<Pick<
  LeadRow,
  "id" | "status" | "notification_error" | "notification_sent_at"
> | null> {
  const { data, error } = await client
    .from("lead_submissions")
    .select("id,status,notification_error,notification_sent_at")
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
    .select("id,status,notification_error,notification_sent_at")
    .single();

  if (error) throw new Error("Could not store lead submission.");
  return data;
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

async function sendLeadNotifications(
  lead: ValidLeadInput,
  {
    env,
    fetchImpl,
  }: {
    env: LeadNotificationEnv;
    fetchImpl: typeof fetch;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const recipients = parseRecipients(env.LEAD_NOTIFICATION_TO);
  if (
    !env.RESEND_API_KEY ||
    !env.LEAD_NOTIFICATION_FROM ||
    !recipients.length
  ) {
    return {
      ok: false,
      error: "Lead email notification is not configured.",
    };
  }

  const email = await sendResendEmail(lead, {
    apiKey: env.RESEND_API_KEY,
    from: env.LEAD_NOTIFICATION_FROM,
    to: recipients,
    subjectPrefix: env.LEAD_NOTIFICATION_SUBJECT_PREFIX,
    fetchImpl,
  });
  if (!email.ok) return email;

  if (env.SLACK_WEBHOOK_URL) {
    const slack = await sendSlackWebhook(
      lead,
      env.SLACK_WEBHOOK_URL,
      fetchImpl,
    );
    if (!slack.ok) return slack;
  }

  return { ok: true };
}

async function sendResendEmail(
  lead: ValidLeadInput,
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
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `${subjectPrefix ?? "Vendingpreneurs"} ${lead.formType === "apply" ? "application" : "contact"} lead`,
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
}

async function sendSlackWebhook(
  lead: ValidLeadInput,
  webhookUrl: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
}

function parseRecipients(value?: string) {
  return (
    value?.split(",").flatMap((recipient) => {
      const trimmed = recipient.trim();
      return trimmed ? [trimmed] : [];
    }) ?? []
  );
}

function formatLeadText(lead: ValidLeadInput) {
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

function formatSlackText(lead: ValidLeadInput) {
  const label =
    lead.formType === "apply" ? "New application lead" : "New contact lead";
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

function fieldLine(label: string, value: string | null) {
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
