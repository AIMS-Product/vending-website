import { config } from "@/lib/config";
import {
  calendarIcs,
  calendarLinks,
  masterclassCalendarEvent,
} from "@/lib/content/masterclass";
import { readContactField } from "@/lib/ghl/webinar-registration";
import {
  ZOOM_URL_FIELD_ID,
  zoomCredentials,
} from "@/lib/masterclass-join-link";
import { verifyCalendarToken } from "@/lib/masterclass-session";
import { checkPublicRateLimit } from "@/lib/public-rate-limit";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";
import { joinLinkFor, roomWebinarId } from "@/lib/zoom/webinar-registrant";

export const dynamic = "force-dynamic";

/** The zap can still be writing the link a few seconds after sign-up. */
export const JOIN_RETRY_MS = 3000;

const PRIVATE = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex",
  "Referrer-Policy": "no-referrer",
};

async function readJoinUrl(
  contactId: string,
  startsAt: string,
): Promise<string | null> {
  const creds = zoomCredentials();
  if (!config.GHL_WRITE_TOKEN || !creds) return null;
  // Over budget, or the limiter is down: the generic event, no GHL read.
  const allowed = await checkPublicRateLimit(
    "masterclass_cal",
    { ip: null, email: `contact:${contactId}` },
    { failClosed: true },
  );
  if (!allowed) return null;
  // Only this room's link: a returning contact's field can still hold last week's.
  const webinarId = await roomWebinarId(startsAt, creds);
  if (webinarId === null) return null;
  const read = async () =>
    joinLinkFor(
      await readContactField(contactId, ZOOM_URL_FIELD_ID, {
        token: config.GHL_WRITE_TOKEN ?? "",
      }),
      webinarId,
    );
  try {
    return (
      (await read()) ??
      (await new Promise((resolve) => setTimeout(resolve, JOIN_RETRY_MS)).then(
        read,
      ))
    );
  } catch (error) {
    // Degrades to today's generic event; the person still gets a calendar entry.
    console.error("[masterclass] cal: join link read failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}

/**
 * GET /masterclass/cal/<token>?to=google|outlook|ics: the registrant's own
 * calendar event with their Zoom join link as the location. The token (signed,
 * no PII) names the GHL contact; the link is read server-side and only ever
 * sent to Google / Outlook or in the .ics body, never into one of our URLs.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const verified = verifyCalendarToken(
    (await params).token,
    config.MASTERCLASS_CAL_SECRET,
  );
  const event = await getMasterclassEvent();
  // Tampered, expired, or minted for an earlier room than the one GHL now holds.
  if (
    !verified ||
    !event.startsAt ||
    Date.parse(event.startsAt) >= verified.expiresAt
  ) {
    return new Response(null, {
      status: 302,
      headers: {
        ...PRIVATE,
        Location: new URL("/masterclass", request.url).toString(),
      },
    });
  }

  const joinUrl = await readJoinUrl(verified.contactId, event.startsAt);
  const calendarEvent = masterclassCalendarEvent(new Date(event.startsAt), {
    joinUrl,
    uidKey: `${verified.contactId}-${verified.expiresAt}`,
  });
  const to = new URL(request.url).searchParams.get("to");
  if (to === "google" || to === "outlook") {
    return new Response(null, {
      status: 302,
      headers: { ...PRIVATE, Location: calendarLinks(calendarEvent)[to] },
    });
  }
  return new Response(calendarIcs(calendarEvent, new Date()), {
    headers: {
      ...PRIVATE,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition":
        'inline; filename="vendingpreneurs-masterclass.ics"',
    },
  });
}
