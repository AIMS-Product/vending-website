import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "@/lib/config";
import { isDuplicateDedupeError } from "@/lib/close/dedupe";
import type { Database, Json } from "@/types/database";

/**
 * Forwarding a website lead into a PARTNER's GoHighLevel sub-account.
 *
 * WeScale runs paid traffic for Vendingpreneurs and works the leads in their
 * own GHL. This is the only place their outbound contract is defined: what we
 * send, and nothing else. `buildGhlForwardPayload` is deliberately the single
 * function that decides that, so "are we over-sharing?" is answered by reading
 * one function rather than auditing a serializer.
 *
 * The payload is frozen into the queue event at submit time rather than read
 * back off `lead_submissions` at drain time. A column added to that table
 * later — an internal score, a rep note, a call outcome — can therefore never
 * start leaking to a third party without someone editing this file.
 */

const BASE_URL = "https://services.leadconnectorhq.com";
/**
 * The upsert endpoint's only accepted `Version`, and the scope its bearer
 * needs, both per the official OpenAPI spec
 * (GoHighLevel/highlevel-api-docs, apps/contacts.json, checked 2026-09-22).
 * A customFields entry there is `{ id, key, field_value }` with `id` required,
 * which is why option B needs field IDs and not just keys.
 */
const API_VERSION = "2021-07-28";
const USER_AGENT =
  "vendingpreneurs-website/1.0 (+https://www.vendingpreneurs.com)";
const ERROR_BODY_LIMIT = 200;

export const GHL_FORWARD_EVENT_TYPE = "ghl_forward";

type CloseSyncEventInsert =
  Database["public"]["Tables"]["close_sync_events"]["Insert"];

/**
 * What kind of capture this was, and the `form_type` the partner receives.
 *
 * Every one of these is a real website capture, but they are not the same
 * ask: `booking` and `application` filled a form requesting a call, `chat`
 * typed a question and left an email, `lead_magnet` downloaded a PDF and
 * `newsletter` subscribed. Which ones actually forward is an admin setting;
 * the label always says which it was, so a partner's rep is never told a PDF
 * download asked to be called.
 */
export const LEAD_CAPTURE_TYPES = [
  "booking",
  "application",
  "chat",
  "lead_magnet",
  "newsletter",
] as const;

export type LeadCaptureType = (typeof LEAD_CAPTURE_TYPES)[number];

/** The allowlist entry for a capture that arrived with no utm_source. */
export const NO_TRAFFIC_SOURCE = "(none)";

export type GhlForwardInput = {
  formType: LeadCaptureType;
  fullName: string;
  email: string;
  submittedAt: string;
  phone?: string | null;
  sourcePage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  /** Application-form answers. Null on a booking submission. */
  city?: string | null;
  stateRegion?: string | null;
  businessStage?: string | null;
  budget?: string | null;
  timeline?: string | null;
  message?: string | null;
};

/**
 * Every key is always present, null when we have no value.
 *
 * GHL's inbound-webhook trigger builds its field mapping from one sample
 * request, so a key that only appears on application submissions would be
 * unmappable for whoever sampled a booking submission. A stable shape means
 * their ops team maps once.
 */
export const ghlForwardPayloadSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  submitted_at: z.string(),
  form_type: z.enum(LEAD_CAPTURE_TYPES),
  source_page: z.string().nullable(),
  utm_source: z.string().nullable(),
  utm_medium: z.string().nullable(),
  utm_campaign: z.string().nullable(),
  utm_term: z.string().nullable(),
  utm_content: z.string().nullable(),
  gclid: z.string().nullable(),
  fbclid: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  business_stage: z.string().nullable(),
  budget: z.string().nullable(),
  timeline: z.string().nullable(),
  message: z.string().nullable(),
});

export type GhlForwardPayload = z.infer<typeof ghlForwardPayloadSchema>;

export type GhlForwardEnv = {
  WESCALE_GHL_WEBHOOK_URL?: string;
  WESCALE_GHL_TOKEN?: string;
  WESCALE_GHL_LOCATION_ID?: string;
  WESCALE_GHL_FIELD_IDS?: string;
};

export type GhlForwardTarget =
  | { mode: "webhook"; url: string }
  | {
      mode: "api";
      token: string;
      locationId: string;
      /** Payload key -> GHL custom field id. Unmapped keys are not sent. */
      fieldIds: Record<string, string>;
    };

export class GhlForwardConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GhlForwardConfigError";
  }
}

export class GhlForwardError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GhlForwardError";
  }
}

/**
 * The parts of the admin settings row this module needs, structurally typed.
 *
 * Declared here rather than imported so `services/lead-forward-settings` can
 * import this file for the capture vocabulary without the two importing each
 * other.
 */
export type GhlForwardDestination = {
  enabled: boolean;
  webhookUrl?: string | null;
  captureTypes: readonly LeadCaptureType[];
  trafficSourceMode: "all" | "allowlist";
  trafficSources: readonly string[];
  fieldIds?: Record<string, string>;
};

