import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCalendlyDirectory,
  resolveCallCredit,
  summarizeCallCredits,
  type CallCreditRow,
  type CallCreditSummary,
} from "@/lib/services/call-credit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type CallCreditClient = Pick<SupabaseClient<Database>, "from">;

/**
 * Everything the credit rule needs, and nothing else.
 *
 * `invitee_scheduled_by`, the invitee's own booked-at and the hosts are read
 * straight out of the stored webhook payload with PostgREST JSON selectors.
 * Calendly has always sent them; we simply never read them. Selecting the
 * paths rather than whole `raw_payload` rows keeps a 90-day page off ~10MB of
 * JSON.
 */
const CALL_CREDIT_FIELDS = [
  "id",
  "invitee_name",
  "invitee_email",
  "scheduled_event_name",
  "event_start_at",
  "canceled_at",
  "utm_source",
  "utm_medium",
  "utm_content",
  "booked_at:raw_payload->payload->>created_at",
  "scheduled_by:raw_payload->payload->>invitee_scheduled_by",
  "hosts:raw_payload->payload->scheduled_event->event_memberships",
].join(",");

type RawRow = {
  id: string;
  invitee_name: string | null;
  invitee_email: string | null;
  scheduled_event_name: string | null;
  event_start_at: string | null;
  canceled_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  booked_at: string | null;
  scheduled_by: string | null;
  hosts: unknown;
};

export type CallCreditReport = {
  rows: CallCreditRow[];
  summary: CallCreditSummary;
  /** False when the bookings table is not wired up in this environment. */
  connected: boolean;
  since: string;
};

/**
 * One page of the booking ledger.
 *
 * Windowed on when the call was BOOKED, not when it happens: this answers "who
 * set calls last week", and a call set last week for next month belongs in
 * last week's count. Calendly's `created_at` is that moment; the row's own
 * `created_at` is when our sweep imported it, which for backfilled bookings is
 * a different day entirely.
 *
 * ponytail: the booked-at filter runs in JS over the window's rows because it
 * lives inside the JSON payload, so the query itself is bounded by the call
 * date with a month of slack on either side. Promote it to a real column if
 * this ever needs to page.
 */
export async function buildCallCreditReport(
  options: { days?: number; limit?: number } = {},
  deps: { client?: CallCreditClient } = {},
): Promise<CallCreditReport> {
  const days = options.days ?? 30;
  const limit = options.limit ?? 2000;
  const now = Date.now();
  const bookedSince = new Date(now - days * 86_400_000);
  // A call booked inside the window can sit anywhere from "yesterday" to
  // months out, and a call set long ago can happen inside it. Widen the SQL
  // window on the call date, then cut precisely on booked-at below.
  const callWindowStart = new Date(
    bookedSince.getTime() - 30 * 86_400_000,
  ).toISOString();
  const callWindowEnd = new Date(now + 180 * 86_400_000).toISOString();

  const client = deps.client ?? createAdminClient();

  let data: RawRow[] = [];
  try {
    const result = await client
      .from("calendly_bookings")
      .select(CALL_CREDIT_FIELDS)
      .eq("event_kind", "invitee.created")
      .gte("event_start_at", callWindowStart)
      .lte("event_start_at", callWindowEnd)
      .order("event_start_at", { ascending: false })
      .limit(limit);

    if (result.error) {
      return emptyReport(bookedSince.toISOString(), false);
    }
    data = (result.data ?? []) as unknown as RawRow[];
  } catch {
    return emptyReport(bookedSince.toISOString(), false);
  }

  const directory = buildCalendlyDirectory(data);

  const rows: CallCreditRow[] = data
    .filter((row) => {
      const bookedAt = row.booked_at ? Date.parse(row.booked_at) : NaN;
      // No booked-at (older payload shapes) falls back to the call date, which
      // is never later than the booking and so never overstates a window.
      const stamp = Number.isFinite(bookedAt)
        ? bookedAt
        : row.event_start_at
          ? Date.parse(row.event_start_at)
          : NaN;
      return Number.isFinite(stamp) && stamp >= bookedSince.getTime();
    })
    .map((row) => ({
      id: row.id,
      inviteeName: row.invitee_name,
      inviteeEmail: row.invitee_email,
      calendar: row.scheduled_event_name,
      startAt: row.event_start_at,
      bookedAt: row.booked_at,
      canceled: Boolean(row.canceled_at),
      credit: resolveCallCredit(
        {
          scheduledByUri: row.scheduled_by,
          utmSource: row.utm_source,
          utmMedium: row.utm_medium,
          utmContent: row.utm_content,
        },
        directory,
      ),
    }))
    .sort((a, b) => (b.bookedAt ?? "").localeCompare(a.bookedAt ?? ""));

  return {
    rows,
    summary: summarizeCallCredits(rows),
    connected: true,
    since: bookedSince.toISOString(),
  };
}

function emptyReport(since: string, connected: boolean): CallCreditReport {
  return {
    rows: [],
    summary: summarizeCallCredits([]),
    connected,
    since,
  };
}
