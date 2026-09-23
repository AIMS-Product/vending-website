import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attributionFor,
  readBookedMetric,
  REPORTING_TIME_ZONE,
  type AttributionSource,
  type BookedMetricResult,
  type BookingRow,
  type FunnelRow,
  type MetricKey,
} from "@/lib/services/booked-metrics";
import {
  mappingReviewState,
  type MappingReviewState,
} from "@/lib/services/calendly-event-class";
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

export type BookedPace = {
  /** The day every metric here counts, YYYY-MM-DD in the business timezone. */
  day: string;
  timeZone: string;
  /** New calls booked (D) — the pace number, Lane 2 removed. */
  newBooked: BookedMetricResult;
  /** The neighbouring numbers, so a figure quoted elsewhere can be named. */
  context: BookedMetricResult[];
  /** Where the day's new calls came from. Close funnel first, then UTM. */
  attribution: Array<{ label: string; via: AttributionSource; booked: number }>;
  /** Trailing days, most recent last, for pace against the daily goal. */
  trailing: Array<{ day: string; value: number | null }>;
  /**
   * Days ahead, on the lands-on basis: what is already on the calendar. Both
   * numbers are shown because they answer different questions — `firstCalls` is
   * the plan's basis, `allMeetings` is what the day actually looks like.
   */
  forward: Array<{
    day: string;
    firstCalls: number | null;
    allMeetings: number | null;
  }>;
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
    forwardDays?: number;
  } = {},
): Promise<BookedPace> {
  const client = input.client ?? createAdminClient();
  const timeZone = REPORTING_TIME_ZONE;
  const day = businessDay(input.now ?? new Date(), timeZone);
  const trailingDays = input.trailingDays ?? 14;

  const [bookings, funnels] = await Promise.all([
    fetchBookings(client, previousDay(day, LOOKBACK_DAYS)),
    fetchFunnels(client),
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

  const forward = Array.from({ length: input.forwardDays ?? 8 }, (_, index) => {
    const at = previousDay(day, -index);
    if (!connected) {
      return { day: at, firstCalls: null, allMeetings: null };
    }
    const ahead = { ...metricInput, day: at };
    return {
      day: at,
      firstCalls: readBookedMetric("firstCallsOnCalendar", ahead).value,
      allMeetings: readBookedMetric("allMeetingsOnCalendar", ahead).value,
    };
  });

  return {
    day,
    timeZone,
    forward,
    newBooked: readBookedMetric("newBookedOn", metricInput),
    context: CONTEXT_METRICS.map((key) => readBookedMetric(key, metricInput)),
    attribution: attributionFor(metricInput, {
      onlyClass: "new",
      excludeLaneTwo: true,
    }),
    trailing,
    review: mappingReviewState(),
    connected,
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
    bookedAt: string | null;
    eventTypeUri: string | null;
  }>(
    (from, to, count) =>
      client
        .from("calendly_bookings")
        .select(
          "invitee_email,status,scheduled_event_name,event_start_at,utm_source," +
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
