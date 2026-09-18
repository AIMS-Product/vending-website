import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildBookedCalls,
  recentWeekStarts,
  type BookedCallsReport,
  type BookingRow,
  type FunnelRow,
} from "@/lib/services/booked-calls";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

const PAGE_SIZE = 1000;
/** Well past a quarter of bookings; stops a runaway page loop. */
const MAX_ROWS = 50_000;

/** Weeks shown on the tab. Six gives a month and a bit of comparison. */
export const WEEKS_SHOWN = 6;

export async function getBookedCalls(
  input: { client?: Client; now?: Date; includeInternal?: boolean } = {},
): Promise<BookedCallsReport> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const weekStarts = recentWeekStarts(
    now.toISOString().slice(0, 10),
    WEEKS_SHOWN,
  );
  const from = weekStarts[0];

  const [bookings, funnels] = await Promise.all([
    fetchBookings(client, from),
    fetchFunnels(client),
  ]);
  return buildBookedCalls({
    bookings,
    funnels,
    weekStarts,
    includeInternal: input.includeInternal,
  });
}

/**
 * Bookings are filtered on the mirror row's `created_at` but bucketed on
 * Calendly's own booked-at, so the window is widened by a year: a booking
 * imported today can belong to any earlier week, and one imported long ago
 * cannot belong to a later one.
 */
async function fetchBookings(
  client: Client,
  fromDay: string,
): Promise<BookingRow[]> {
  const rows: BookingRow[] = [];
  const since = new Date(`${fromDay}T00:00:00.000Z`);
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("calendly_bookings")
      .select(
        "invitee_email,invitee_name,status,scheduled_event_name,created_at,bookedAt:raw_payload->payload->>created_at",
      )
      .gte("created_at", since.toISOString())
      .order("created_at")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("calendly_bookings read failed", {
        code: error.code,
        message: error.message,
      });
      break;
    }
    const batch = (data ?? []) as Array<{
      invitee_email: string | null;
      invitee_name: string | null;
      status: string;
      scheduled_event_name: string | null;
      created_at: string;
      bookedAt: string | null;
    }>;
    for (const row of batch) {
      rows.push({
        inviteeEmail: row.invitee_email,
        inviteeName: row.invitee_name,
        status: row.status,
        eventName: row.scheduled_event_name,
        bookedAt: row.bookedAt,
        createdAt: row.created_at,
      });
    }
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Every mirrored Close lead, for the funnel name only. Empty if unreadable. */
async function fetchFunnels(client: Client): Promise<FunnelRow[]> {
  const rows: FunnelRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("close_lead_funnel")
      .select("email,funnel")
      .order("lead_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("close_lead_funnel read failed", {
        code: error.code,
        message: error.message,
      });
      break;
    }
    const batch = (data ?? []) as FunnelRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}
