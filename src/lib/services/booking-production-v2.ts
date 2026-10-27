import "server-only";
import { createHash } from "node:crypto";
import { getBookedCallsV2 } from "@/lib/services/booked-calls-v2-data";
import { pacificStartIso } from "@/lib/services/data-report";
import { pacificDay, type Decision } from "@/lib/booked-calls-v2/engine";
import {
  RULE_VERSION,
  RULE_CONFIG_SHA,
  TIME_ZONE,
  type BookedBy,
} from "@/lib/booked-calls-v2/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCloseClient } from "@/lib/close/client";
import { config } from "@/lib/config";

export const BUCKETS: BookedBy[] = ["Marketing", "Lane 2", "Social DMs"];
export function addDay(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekDays(day: string): string[] {
  const start = addDay(
    day,
    -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7),
  );
  return Array.from({ length: 7 }, (_, i) => addDay(start, i));
}
function bucketTotals(rows: readonly Decision[]) {
  return Object.fromEntries(
    BUCKETS.map((b) => [
      b,
      rows.filter((d) => d.disposition === "counted" && d.bookedBy === b)
        .length,
    ]),
  ) as Record<BookedBy, number>;
}
function coverage(rows: readonly Decision[]) {
  return {
    unreviewed: rows.filter((d) => d.disposition === "held").length,
    undatable: rows.filter((d) => d.reason === "missing_timestamp").length,
    noCloseMatch: rows.filter(
      (d) => d.disposition === "counted" && !d.origin.source,
    ).length,
    laneTwoExcluded: 0,
  };
}
export function aggregateProduction(rows: readonly Decision[], now: Date) {
  const day = pacificDay(now.toISOString());
  function period(dates: string[]) {
    const r = rows.filter((d) => dates.includes(d.createdDay));
    const buckets = bucketTotals(r);
    return {
      start: dates[0]!,
      end: dates[6]!,
      total: buckets.Marketing,
      buckets,
      coverage: coverage(r),
      days: dates.map((date) => {
        const buckets = bucketTotals(r.filter((d) => d.createdDay === date));
        return {
          date,
          total: date > day ? null : buckets.Marketing,
          buckets: date > day ? null : buckets,
        };
      }),
    };
  }
  const today = rows.filter((d) => d.createdDay === day);
  const buckets = bucketTotals(today);
  const sources = [
    ...new Set(
      today
        .filter(
          (d) => d.disposition === "counted" && d.bookedBy === "Marketing",
        )
        .map((d) => d.origin.source ?? "Unknown (Needs Review)"),
    ),
  ].sort();
  const channels = sources.map((label) => ({
    label,
    booked: today.filter(
      (d) =>
        d.disposition === "counted" &&
        d.bookedBy === "Marketing" &&
        (d.origin.source ?? "Unknown (Needs Review)") === label,
    ).length,
  }));
  return {
    schemaVersion: 2,
    ok: true,
    day,
    timeZone: TIME_ZONE,
    basis: "close-meeting-created",
    metricKey: "booked_calls_v2",
    scope: "marketing",
    cancellationsIncluded: false,
    ruleVersion: RULE_VERSION,
    ruleConfigSha: RULE_CONFIG_SHA,
    total: buckets.Marketing,
    buckets,
    channels,
    coverage: coverage(today),
    week: period(weekDays(day)),
    scorecard: {
      weekdays: "monday-sunday",
      timeZone: TIME_ZONE,
      weeks: Array.from({ length: 5 }, (_, i) =>
        period(weekDays(addDay(day, (i - 4) * 7))),
      ),
    },
  };
}

export function assertPublishedGeneration(
  stamps: readonly string[],
  startedAt: string,
) {
  if (
    stamps.length > 1 ||
    stamps.some(
      (stamp) =>
        !Number.isFinite(Date.parse(stamp)) ||
        Date.parse(stamp) > Date.parse(startedAt) ||
        Date.parse(startedAt) - Date.parse(stamp) > 1000,
    )
  )
    throw new Error(
      "Close row generations do not match the completed sync; totals withheld.",
    );
}

