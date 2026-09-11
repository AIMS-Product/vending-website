import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isInternalLead } from "@/lib/services/admin-analytics-internal";
import {
  ADMIN_ANALYTICS_RANGES,
  DEFAULT_ADMIN_ANALYTICS_RANGE,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";
import {
  dayKey,
  fetchFacts,
  fetchRuns,
  type ReportClient,
} from "@/lib/services/channel-report";
import { normaliseFacts } from "@/lib/services/channel-report-rollup";
import {
  buildKpiReport,
  type EmailSnapshotRow,
  type KpiReport,
  type SetterBookingRow,
  type WebinarEventRow,
} from "@/lib/services/kpi-report";

const DAY_MS = 24 * 60 * 60 * 1000;

export type KpiTabData = {
  range: {
    key: AdminAnalyticsRangeKey;
    label: string;
    days: number;
    startDay: string;
    endDay: string;
  };
  report: KpiReport;
  /** False when the spine tables do not exist yet. */
  connected: boolean;
};

/** The KPI framework for one range. Every read failure leaves its input empty, never fakes rows. */
export async function getKpiTab(
  input: {
    range?: AdminAnalyticsRangeKey;
    client?: ReportClient;
    now?: Date;
  } = {},
): Promise<KpiTabData> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const rangeKey = input.range ?? DEFAULT_ADMIN_ANALYTICS_RANGE;
  const { label, days } = ADMIN_ANALYTICS_RANGES[rangeKey];
  const endDay = dayKey(now);
  const startDay = dayKey(new Date(now.getTime() - (days - 1) * DAY_MS));
  const endExclusive = `${dayKey(new Date(now.getTime() + DAY_MS))}T00:00:00.000Z`;

  const [facts, runs, webinars, emailSnapshots, setterBookings] =
    await Promise.all([
      fetchFacts(client, startDay, endDay),
      fetchRuns(client),
      fetchWebinars(client, startDay, endDay),
      fetchEmailSnapshots(client, startDay, endDay),
      fetchSetterBookings(client, `${startDay}T00:00:00.000Z`, endExclusive),
    ]);

  const lastRun: Record<string, string | null> = {};
  for (const run of runs) {
    const finished = run.finished_at ?? run.started_at;
    const seen = lastRun[run.connector];
    if (seen === undefined || (finished && finished > (seen ?? "")))
      lastRun[run.connector] = finished;
  }

  return {
    range: { key: rangeKey, label, days, startDay, endDay },
    report: buildKpiReport({
      facts: normaliseFacts(facts ?? []),
      webinars,
      emailSnapshots,
      setterBookings,
      lastRun,
    }),
    connected: facts !== null,
  };
}

async function fetchWebinars(
  client: ReportClient,
  startDay: string,
  endDay: string,
): Promise<WebinarEventRow[]> {
  try {
    const { data, error } = await client
      .from("webinar_events")
      .select(
        "date,label,format,registrations,attendees,booked_night_of,showed,won,revenue,spend",
      )
      .gte("date", startDay)
      .lte("date", endDay)
      .order("date", { ascending: false })
      .limit(500);
    if (error) return [];
    return (data ?? []) as WebinarEventRow[];
  } catch {
    return [];
  }
}

async function fetchEmailSnapshots(
  client: ReportClient,
  startDay: string,
  endDay: string,
): Promise<EmailSnapshotRow[]> {
  try {
    const { data, error } = await client
      .from("ghl_email_stats")
      .select(
        "snapshot_day,workflow_id,workflow_name,sent,delivered,opened,clicked,replied",
      )
      .gte("snapshot_day", startDay)
      .lte("snapshot_day", endDay)
      .order("snapshot_day")
      // A year of daily snapshots for ~60 workflows.
      .limit(25_000);
    if (error) return [];
    return (data ?? []) as EmailSnapshotRow[];
  } catch {
    return [];
  }
}

type BookedLead = SetterBookingRow & {
  email: string;
  full_name: string;
};

async function fetchSetterBookings(
  client: ReportClient,
  startIso: string,
  endIso: string,
): Promise<SetterBookingRow[]> {
  const rows: BookedLead[] = [];
  try {
    for (let from = 0; from < 20_000; from += 1000) {
      const { data, error } = await client
        .from("lead_submissions")
        .select("booked_by_setter,call_outcome,closed_won_at,email,full_name")
        .gte("call_booked_at", startIso)
        .lt("call_booked_at", endIso)
        .order("call_booked_at")
        .range(from, from + 999);
      if (error) return [];
      const batch = (data ?? []) as BookedLead[];
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
  } catch {
    return [];
  }
  return rows
    .filter((lead) => !isInternalLead(lead.email, lead.full_name))
    .map(({ booked_by_setter, call_outcome, closed_won_at }) => ({
      booked_by_setter,
      call_outcome,
      closed_won_at,
    }));
}
