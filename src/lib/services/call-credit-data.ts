import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCalendlyDirectory,
  buildChatIndex,
  resolveCallCredit,
  resolveChatTouch,
  summarizeCallCredits,
  type ChatConversationRow,
  type ChatIndex,
  type CallCreditRow,
  type CallCreditSummary,
} from "@/lib/services/call-credit";
import { readAllPages } from "@/lib/services/paged-read";
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
/**
 * The lead join, with the inferred setter touch. Requested first and retried
 * without on error: `20260912130000_setter_touch.sql` ships ahead of being
 * applied by hand, and an unknown column inside an embedded select 400s the
 * WHOLE query — which would empty the page rather than drop one column.
 */
const LEAD_JOIN_WITH_TOUCH =
  "lead:lead_submissions(booked_by_setter,setter_touch_name,setter_touch_at)";
const LEAD_JOIN_BASE = "lead:lead_submissions(booked_by_setter)";

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
  "lead_submission_id",
  "booked_at:raw_payload->payload->>created_at",
  "scheduled_by:raw_payload->payload->>invitee_scheduled_by",
  "hosts:raw_payload->payload->scheduled_event->event_memberships",
].join(",");

const fieldsWith = (leadJoin: string) => `${CALL_CREDIT_FIELDS},${leadJoin}`;

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
  lead_submission_id: string | null;
  lead: {
    booked_by_setter: string | null;
    setter_touch_name?: string | null;
    setter_touch_at?: string | null;
  } | null;
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
/** PostgREST's own ceiling; asking for more in one request silently truncates. */
const PAGE = 1000;

export async function buildCallCreditReport(
  options: {
    days?: number;
    limit?: number;
    /** Explicit booked-at window, for callers reporting on a fixed range. */
    window?: { startIso: string; endIso: string };
  } = {},
  deps: { client?: CallCreditClient } = {},
): Promise<CallCreditReport> {
  const days = options.days ?? 30;
  const limit = options.limit ?? 5000;
  const now = options.window ? Date.parse(options.window.endIso) : Date.now();
  const bookedSince = options.window
    ? new Date(options.window.startIso)
    : new Date(now - days * 86_400_000);
  const bookedUntilMs = options.window
    ? Date.parse(options.window.endIso)
    : now;
  // A call booked inside the window can sit anywhere from "yesterday" to
  // months out, and a call set long ago can happen inside it. Widen the SQL
  // window on the call date, then cut precisely on booked-at below.
  const callWindowStart = new Date(
    bookedSince.getTime() - 30 * 86_400_000,
  ).toISOString();
  const callWindowEnd = new Date(now + 180 * 86_400_000).toISOString();

  const client = deps.client ?? createAdminClient();

  let data: RawRow[] = [];
  // PostgREST caps a response at 1,000 rows and says so only in a header, so
  // `.limit(5000)` quietly returned 1,000 and every count built on it was
  // wrong — the Video tab published "1000 booked prospects" against 3,952 real
  // bookings. Pages explicitly instead, ordered by the same column it filters
  // on so the window is stable between requests.
  const read = (leadJoin: string, from: number, to: number) =>
    client
      .from("calendly_bookings")
      .select(fieldsWith(leadJoin))
      .eq("event_kind", "invitee.created")
      .gte("event_start_at", callWindowStart)
      .lte("event_start_at", callWindowEnd)
      .order("event_start_at", { ascending: false })
      .order("invitee_uri", { ascending: false })
      .range(from, to);

  try {
    let leadJoin = LEAD_JOIN_WITH_TOUCH;
    let probe = await read(leadJoin, 0, PAGE - 1);
    if (probe.error) {
      leadJoin = LEAD_JOIN_BASE;
      probe = await read(leadJoin, 0, PAGE - 1);
    }
    if (probe.error) {
      return emptyReport(bookedSince.toISOString(), false);
    }

    data = (probe.data ?? []) as unknown as RawRow[];
    while (data.length < limit && (probe.data ?? []).length === PAGE) {
      probe = await read(leadJoin, data.length, data.length + PAGE - 1);
      if (probe.error) break;
      data = [...data, ...((probe.data ?? []) as unknown as RawRow[])];
    }
    data = data.slice(0, limit);
  } catch {
    return emptyReport(bookedSince.toISOString(), false);
  }

  const directory = buildCalendlyDirectory(data);
  const [chats, closeSetters] = await Promise.all([
    fetchChatIndex(client),
    fetchCloseSetters(client),
  ]);

  /**
   * Close's setter for a booking, preferring the Close mirror over the site
   * lead row.
   *
   * `lead_submissions.booked_by_setter` only exists for leads that filled a
   * form on the site, so for reactivation and webinar leads — most of the
   * book — Close's setter field was invisible here and the credit fell
   * through to an inference or to "No tag". 1,235 bookings on 2026-09-21. The
   * mirror carries the same field for every Close lead, so a setter who
   * corrects the record in Close now sees it land.
   */
  const closeSetterFor = (row: RawRow): string | null => {
    const email = row.invitee_email?.trim().toLowerCase();
    const mirrored = email ? closeSetters.get(email) : null;
    return mirrored ?? row.lead?.booked_by_setter ?? null;
  };

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
      return (
        Number.isFinite(stamp) &&
        stamp >= bookedSince.getTime() &&
        stamp < bookedUntilMs
      );
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
          closeSetter: closeSetterFor(row),
          setterTouch: setterTouchOf(row),
        },
        directory,
      ),
      leadSubmissionId: row.lead_submission_id,
      closeSetter: closeSetterFor(row),
      chat: resolveChatTouch(
        {
          inviteeEmail: row.invitee_email,
          bookedAt: row.booked_at,
          utmContent: row.utm_content,
        },
        chats,
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

/**
 * Close's setter field for every mirrored lead, by email.
 *
 * Paged explicitly: PostgREST silently caps an unpaged read, and a partial map
 * here would quietly un-credit whoever fell past the cap.
 */
async function fetchCloseSetters(
  client: CallCreditClient,
): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  try {
    const { rows } = await readAllPages<{
      email: string | null;
      setter_name: string | null;
    }>((from, to, count) =>
      client
        .from("close_lead_funnel")
        .select("email,setter_name", { count })
        .order("lead_id")
        .range(from, to),
    );
    for (const row of rows) {
      const email = row.email?.trim().toLowerCase();
      const setter = row.setter_name?.trim();
      if (email && setter && !byEmail.has(email)) byEmail.set(email, setter);
    }
  } catch {
    return byEmail;
  }
  return byEmail;
}