async function lastSync() {
  const { data, error } = await createAdminClient()
    .from("channel_sync_runs")
    .select("id,started_at,finished_at,error")
    .eq("connector", "close-meetings")
    .order("id", { ascending: false })
    .limit(1);
  const run = data?.[0];
  if (
    error ||
    !run?.finished_at ||
    run.error ||
    Date.now() - Date.parse(run.finished_at) > 3 * 3600_000
  )
    throw new Error(
      "The complete Close sync is unavailable, in progress, or stale; totals withheld.",
    );
  return run;
}
let cached:
  | { day: string; expires: number; promise: ReturnType<typeof readProduction> }
  | undefined;
async function readProduction(now: Date) {
  const before = await lastSync();
  const from = pacificStartIso(
    addDay(weekDays(pacificDay(now.toISOString()))[0]!, -28),
  );
  const to = now.toISOString();
  const report = await getBookedCallsV2({ from, to });
  if (!report.ok) throw new Error(report.error);
  // Sync runs are written at completion, not at start. Reject mixed row
  // generations and any unpublished in-flight generation, even if run ID is unchanged.
  assertPublishedGeneration(report.generations, before.started_at);
  const after = await lastSync();
  if (before.id !== after.id)
    throw new Error(
      "Close changed during the read; retry for a consistent snapshot.",
    );
  const counted = report.decisions
    .filter((d) => d.disposition === "counted")
    .map((d) => [
      d.meetingId,
      d.bookedBy,
      d.origin.source ?? "Unknown (Needs Review)",
    ])
    .sort();
  return {
    ...report,
    generatedAt: to,
    sourceUpdatedAt: after.finished_at!,
    snapshotId: createHash("sha256")
      .update(JSON.stringify(counted))
      .digest("hex"),
  };
}
export async function getProductionV2(details = false, now = new Date()) {
  const day = pacificDay(now.toISOString());
  if (!cached || cached.day !== day || cached.expires < now.getTime()) {
    const entry = {
      day,
      expires: now.getTime() + 120_000,
      promise: readProduction(now),
    };
    cached = entry;
    entry.promise.catch(() => {
      if (cached === entry) cached = undefined;
    });
  }
  const report = await cached.promise;
  const result = {
    ...aggregateProduction(report.decisions, new Date(report.generatedAt)),
    generatedAt: report.generatedAt,
    sourceUpdatedAt: report.sourceUpdatedAt,
    snapshotId: report.snapshotId,
    from: report.from,
    to: report.to,
    source: "Close meeting activity mirror",
    canonicalCommit: "9783f9a74a7c6cca28a8ad541f9859d75ad998f5",
  };
  if (!details) return result;
  // Names are private display enrichment, never an eligibility/attribution input.
  // This client only searches; no CRM writes occur.
  if (!config.CLOSE_API_KEY)
    throw new Error("Private Close detail lookup is unavailable.");
  const close = createCloseClient({ apiKey: config.CLOSE_API_KEY });
  const ids = [...new Set(report.decisions.map((d) => d.leadId))];
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const response = await close.searchLeads({
      query: {
        type: "or",
        queries: batch.map((value) => ({ type: "id", value })),
      },
      _fields: { lead: ["id", "display_name"] },
      _limit: 100,
    });
    for (const lead of response.data ?? [])
      names.set(String(lead.id), String(lead.display_name ?? lead.id));
  }
  const meetings = new Map(report.meetings.map((m) => [m.id, m]));
  return {
    ...result,
    decisions: report.decisions.map((d) => ({
      ...d,
      name: names.get(d.leadId) ?? d.leadId,
      title: meetings.get(d.meetingId)?.title ?? "",
      bookedAt: meetings.get(d.meetingId)?.dateCreated,
      appointmentAt: meetings.get(d.meetingId)?.startsAt,
      outcome: meetings.get(d.meetingId)?.outcome,
      closeUrl: `https://app.close.com/lead/${encodeURIComponent(d.leadId)}/`,
    })),
  };
}
