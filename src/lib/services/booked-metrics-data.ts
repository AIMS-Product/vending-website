import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  callsByChannel,
  readBookedMetric,
  REPORTING_TIME_ZONE,
  type BookedMetricResult,
  type BookingRow,
  type ChannelGrid,
  type FunnelRow,
  type MetricKey,
} from "@/lib/services/booked-metrics";
import {
  mappingReviewState,
  type MappingReviewState,
} from "@/lib/services/calendly-event-class";
import { resolveChannel } from "@/lib/analytics/channel";
import { isChatbotCapture } from "@/lib/services/admin-analytics-internal";
import { CALENDLY_BOOKED_AT_PATH } from "@/lib/services/calendly-bookings";
import { readAllPages } from "@/lib/services/paged-read";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

const PAGE_SIZE = 1000;
/** Stops a runaway page loop. Well past a year of bookings. */
const MAX_ROWS = 60_000;

/**
 * How far back to read bookings. A booked-on metric only needs the days it
 * reports, but the window is generous because the day filter runs in the
 * business timezone after the read, and the goal panel shows a trailing pace.
 */
const LOOKBACK_DAYS = 45;

/** The capacity grid shows this many days either side of today. */
const CAPACITY_DAYS_EACH_WAY = 7;
/** The booked-on grid shows this many days, ending today. */
const BOOKED_GRID_DAYS = 14;

export type BookedPace = {
  /** The day every metric here counts, YYYY-MM-DD in the business timezone. */
  day: string;
  timeZone: string;
  /** New calls booked (D) — the pace number, Lane 2 removed. */
  newBooked: BookedMetricResult;
  /** The neighbouring numbers, so a figure quoted elsewhere can be named. */
  context: BookedMetricResult[];
  /** Trailing days, most recent last, for pace against the daily goal. */
  trailing: Array<{ day: string; value: number | null }>;
  /** New calls booked per channel, the last 14 days. Null when unreadable. */
  booked: ChannelGrid | null;
  /** New calls on the calendar per channel, a week either side. Null when unreadable. */
  capacity: ChannelGrid | null;
  /** False when website forms could not be read, so tag credit is short. */
  siteFormsRead: boolean;
  /** How much of the event-type mapping a human has signed off. */
  review: MappingReviewState;
  /** False when the tables could not be read at all. Never reported as zero. */
  connected: boolean;
};

const CONTEXT_METRICS: MetricKey[] = [
  "allBookedOn",
  "followUpBookedOn",
  "rescheduleBookedOn",
  "firstCallsOnCalendar",
  "allMeetingsOnCalendar",
  "bookedTodayLandingToday",
  "capacityTotalMeetingsBooked",
];

/** The business-timezone day for an instant. */
function businessDay(at: Date, timeZone: string): string {
  return at.toLocaleDateString("en-CA", { timeZone });
}

