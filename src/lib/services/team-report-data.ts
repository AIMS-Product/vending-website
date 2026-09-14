import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isInternalLead } from "@/lib/services/admin-analytics-internal";
import { buildCallCreditReport } from "@/lib/services/call-credit-data";
import { hasTargets } from "@/lib/services/channel-targets";
import { fetchFacts } from "@/lib/services/channel-report";
import type { ChannelFact } from "@/lib/services/channel-report-rollup";
import { goalPeriod, type GoalPeriodKey } from "@/lib/services/goal-report";
import type { Period } from "@/lib/services/goal-pace";
import {
  buildAds,
  buildClosers,
  buildSetters,
  buildSocials,
  buildWebinars,
  type AdsReport,
  type ClosersReport,
  type CreditedBooking,
  type FunnelLeadRow,
  type HostedBooking,
  type PostRow,
  type SettersReport,
  type SocialsReport,
  type VideoDayRow,
  type WebinarEventRow,
  type WebinarsReport,
} from "@/lib/services/team-report";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

export const TEAM_TABS = [
  { key: "setters", label: "Setters (Lane 1)" },
  { key: "closers", label: "Closers (Lane 2)" },
  { key: "webinars", label: "Webinars" },
  { key: "socials", label: "Socials" },
  { key: "ads", label: "Ads" },
] as const;

export type TeamTabKey = (typeof TEAM_TABS)[number]["key"];

export function parseTeamTab(value: string | undefined): TeamTabKey {
  return TEAM_TABS.find((tab) => tab.key === value?.trim())?.key ?? "setters";
}

export type TeamTabData = {
  tab: TeamTabKey;
  period: Period;
  periodLabel: string;
  today: string;
  /** False when the Close mirror could not be read (people tabs only). */
  connected: boolean;
  setters?: SettersReport;
  closers?: ClosersReport;
  webinars?: WebinarsReport;
  socials?: SocialsReport;
  ads?: AdsReport;
};

const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000;
const DAY_MS = 86_400_000;

/** One tab's data. Only what the tab shows is read. */
export async function getTeamTab(input: {
  tab: TeamTabKey;
  period: GoalPeriodKey;
  client?: Client;
  now?: Date;
}): Promise<TeamTabData> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const today = dayKey(now);
  const { period, label, months, firstMonth } = goalPeriod(input.period);
  const base: TeamTabData = {
    tab: input.tab,
    period,
    periodLabel: label,
    today,
    connected: true,
  };

  if (input.tab === "setters") {
    const [leads, bookings] = await Promise.all([
      fetchLeads(client, period.start, period.end),
      fetchCreditedBookings(client, period),
    ]);
    return {
      ...base,
      connected: leads !== null,
      setters: buildSetters({
        leads: leads ?? [],
        bookings,
        period,
        months,
        targetsApply: hasTargets(firstMonth),
      }),
    };
  }

  if (input.tab === "closers") {
    // A call held this period may have been booked up to three months ago.
    const [leads, hosted] = await Promise.all([
      fetchLeads(client, shiftDay(period.start, -90), period.end),
      fetchHostedBookings(client, period),
    ]);
    return {
      ...base,
      connected: leads !== null,
      closers: buildClosers({ leads: leads ?? [], hosted, period }),
    };
  }

  if (input.tab === "webinars") {
    // Reach back for the webinar before the period so the first spend window
    // has a start, and for the spend that bought it.
    const from = shiftDay(period.start, -45);
    const [events, facts] = await Promise.all([
      fetchWebinarEvents(client, from, period.end),
      fetchFacts(client, from, period.end),
    ]);
    return {
      ...base,
      connected: facts !== null,
      webinars: buildWebinars({ events, spend: facts ?? [], period }),
    };
  }

  if (input.tab === "socials") {
    // Weeks are whole Monday-to-Sunday spans, so read a week either side.
    const from = shiftDay(period.start, -7);
    const to = shiftDay(period.end, 7);
    const [posts, views] = await Promise.all([
      fetchPosts(client, from, to),
      fetchVideoDays(client, from, to),
    ]);
    return {
      ...base,
      socials: buildSocials({ posts, views, period, today }),
    };
  }

  const facts = await fetchFacts(client, period.start, period.end);
  return {
    ...base,
    connected: facts !== null,
    ads: buildAds({ facts: (facts ?? []) as ChannelFact[] }),
  };
}

/** Null (not empty) when the mirror table cannot be read. */
async function fetchLeads(
  client: Client,
  startDay: string,
  endDay: string,
): Promise<FunnelLeadRow[] | null> {
  const rows: FunnelLeadRow[] = [];
  try {
    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await client
        .from("close_lead_funnel")
        .select(
          "lead_id,display_name,email,funnel,first_sales_call_booked_date,first_call_show_up,status_label,setter_name",
        )
        .gte("first_sales_call_booked_date", startDay)
        .lte("first_sales_call_booked_date", endDay)
        .order("first_sales_call_booked_date")
        .order("lead_id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error("close_lead_funnel read failed", {
          code: error.code,
          message: error.message,
        });
        return null;
      }
      const batch = (data ?? []) as FunnelLeadRow[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
  } catch {
    return null;
  }
  return rows.filter((row) => !isInternalLead(row.email, row.display_name));
}

