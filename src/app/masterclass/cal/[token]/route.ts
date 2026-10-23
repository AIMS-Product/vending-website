import {
  calendarIcs,
  calendarLinks,
  masterclassCalendarEvent,
} from "@/lib/content/masterclass";
import { JOIN_RETRY_MS, readJoinUrl } from "@/lib/masterclass-join-link";
import {
  currentRoomToken,
  PRIVATE_HEADERS,
  privateRedirect,
} from "@/lib/masterclass-room-token";

export const dynamic = "force-dynamic";

export { JOIN_RETRY_MS };

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
  const room = await currentRoomToken((await params).token);
  if (!room) {
    return privateRedirect(new URL("/masterclass", request.url).toString());
  }

  const joinUrl = await readJoinUrl(
    room.contactId,
    room.startsAt,
    "masterclass_cal",
  );
  const calendarEvent = masterclassCalendarEvent(new Date(room.startsAt), {
    joinUrl,
    uidKey: `${room.contactId}-${room.expiresAt}`,
  });
  const to = new URL(request.url).searchParams.get("to");
  if (to === "google" || to === "outlook") {
    return privateRedirect(calendarLinks(calendarEvent)[to]);
  }
  return new Response(calendarIcs(calendarEvent, new Date()), {
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition":
        'inline; filename="vendingpreneurs-masterclass.ics"',
    },
  });
}