/**
 * Every chat that ever left an address, indexed by it.
 *
 * The whole table is a few hundred rows, so this is one read rather than a
 * lookup per booking. ponytail: page it if the chat ever outgrows a single
 * request.
 */
async function fetchChatIndex(client: CallCreditClient): Promise<ChatIndex> {
  try {
    const { data, error } = await client
      .from("chatbot_conversations")
      .select("id,captured_email,created_at")
      .not("captured_email", "is", null)
      .limit(5000);
    if (error) return new Map();
    const rows: ChatConversationRow[] = (data ?? []).map((row) => ({
      id: row.id,
      capturedEmail: row.captured_email,
      createdAt: row.created_at,
    }));
    return buildChatIndex(rows);
  } catch {
    return new Map();
  }
}

/**
 * The stored inference, turned back into the gap the evidence line reads out.
 * Null whenever the migration is unapplied or the touch is missing its time.
 */
function setterTouchOf(
  row: RawRow,
): { name: string; minutesBefore: number } | null {
  const name = row.lead?.setter_touch_name?.trim();
  const at = row.lead?.setter_touch_at;
  const bookedAt = row.booked_at;
  if (!name || !at || !bookedAt) return null;
  const gapMs = Date.parse(bookedAt) - Date.parse(at);
  if (!Number.isFinite(gapMs) || gapMs < 0) return null;
  return { name, minutesBefore: Math.round(gapMs / 60_000) };
}

function emptyReport(since: string, connected: boolean): CallCreditReport {
  return {
    rows: [],
    summary: summarizeCallCredits([]),
    connected,
    since,
  };
}