/**
 * Calendly bookings with who set them, through the same resolver as the
 * bookings page. Booked-at reaches a month before the period so a Close first
 * call booked on the 1st still finds the Calendly booking behind it.
 */
async function fetchCreditedBookings(
  client: Client,
  period: Period,
): Promise<CreditedBooking[]> {
  const report = await buildCallCreditReport(
    {
      window: {
        startIso: `${shiftDay(period.start, -30)}T00:00:00.000Z`,
        endIso: `${shiftDay(period.end, 1)}T00:00:00.000Z`,
      },
      limit: 20_000,
    },
    { client },
  );
  return report.rows
    .filter((row) => !isInternalLead(row.inviteeEmail, row.inviteeName))
    .map((row) => ({
      email: row.inviteeEmail,
      bookedAt: row.bookedAt,
      startAt: row.startAt,
      calendar: row.calendar,
      canceled: row.canceled,
      credit: row.credit,
    }));
}

type RawHostedRow = {
  invitee_email: string | null;
  invitee_name: string | null;
  scheduled_event_name: string | null;
  event_start_at: string | null;
  canceled_at: string | null;
  hosts: unknown;
};

/** Bookings by call start, with the names on the calendar they landed on. */
async function fetchHostedBookings(
  client: Client,
  period: Period,
): Promise<HostedBooking[]> {
  const rows: HostedBooking[] = [];
  try {
    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await client
        .from("calendly_bookings")
        .select(
          "invitee_email,invitee_name,scheduled_event_name,event_start_at,canceled_at,hosts:raw_payload->payload->scheduled_event->event_memberships",
        )
        .eq("event_kind", "invitee.created")
        .gte("event_start_at", `${period.start}T00:00:00.000Z`)
        .lt("event_start_at", `${shiftDay(period.end, 1)}T00:00:00.000Z`)
        .order("event_start_at")
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error("calendly_bookings read failed", {
          code: error.code,
          message: error.message,
        });
        return rows;
      }
      const batch = (data ?? []) as unknown as RawHostedRow[];
      for (const row of batch) {
        if (isInternalLead(row.invitee_email, row.invitee_name)) continue;
        rows.push({
          email: row.invitee_email,
          calendar: row.scheduled_event_name,
          startAt: row.event_start_at,
          canceled: Boolean(row.canceled_at),
          hosts: hostNames(row.hosts),
        });
      }
      if (batch.length < PAGE_SIZE) break;
    }
  } catch {
    return rows;
  }
  return rows;
}

function hostNames(memberships: unknown): string[] {
  if (!Array.isArray(memberships)) return [];
  return memberships.flatMap((member) => {
    const name = (member as { user_name?: unknown } | null)?.user_name;
    return typeof name === "string" && name.trim() ? [name.trim()] : [];
  });
}

/**
 * Requested with `booked_ever` first and retried without: the column ships in
 * migration 20260913140000 ahead of being applied, and an unknown column 400s
 * the whole select, which would blank the tab rather than one cell.
 */
async function fetchWebinarEvents(
  client: Client,
  startDay: string,
  endDay: string,
): Promise<WebinarEventRow[]> {
  const base =
    "date,label,format,registrations,attendees,attendees_at_offer,showed,won";
  const read = (columns: string) =>
    client
      .from("webinar_events")
      .select(columns)
      .gte("date", startDay)
      .lte("date", endDay)
      .order("date")
      .limit(500);
  try {
    let result = await read(`${base},booked_ever`);
    if (result.error) result = await read(base);
    if (result.error) return [];
    return (result.data ?? []) as unknown as WebinarEventRow[];
  } catch {
    return [];
  }
}

async function fetchPosts(
  client: Client,
  startDay: string,
  endDay: string,
): Promise<PostRow[]> {
  const rows: PostRow[] = [];
  try {
    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await client
        .from("metricool_posts")
        .select("network,brand_id,published_at")
        .gte("published_at", `${startDay}T00:00:00.000Z`)
        .lt("published_at", `${shiftDay(endDay, 1)}T00:00:00.000Z`)
        .order("published_at")
        .order("post_id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) return rows;
      const batch = (data ?? []) as PostRow[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
  } catch {
    return rows;
  }
  return rows;
}

async function fetchVideoDays(
  client: Client,
  startDay: string,
  endDay: string,
): Promise<VideoDayRow[]> {
  const rows: VideoDayRow[] = [];
  try {
    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await client
        .from("youtube_video_daily")
        .select("day,views")
        .gte("day", startDay)
        .lte("day", endDay)
        .order("day")
        .order("video_id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) return rows;
      const batch = (data ?? []) as VideoDayRow[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
  } catch {
    return rows;
  }
  return rows;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDay(day: string, days: number): string {
  return dayKey(new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS));
}
