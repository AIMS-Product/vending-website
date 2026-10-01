import {
  calendarIcs,
  masterclassCalendarEvent,
} from "@/lib/content/masterclass";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";

// DTSTAMP is the time of the request, so this is never prerendered. The GHL
// date itself is cached for five minutes inside getMasterclassEvent.
export const dynamic = "force-dynamic";

/**
 * The Apple / iCal button's target. Served as text/calendar so iOS offers
 * "Add to Calendar" instead of saving a data: URI to Files.
 */
export async function GET() {
  const event = await getMasterclassEvent();
  if (!event.startsAt) {
    return new Response("The next masterclass date is not set yet.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const ics = calendarIcs(
    masterclassCalendarEvent(new Date(event.startsAt)),
    new Date(),
  );
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition":
        'inline; filename="vendingpreneurs-masterclass.ics"',
      "Cache-Control": "no-store",
    },
  });
}
