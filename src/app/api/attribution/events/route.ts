import { z } from "zod";
import { config } from "@/lib/config";
import { channelFromAttributionSignals } from "@/lib/paid-attribution";

const attributionEventSchema = z.object({
  event_type: z.enum(["landing_viewed", "cta_clicked", "form_started"]),
  external_id: z.string().trim().min(1).max(300),
  occurred_at: z.string().trim().min(1).max(80),
  vp_session_id: z.string().trim().min(1).max(160),
  properties: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .default({}),
});
type AttributionEventPayload = z.output<typeof attributionEventSchema>;

export async function POST(request: Request) {
  const payload = await parseAttributionEvent(request);
  if (!payload) return invalidEventResponse();

  const destination = moneyPageDestination();
  if (!destination) return attributionResponse(false);

  return attributionResponse(
    await forwardAttributionEvent(payload, destination),
  );
}

async function parseAttributionEvent(request: Request) {
  try {
    return attributionEventSchema.parse(await request.json());
  } catch {
    return null;
  }
}

function invalidEventResponse() {
  return Response.json(
    { ok: false, message: "Invalid event." },
    { status: 400 },
  );
}

function moneyPageDestination() {
  const ingestUrl = config.MONEY_PAGE_INGEST_URL;
  const secret = config.MONEY_PAGE_SECRET;
  return ingestUrl && secret ? { ingestUrl, secret } : null;
}

function attributionResponse(delivered: boolean) {
  return Response.json(
    { ok: true, delivered },
    { status: delivered ? 200 : 202 },
  );
}

async function forwardAttributionEvent(
  payload: AttributionEventPayload,
  { ingestUrl, secret }: { ingestUrl: string; secret: string },
) {
  try {
    const response = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": secret,
      },
      body: JSON.stringify({
        event_type: payload.event_type,
        external_id: payload.external_id,
        occurred_at: payload.occurred_at,
        channel: eventChannel(payload.properties),
        properties: {
          vp_session_id: payload.vp_session_id,
          ...payload.properties,
        },
      }),
    });

    if (!response.ok) {
      console.warn("money page attribution event failed", {
        eventType: payload.event_type,
        status: response.status,
      });
      return false;
    }
  } catch (error) {
    console.warn("money page attribution event failed", {
      eventType: payload.event_type,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return false;
  }

  return true;
}

function eventChannel(properties: AttributionEventPayload["properties"]) {
  return channelFromAttributionSignals({
    paidPlatform: stringProperty(properties, "paid_platform"),
    utmSource: stringProperty(properties, "utm_source"),
    utmMedium: stringProperty(properties, "utm_medium"),
    gclid: stringProperty(properties, "gclid"),
    fbclid: stringProperty(properties, "fbclid"),
    gbraid: stringProperty(properties, "gbraid"),
    wbraid: stringProperty(properties, "wbraid"),
    adGroupId: stringProperty(properties, "ad_group_id"),
    adsetId: stringProperty(properties, "adset_id"),
    latestReferrer: stringProperty(properties, "latest_referrer"),
  });
}

function stringProperty(
  properties: Record<string, string | number | boolean>,
  key: string,
) {
  const value = properties[key];
  return typeof value === "string" ? value : "";
}
