import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const trackingSchema = z
  .object({
    utm_source: z.string().nullish(),
    utm_medium: z.string().nullish(),
    utm_campaign: z.string().nullish(),
    utm_term: z.string().nullish(),
    utm_content: z.string().nullish(),
    salesforce_uuid: z.string().nullish(),
  })
  .loose();

const scheduledEventSchema = z
  .object({
    uri: z.string().nullish(),
    name: z.string().nullish(),
    start_time: z.string().nullish(),
    end_time: z.string().nullish(),
  })
  .loose();

const cancellationSchema = z
  .object({
    reason: z.string().nullish(),
  })
  .loose();

const calendlyInviteePayloadSchema = z
  .object({
    uri: z.string().min(1),
    name: z.string().nullish(),
    email: z.string().nullish(),
    cancel_url: z.string().nullish(),
    reschedule_url: z.string().nullish(),
    cancellation: cancellationSchema.nullish(),
    tracking: trackingSchema.nullish(),
    scheduled_event: scheduledEventSchema.nullish(),
  })
  .loose();

const calendlyWebhookSchema = z
  .object({
    event: z.enum(["invitee.created", "invitee.canceled"]),
    payload: calendlyInviteePayloadSchema,
  })
  .loose();

export type CalendlyWebhookEvent = {
  eventKind: "invitee.created" | "invitee.canceled";
  inviteeUri: string;
  inviteeName: string | null;
  inviteeEmail: string | null;
  cancelReason: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  scheduledEventUri: string | null;
  scheduledEventName: string | null;
  eventStartAt: string | null;
  eventEndAt: string | null;
  rawPayload: unknown;
};

/**
 * Verifies a Calendly webhook signature.
 *
 * Calendly signs requests with a `Calendly-Webhook-Signature` header shaped
 * like `t=<unix seconds>,v1=<hex hmac>`. The signed string is
 * `${t}.${rawBody}`, HMAC-SHA256'd with the webhook signing key.
 */
export function verifyCalendlySignature(
  rawBody: string,
  signatureHeader: string | null,
  signingKey: string,
): boolean {
  if (!signatureHeader || !signingKey) return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const expectedHex = createHmac("sha256", signingKey)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedHex, "hex");
  const actualBuffer = Buffer.from(parsed.signature, "hex");
  if (
    expectedBuffer.length === 0 ||
    actualBuffer.length === 0 ||
    expectedBuffer.length !== actualBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function parseSignatureHeader(
  header: string,
): { timestamp: string; signature: string } | null {
  const parts = header
    .split(",")
    .reduce<Record<string, string>>((acc, part) => {
      const [key, value] = part.split("=");
      if (key && value) acc[key.trim()] = value.trim();
      return acc;
    }, {});

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return null;
  if (!/^[0-9a-f]+$/i.test(signature)) return null;

  return { timestamp, signature };
}

/**
 * Parses and normalizes a Calendly v2 webhook payload. Returns `null` when
 * the payload does not match the shape this integration understands.
 */
export function parseCalendlyEvent(
  payload: unknown,
): CalendlyWebhookEvent | null {
  const parsed = calendlyWebhookSchema.safeParse(payload);
  if (!parsed.success) return null;

  const { event, payload: invitee } = parsed.data;
  const tracking = invitee.tracking ?? null;
  const scheduledEvent = invitee.scheduled_event ?? null;

  return {
    eventKind: event,
    inviteeUri: invitee.uri,
    inviteeName: invitee.name ?? null,
    inviteeEmail: invitee.email ?? null,
    cancelReason: invitee.cancellation?.reason ?? null,
    utmSource: tracking?.utm_source ?? null,
    utmMedium: tracking?.utm_medium ?? null,
    utmCampaign: tracking?.utm_campaign ?? null,
    utmTerm: tracking?.utm_term ?? null,
    utmContent: tracking?.utm_content ?? null,
    scheduledEventUri: scheduledEvent?.uri ?? null,
    scheduledEventName: scheduledEvent?.name ?? null,
    eventStartAt: scheduledEvent?.start_time ?? null,
    eventEndAt: scheduledEvent?.end_time ?? null,
    rawPayload: payload,
  };
}