/**
 * Whether there is anywhere to send, at all.
 *
 * Kept separate from `resolveGhlForwardTarget` so the submit path can answer
 * "is this switched on" without parsing field ids — a malformed field id map
 * must fail a drain, never a visitor's submit.
 */
export function ghlForwardConfigured(
  env: GhlForwardEnv,
  destination?: Pick<GhlForwardDestination, "webhookUrl">,
): boolean {
  if (destination?.webhookUrl) return true;
  if (env.WESCALE_GHL_WEBHOOK_URL) return true;
  return Boolean(env.WESCALE_GHL_TOKEN && env.WESCALE_GHL_LOCATION_ID);
}

/**
 * Webhook wins when both exist: it is the transport the partner can change
 * without us. The admin-entered URL wins over the env var, which stays as the
 * way to configure a destination before the settings table is applied.
 */
export function resolveGhlForwardTarget(
  env: GhlForwardEnv,
  destination?: Pick<GhlForwardDestination, "webhookUrl" | "fieldIds">,
): GhlForwardTarget {
  const webhookUrl = destination?.webhookUrl || env.WESCALE_GHL_WEBHOOK_URL;
  if (webhookUrl) {
    return { mode: "webhook", url: webhookUrl };
  }
  if (!env.WESCALE_GHL_TOKEN || !env.WESCALE_GHL_LOCATION_ID) {
    throw new GhlForwardConfigError(
      "GHL forwarding needs a webhook URL, or WESCALE_GHL_TOKEN with WESCALE_GHL_LOCATION_ID.",
    );
  }
  return {
    mode: "api",
    token: env.WESCALE_GHL_TOKEN,
    locationId: env.WESCALE_GHL_LOCATION_ID,
    // Admin-entered ids win; the env map stays usable before the settings
    // table is applied.
    fieldIds:
      destination?.fieldIds && Object.keys(destination.fieldIds).length > 0
        ? destination.fieldIds
        : parseFieldIds(env.WESCALE_GHL_FIELD_IDS),
  };
}

function parseFieldIds(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GhlForwardConfigError("WESCALE_GHL_FIELD_IDS is not valid JSON.");
  }
  const shape = z.record(z.string(), z.string()).safeParse(parsed);
  if (!shape.success) {
    throw new GhlForwardConfigError(
      "WESCALE_GHL_FIELD_IDS must be a JSON object of payload key to GHL field id.",
    );
  }
  return shape.data;
}

export function buildGhlForwardPayload(
  input: GhlForwardInput,
): GhlForwardPayload {
  const { firstName, lastName } = splitFullName(input.fullName);
  return {
    first_name: firstName,
    last_name: lastName,
    email: input.email,
    phone: blankToNull(input.phone),
    submitted_at: input.submittedAt,
    form_type: input.formType,
    source_page: blankToNull(input.sourcePage),
    utm_source: blankToNull(input.utmSource),
    utm_medium: blankToNull(input.utmMedium),
    utm_campaign: blankToNull(input.utmCampaign),
    utm_term: blankToNull(input.utmTerm),
    utm_content: blankToNull(input.utmContent),
    gclid: blankToNull(input.gclid),
    fbclid: blankToNull(input.fbclid),
    city: blankToNull(input.city),
    state: blankToNull(input.stateRegion),
    business_stage: blankToNull(input.businessStage),
    budget: blankToNull(input.budget),
    timeline: blankToNull(input.timeline),
    message: blankToNull(input.message),
  };
}

/**
 * "Mary Anne Van Der Berg" -> first "Mary", last "Anne Van Der Berg".
 *
 * Our forms collect one name field, so any split is a guess. First token as
 * the first name keeps the greeting right ("Hi Mary"), which is the only thing
 * the split is used for.
 */
function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  const [firstName, ...rest] = parts;
  return { firstName, lastName: rest.join(" ") };
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function ghlForwardDedupeKey(leadSubmissionId: string): string {
  return `${GHL_FORWARD_EVENT_TYPE}:${leadSubmissionId}`;
}

export function buildGhlForwardEvent({
  leadSubmissionId,
  sessionId,
  payload,
  nowIso,
}: {
  leadSubmissionId: string;
  sessionId?: string | null;
  payload: GhlForwardPayload;
  nowIso: string;
}): CloseSyncEventInsert {
  return {
    lead_submission_id: leadSubmissionId,
    session_id: sessionId ?? null,
    event_type: GHL_FORWARD_EVENT_TYPE,
    status: "pending",
    dedupe_key: ghlForwardDedupeKey(leadSubmissionId),
    next_retry_at: nowIso,
    close_contact_id: null,
    close_lead_id: null,
    payload: payload as unknown as Json,
  };
}

/**
 * Whether this capture goes to the partner at all.
 *
 * The decision is made once, at submit time, and frozen with the payload: a
 * capture the settings excluded is never queued, so turning a type on later
 * starts the flow from that moment rather than back-filling people who were
 * deliberately held back.
 */
