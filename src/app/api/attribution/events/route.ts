import { z } from "zod";
import { ATTRIBUTION_EVENT_TYPES } from "@/lib/attribution-client";
import { VP_SESSION_COOKIE_NAME } from "@/lib/attribution-session";
import { config } from "@/lib/config";
import { checkPublicRateLimit, requestIp } from "@/lib/public-rate-limit";
import { channelFromAttributionSignals } from "@/lib/paid-attribution";
import { recordTaggedPageView } from "@/lib/services/lead-page-views";
import { recordVideoView } from "@/lib/services/lead-video-views";
import { recordBookingSession } from "@/lib/services/calendly-booking-sessions";
import { recordPopupEvent } from "@/lib/services/popups";

const attributionEventSchema = z.object({
  event_type: z.enum(ATTRIBUTION_EVENT_TYPES),
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
  if (!isFirstPartyAttributionRequest(request, payload)) {
    return unauthorizedEventResponse();
  }

  // The first-party check above is CSRF-grade, not auth-grade: `vp_sid` is set
  // client-side, so a non-browser caller supplies both the cookie and the
  // matching body and gets a write proxy into the downstream ingest that
  // spends our secret. Until that endpoint authenticates callers itself, the
  // rate limit is what bounds the damage.
  const allowed = await checkPublicRateLimit("attribution_event", {
    ip: requestIp(request.headers),
  });
  if (!allowed) return tooManyEventsResponse();

  // The money-page forward has no queryable readback, so popup events are
  // also counted locally for the /admin/popups stat tiles. Best-effort:
  // recordPopupEvent never throws and never blocks the forward.
  const popupId = stringProperty(payload.properties, "popup_id");
  if (payload.event_type.startsWith("popup_") && popupId) {
    await recordPopupEvent({
      eventType: payload.event_type,
      popupId,
      pagePath: stringProperty(payload.properties, "page_path") || null,
    });
  }

  // The landing view is also kept locally, because the money-page forward has
  // no queryable readback and the per-video funnel needs a visits stage between
  // "clicked the link" and "filled the form". Tagged views only; see the
  // service. Best-effort, exactly like the popup counter above.
  if (payload.event_type === "landing_viewed") {
    await recordTaggedPageView({
      path:
        stringProperty(payload.properties, "landing_path") ||
        stringProperty(payload.properties, "latest_landing_path"),
      vpSessionId: payload.vp_session_id,
      utmSource: stringProperty(payload.properties, "utm_source"),
      utmCampaign: stringProperty(payload.properties, "utm_campaign"),
      utmContent: stringProperty(payload.properties, "utm_content"),
    });
  }

  // Pre-call video engagement. Kept locally for the same reason as the two
  // above — the forward has no readback — and this one is read by a person:
  // /admin/bookings shows a rep what an upcoming call has watched, and the
  // ones who watched nothing are the outreach list.
  if (payload.event_type === "video_progress") {
    await recordVideoView({
      vpSessionId: payload.vp_session_id,
      embedId: stringProperty(payload.properties, "embed_id"),
      percent: Number(stringProperty(payload.properties, "percent")),
      pagePath: stringProperty(payload.properties, "page_path") || null,
      durationSeconds: Number(
        stringProperty(payload.properties, "duration_seconds"),
      ),
    });
  }

  // Which browser made a booking, so the pre-call videos it goes on to watch
  // can be named even when the booker never filled a site form. Local only:
  // the money page has no use for a Calendly invitee id, so it is not
  // forwarded. The session comes from the cookie-checked payload above, never
  // from a property.
  if (payload.event_type === "booking_linked") {
    await recordBookingSession({
      vpSessionId: payload.vp_session_id,
      inviteeUri: stringProperty(payload.properties, "invitee_uri"),
    });
    return attributionResponse(false);
  }

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

function tooManyEventsResponse() {
  return Response.json(
    { ok: false, message: "Too many events." },
    { status: 429 },
  );
}

function unauthorizedEventResponse() {
  return Response.json(
    { ok: false, message: "Unauthorized event." },
    { status: 401 },
  );
}

function isFirstPartyAttributionRequest(
  request: Request,
  payload: AttributionEventPayload,
) {
  return (
    hasMatchingSessionCookie(request, payload.vp_session_id) &&
    isSameSiteBrowserPost(request)
  );
}

function hasMatchingSessionCookie(request: Request, sessionId: string) {
  const cookie = cookieValue(
    request.headers.get("cookie"),
    VP_SESSION_COOKIE_NAME,
  );
  return cookie === sessionId;
}

function isSameSiteBrowserPost(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }

  const origin = request.headers.get("origin");
  if (origin) return originMatchesRequest(origin, request);

  const referer = request.headers.get("referer");
  if (referer) return originMatchesRequest(referer, request);

  return fetchSite === "same-origin" || fetchSite === "same-site";
}

function originMatchesRequest(value: string, request: Request) {
  try {
    return new URL(value).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function cookieValue(header: string | null, name: string) {
  if (!header) return null;
  for (const cookie of header.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName !== name) continue;
    try {
      return decodeURIComponent(rawValue.join("="));
    } catch {
      return rawValue.join("=");
    }
  }
  return null;
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