function previousDay(day: string, back: number): string {
  const at = new Date(`${day}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() - back);
  return at.toISOString().slice(0, 10);
}

export async function getBookedPace(
  input: {
    client?: Client;
    now?: Date;
    trailingDays?: number;
  } = {},
): Promise<BookedPace> {
  const client = input.client ?? createAdminClient();
  const timeZone = REPORTING_TIME_ZONE;
  const day = businessDay(input.now ?? new Date(), timeZone);
  const trailingDays = input.trailingDays ?? 14;

  const [bookings, funnels, siteChannels] = await Promise.all([
    fetchBookings(client, previousDay(day, LOOKBACK_DAYS)),
    fetchFunnels(client),
    fetchSiteChannels(client),
  ]);

  const connected = bookings !== null && funnels !== null;
  const metricInput = {
    bookings: bookings ?? [],
    funnels: funnels ?? [],
    day,
    timeZone,
  };

  const trailing = Array.from({ length: trailingDays }, (_, index) => {
    const at = previousDay(day, trailingDays - 1 - index);
    return {
      day: at,
      // Unreadable tables give null, never zero — a broken read must not look
      // like a day nobody booked anything.
      value: connected
        ? readBookedMetric("newBookedOn", { ...metricInput, day: at }).value
        : null,
    };
  });

  const capacityDays = Array.from(
    { length: CAPACITY_DAYS_EACH_WAY * 2 + 1 },
    (_, index) => previousDay(day, CAPACITY_DAYS_EACH_WAY - index),
  );
  const bookedDays = Array.from({ length: BOOKED_GRID_DAYS }, (_, index) =>
    previousDay(day, BOOKED_GRID_DAYS - 1 - index),
  );
  const gridInput = { ...metricInput, siteChannels: siteChannels ?? undefined };
  const booked = connected
    ? callsByChannel(gridInput, bookedDays, "booked-on")
    : null;
  const capacity = connected
    ? callsByChannel(gridInput, capacityDays, "lands-on")
    : null;

  return {
    day,
    timeZone,
    booked,
    capacity,
    siteFormsRead: siteChannels !== null,
    newBooked: unlessDisconnected(
      readBookedMetric("newBookedOn", metricInput),
      connected,
    ),
    context: CONTEXT_METRICS.map((key) =>
      unlessDisconnected(readBookedMetric(key, metricInput), connected),
    ),
    trailing,
    review: mappingReviewState(),
    connected,
  };
}

/**
 * A metric read from tables that could not be loaded is a dash, never zero:
 * a broken read must not look like a day nobody booked anything. Same rule
 * the trailing series and grids already follow.
 */
function unlessDisconnected(
  result: BookedMetricResult,
  connected: boolean,
): BookedMetricResult {
  if (connected) return result;
  return {
    ...result,
    value: null,
    unavailableReason: "Bookings data could not be read just now.",
  };
}

/**
 * Bookings, with Calendly's own booked-at and the stable event-type URI pulled
 * out of the webhook payload. The mirror's `created_at` is read only to bound
 * the query — it is our insert time and must never date a booking.
 */
async function fetchBookings(
  client: Client,
  fromDay: string,
): Promise<BookingRow[] | null> {
  // A row inserted today can belong to an earlier booked-on day (a backfill),
  // so the insert-time window is widened well past the reporting window.
  const since = new Date(`${fromDay}T00:00:00.000Z`);
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  // The generated Supabase types cannot infer a two-level JSON path alias
  // (`raw_payload->payload->scheduled_event->>event_type`), so the shape is
  // asserted. Both aliased fields are `->>`, so both arrive as text or null.
  const { rows, error } = await readAllPages<{
    invitee_email: string | null;
    status: string;
    scheduled_event_name: string | null;
    event_start_at: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    bookedAt: string | null;
    eventTypeUri: string | null;
  }>(
    (from, to, count) =>
      client
        .from("calendly_bookings")
        .select(
          "invitee_email,status,scheduled_event_name,event_start_at,utm_source,utm_medium," +
            `bookedAt:${CALENDLY_BOOKED_AT_PATH},` +
            "eventTypeUri:raw_payload->payload->scheduled_event->>event_type",
          { count },
        )
        .gte("created_at", since.toISOString())
        // Pages run concurrently, and created_at alone ties across a page
        // boundary (bulk inserts share a timestamp): without id a row could
        // land on two pages or on none.
        .order("created_at")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{
        data: Array<{
          invitee_email: string | null;
          status: string;
          scheduled_event_name: string | null;
          event_start_at: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          bookedAt: string | null;
          eventTypeUri: string | null;
        }> | null;
        count: number | null;
        error: { message: string; code?: string } | null;
      }>,
    { pageSize: PAGE_SIZE, maxRows: MAX_ROWS },
  );
  if (error) {
    console.error("calendly_bookings read failed", {
      code: error.code,
      message: error.message,
    });
    if (rows.length === 0) return null;
  }
  return rows.map((row) => ({
    inviteeEmail: row.invitee_email,
    status: row.status,
    eventName: row.scheduled_event_name,
    eventTypeUri: row.eventTypeUri,
    bookedAt: row.bookedAt,
    eventStartAt: row.event_start_at,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
  }));
}

/** Mirrored Close leads, for the funnel name and the scheduled first-call date. */
async function fetchFunnels(client: Client): Promise<FunnelRow[] | null> {
  const { rows, error } = await readAllPages<{
    email: string | null;
    funnel: string | null;
    first_sales_call_booked_date: string | null;
  }>(
    (from, to, count) =>
      client
        .from("close_lead_funnel")
        .select("email,funnel,first_sales_call_booked_date", { count })
        // PostgREST silently caps an unordered page, so the key is explicit.
        .order("lead_id")
        .range(from, to),
    { pageSize: PAGE_SIZE, maxRows: MAX_ROWS },
  );
  if (error) {
    console.error("close_lead_funnel read failed", {
      code: error.code,
      message: error.message,
    });
    if (rows.length === 0) return null;
  }
  return rows.map((row) => ({
    email: row.email,
    funnel: row.funnel,
    firstSalesCallBookedDate: row.first_sales_call_booked_date,
  }));
}

/**
 * Email to the website channel of that person's FIRST form, resolved exactly as
 * the Analytics page resolves a lead. Only consulted for bookings Close has no
 * funnel for. Null when the table could not be read.
 */
async function fetchSiteChannels(
  client: Client,
): Promise<Map<string, string> | null> {
  const { rows, error } = await readAllPages<{
    email: string;
    utm_source: string | null;
    utm_medium: string | null;
    metadata: unknown;
  }>(
    (from, to, count) =>
      client
        .from("lead_submissions")
        .select("email,utm_source,utm_medium,metadata", { count })
        .order("created_at")
        .order("id")
        .range(from, to),
    { pageSize: PAGE_SIZE, maxRows: MAX_ROWS },
  );
  if (error) {
    console.error("lead_submissions read failed", {
      code: error.code,
      message: error.message,
    });
    if (rows.length === 0) return null;
  }
  const channels = new Map<string, string>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || channels.has(email)) continue;
    channels.set(
      email,
      resolveChannel(row.utm_source, {
        medium: row.utm_medium,
        capturedByChatbot:
          !row.utm_source?.trim() && isChatbotCapture(row.metadata),
      }).channel,
    );
  }
  return channels;
}