export function shouldForwardCapture(
  settings: {
    enabled: boolean;
    captureTypes: readonly LeadCaptureType[];
    trafficSourceMode: "all" | "allowlist";
    trafficSources: readonly string[];
  },
  capture: { captureType: LeadCaptureType; utmSource?: string | null },
): boolean {
  if (!settings.enabled) return false;
  if (!settings.captureTypes.includes(capture.captureType)) return false;
  if (settings.trafficSourceMode === "all") return true;
  const source = capture.utmSource?.trim() || NO_TRAFFIC_SOURCE;
  return settings.trafficSources.includes(source);
}

export type QueueGhlForwardResult =
  "queued" | "exists" | "disabled" | "skipped" | "failed";

type ForwardQueueClient = Pick<SupabaseClient<Database>, "from">;

/**
 * Queue one forward, fail-soft.
 *
 * Fail-soft for two reasons, the same two that govern `queueWarmReplyActivity`:
 * the `ghl_forward` event_type needs a CHECK-constraint migration that is
 * hand-applied to prod, so before it lands the insert fails; and nothing about
 * a partner hand-off is worth losing a lead over. The lead is stored and
 * queued to Close before this runs.
 */
export async function queueGhlForward(
  client: ForwardQueueClient,
  input: {
    leadSubmissionId: string;
    sessionId?: string | null;
    captureType: LeadCaptureType;
    lead: Omit<GhlForwardInput, "formType">;
    nowIso: string;
    destination: GhlForwardDestination;
  },
  deps: { env?: GhlForwardEnv } = {},
): Promise<QueueGhlForwardResult> {
  const env = deps.env ?? config;
  if (!ghlForwardConfigured(env, input.destination)) return "disabled";
  if (
    !shouldForwardCapture(input.destination, {
      captureType: input.captureType,
      utmSource: input.lead.utmSource,
    })
  ) {
    return "skipped";
  }

  const event = buildGhlForwardEvent({
    leadSubmissionId: input.leadSubmissionId,
    sessionId: input.sessionId,
    payload: buildGhlForwardPayload({
      ...input.lead,
      formType: input.captureType,
    }),
    nowIso: input.nowIso,
  });

  try {
    const { error } = await client
      .from("close_sync_events")
      .insert(event)
      .select("id")
      .single();

    if (!error) return "queued";
    // A duplicate means this lead's forward is already queued — a re-submit,
    // not a failure.
    if (isDuplicateDedupeError(error)) return "exists";
    console.warn("ghl forward: could not queue", {
      leadSubmissionId: input.leadSubmissionId,
      code: error.code,
    });
    return "failed";
  } catch (error) {
    console.warn("ghl forward: could not queue", {
      leadSubmissionId: input.leadSubmissionId,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return "failed";
  }
}

/**
 * POST one lead to the partner. Throws on any non-2xx so the queue retries
 * with its existing backoff; there is no inner retry loop.
 */
export async function forwardLeadToGhl(
  payload: GhlForwardPayload,
  target: GhlForwardTarget,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const request: {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } =
    target.mode === "webhook"
      ? {
          url: target.url,
          headers: { "Content-Type": "application/json" },
          body: payload as unknown as Record<string, unknown>,
        }
      : {
          url: `${BASE_URL}/contacts/upsert`,
          headers: {
            Authorization: `Bearer ${target.token}`,
            Version: API_VERSION,
            Accept: "application/json",
            "Content-Type": "application/json",
            // GHL sits behind Cloudflare, which answers 1010/403 to a request
            // with no real User-Agent.
            "User-Agent": USER_AGENT,
          },
          body: upsertContactBody(payload, target),
        };

  const response = await fetchImpl(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GhlForwardError(
      `GHL forward failed with ${response.status}${
        body ? `: ${body.slice(0, ERROR_BODY_LIMIT)}` : ""
      }`,
      response.status,
    );
  }
}

function upsertContactBody(
  payload: GhlForwardPayload,
  target: Extract<GhlForwardTarget, { mode: "api" }>,
): Record<string, unknown> {
  // Standard GHL contact fields carry themselves; everything else needs a
  // custom field id from their location, so an unmapped key is simply not sent
  // rather than guessed at.
  const customKeys = Object.keys(payload).filter(
    (key) => !STANDARD_CONTACT_KEYS.has(key),
  );
  const customFields = customKeys.flatMap((key) => {
    const id = target.fieldIds[key];
    const value = payload[key as keyof GhlForwardPayload];
    if (!id || value == null) return [];
    return [{ id, key, field_value: String(value) }];
  });

  return {
    locationId: target.locationId,
    firstName: payload.first_name,
    lastName: payload.last_name,
    email: payload.email,
    ...(payload.phone ? { phone: payload.phone } : {}),
    ...(payload.city ? { city: payload.city } : {}),
    ...(payload.state ? { state: payload.state } : {}),
    source: payload.source_page ?? "vendingpreneurs.com",
    ...(customFields.length ? { customFields } : {}),
  };
}

const STANDARD_CONTACT_KEYS = new Set([
  "first_name",
  "last_name",
  "email",
  "phone",
  "city",
  "state",
]);
