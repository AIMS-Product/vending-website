import "server-only";

import { buildCallCreditReport } from "@/lib/services/call-credit-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { isInternalLead } from "@/lib/services/admin-analytics-internal";
import {
  resolveAdminAnalyticsRange,
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
  const { label, days, endsAt } = resolveAdminAnalyticsRange(rangeKey, now);
  const endDay = dayKey(endsAt);
  const startDay = dayKey(new Date(endsAt.getTime() - (days - 1) * DAY_MS));
  const endExclusive = `${dayKey(new Date(endsAt.getTime() + DAY_MS))}T00:00:00.000Z`;

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
        "date,label,format,registrations,attendees,booked_night_of,booked_ever,showed,show_no_booking,won,revenue,spend,booking_maturing,revenue_maturing",
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

/**
 * Who set each call in the range, from the same evidence the bookings ledger
 * uses: Calendly's own record of the rep who booked it, then a setter's tagged
 * link. Close's "Reactivation - Setter Name" is the last resort, not the first.
 *
 * This used to read `booked_by_setter` alone, which only a human remembering to
 * fill a Close field ever populates — so nearly every call a setter booked
 * landed under "No setter (self-booked)" and the setter rows understated real
 * work by an order of magnitude. Two pages disagreeing about the same setter's
 * number is how the credit argument restarts.
 */
async function fetchSetterBookings(
  client: ReportClient,
  startIso: string,
  endIso: string,
): Promise<SetterBookingRow[]> {
  const report = await buildCallCreditReport(
    { window: { startIso, endIso } },
    { client },
  );
  if (report.rows.length === 0) return [];

  const leadIds = report.rows
    .map((row) => row.leadSubmissionId)
    .filter((id): id is string => Boolean(id));
  const outcomes = await fetchLeadOutcomes(client, leadIds);

  return report.rows
    .filter((row) => !isInternalLead(row.inviteeEmail, row.inviteeName))
    .map((row) => {
      const outcome = row.leadSubmissionId
        ? outcomes.get(row.leadSubmissionId)
        : undefined;
      return {
        booked_by_setter:
          row.credit.kind === "rep" ? row.credit.who : row.closeSetter,
        call_outcome: outcome?.call_outcome ?? null,
        closed_won_at: outcome?.closed_won_at ?? null,
      };
    });
}

type LeadOutcome = {
  call_outcome: string | null;
  closed_won_at: string | null;
};

/** Outcomes for the leads behind these bookings, in pages Postgres will accept. */
async function fetchLeadOutcomes(
  client: ReportClient,
  leadIds: string[],
): Promise<Map<string, LeadOutcome>> {
  const outcomes = new Map<string, LeadOutcome>();
  const unique = [...new Set(leadIds)];
  try {
    for (let i = 0; i < unique.length; i += 200) {
      const { data, error } = await client
        .from("lead_submissions")
        .select("id,call_outcome,closed_won_at")
        .in("id", unique.slice(i, i + 200));
      if (error) return outcomes;
      for (const lead of data ?? []) {
        outcomes.set(lead.id, {
          call_outcome: lead.call_outcome,
          closed_won_at: lead.closed_won_at,
        });
      }
    }
  } catch {
    return outcomes;
  }
  return outcomes;
}
