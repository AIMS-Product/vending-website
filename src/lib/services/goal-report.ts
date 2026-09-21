import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  channelKeyForFunnel,
  GOAL_CHANNELS,
  hasTargets,
  OTHER_CHANNEL,
  TARGET_BASIS,
  targetOver,
  totalTargetOver,
  type GoalChannel,
} from "@/lib/services/channel-targets";
import { CLOSE_LEAD_FUNNEL_CONNECTOR } from "@/lib/services/close-lead-funnel-sync";
import {
  buildPace,
  monthKey,
  monthPeriod,
  type Pace,
  type Period,
} from "@/lib/services/goal-pace";
import { weekStartOf } from "@/lib/services/close-week-view";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type ReportClient = Pick<SupabaseClient<Database>, "from">;

const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000;

export type GoalPeriodKey = { kind: "month"; month: string } | { kind: "q4" };

export type GoalRow = {
  key: string;
  label: string;
  note: string | null;
  pace: Pace;
  /**
   * Booked so far in the current Friday-to-Thursday week, and the share of the
   * period's target that week should carry. Null when today is outside the
   * period, where a week to date would answer nothing.
   */
  week: { booked: number; target: number | null } | null;
  /**
   * Of the calls booked in the period, how many carry a show-up answer in
   * Close. The rest have no outcome yet, so any show rate is an upper bound.
   */
  outcomeLogged: { known: number; total: number } | null;
  /** Lane 2 only: how many booked calls carry a setter's name in Close. */
  setterNamed: { known: number; total: number } | null;
};

export type GoalReport = {
  period: Period;
  periodLabel: string;
  periodKey: GoalPeriodKey;
  today: string;
  /** False when the mirror table is not there yet. */
  connected: boolean;
  /** When the mirror last finished a run, null if never. */
  updatedAt: string | null;
  basis: string;
  targetsApply: boolean;
  total: GoalRow;
  rows: GoalRow[];
  other: GoalRow;
  /** Booked calls whose lead has no funnel in Close. */
  untracked: number;
  /**
   * Every booked call in the period, plan channels and all. The total row
   * counts only the channels the plan sets a number for, so this is carried
   * separately rather than quietly folded into a row with a target on it.
   */
  allBooked: number | null;
  /** The Friday the current week started on, null when today is outside the period. */
  weekStart: string | null;
};

type MirrorRow = {
  funnel: string | null;
  first_sales_call_booked_date: string | null;
  first_call_show_up: string | null;
  setter_name: string | null;
};

export function parseGoalPeriod(
  raw: string | undefined,
  now: Date,
): GoalPeriodKey {
  if (raw === "q4") return { kind: "q4" };
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return { kind: "month", month: raw };
  return { kind: "month", month: monthKey(dayKey(now)) };
}

export function goalPeriod(key: GoalPeriodKey): {
  period: Period;
  label: string;
  months: number;
  firstMonth: string;
} {
  if (key.kind === "q4") {
    return {
      period: { start: "2026-10-01", end: "2026-12-31" },
      label: "Q4 2026",
      months: 3,
      firstMonth: "2026-10",
    };
  }
  const period = monthPeriod(key.month);
  const [year, month] = key.month.split("-").map(Number) as [number, number];
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  return { period, label, months: 1, firstMonth: key.month };
}

export async function getGoalReport(
  input: { period?: GoalPeriodKey; client?: ReportClient; now?: Date } = {},
): Promise<GoalReport> {
  const now = input.now ?? new Date();
  const today = dayKey(now);
  const client = input.client ?? createAdminClient();
  const periodKey = input.period ?? parseGoalPeriod(undefined, now);
  const { period, label, months, firstMonth } = goalPeriod(periodKey);
  const targetsApply = hasTargets(firstMonth);

  // Weeks run Friday to Thursday, as the sales floor and SteelTrap count them.
  // The week can open before the period does (Oct 1 2026 is a Thursday), so
  // the read window starts at whichever came first.
  const weekStart =
    today >= period.start && today <= period.end ? weekStartOf(today) : null;
  const readStart =
    weekStart != null && weekStart < period.start ? weekStart : period.start;
  const readEnd = today > period.end ? today : period.end;

  const [mirror, updatedAt] = await Promise.all([
    fetchMirror(client, readStart, readEnd),
    fetchUpdatedAt(client),
  ]);
  const connected = mirror !== null;
  const rows = mirror ?? [];

  const inPeriod = rows.filter((row) =>
    within(row.first_sales_call_booked_date, period),
  );
  const inWeek =
    weekStart == null
      ? []
      : rows.filter((row) =>
          within(row.first_sales_call_booked_date, {
            start: weekStart,
            end: today,
          }),
        );

  const build = (channel: GoalChannel): GoalRow => {
    const mine = inPeriod.filter(
      (row) => channelKeyForFunnel(row.funnel) === channel.key,
    );
    const target = targetsApply
      ? targetOver(channel, firstMonth, months)
      : null;
    const pace = buildPace({
      target,
      actual: connected ? mine.length : null,
      period,
      today,
      workdays: channel.workdays,
    });
    return {
      key: channel.key,
      label: channel.label,
      note: channel.note ?? null,
      pace,
      week:
        weekStart == null || !connected
          ? null
          : {
              booked: inWeek.filter(
                (row) => channelKeyForFunnel(row.funnel) === channel.key,
              ).length,
              target: pace.weeklyTarget,
            },
      outcomeLogged: connected ? logged(mine, "first_call_show_up") : null,
      setterNamed:
        connected && channel.key === "lane-2"
          ? logged(mine, "setter_name")
          : null,
    };
  };

  const channelRows = GOAL_CHANNELS.map(build);
  const other = build(OTHER_CHANNEL);
  const untracked = inPeriod.filter(
    (row) => channelKeyForFunnel(row.funnel) === null,
  ).length;

  // The total counts the channels the plan sets a number for, and nothing
  // else. Holding every booked call against a six-channel target made
  // September read "ahead" on the strength of Meta, Google and LinkedIn
  // bookings the plan never asked for. A target and its actual are one
  // population, here as on every row.
  const planKeys = new Set(GOAL_CHANNELS.map((channel) => channel.key));
  const inPlan = inPeriod.filter((row) =>
    planKeys.has(channelKeyForFunnel(row.funnel) ?? ""),
  );
  const inPlanThisWeek = inWeek.filter((row) =>
    planKeys.has(channelKeyForFunnel(row.funnel) ?? ""),
  );
  const totalTarget = targetsApply ? totalTargetOver(firstMonth, months) : null;
  const totalPace = buildPace({
    target: totalTarget,
    actual: connected ? inPlan.length : null,
    period,
    today,
  });
  const total: GoalRow = {
    key: "total",
    label: "Plan channels",
    note: null,
    pace: totalPace,
    week:
      weekStart == null || !connected
        ? null
        : { booked: inPlanThisWeek.length, target: totalPace.weeklyTarget },
    outcomeLogged: connected ? logged(inPlan, "first_call_show_up") : null,
    setterNamed: null,
  };

  return {
    period,
    periodLabel: label,
    periodKey,
    today,
    connected,
    updatedAt,
    basis: TARGET_BASIS,
    targetsApply,
    total,
    rows: channelRows,
    other,
    untracked,
    allBooked: connected ? inPeriod.length : null,
    weekStart,
  };
}

/** Null (not empty) when the mirror table does not exist yet. */
async function fetchMirror(
  client: ReportClient,
  startDay: string,
  endDay: string,
): Promise<MirrorRow[] | null> {
  const rows: MirrorRow[] = [];
  try {
    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await client
        .from("close_lead_funnel")
        .select(
          "funnel,first_sales_call_booked_date,first_call_show_up,setter_name",
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
      const batch = (data ?? []) as MirrorRow[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
  } catch {
    return null;
  }
  return rows;
}

async function fetchUpdatedAt(client: ReportClient): Promise<string | null> {
  try {
    const { data, error } = await client
      .from("channel_sync_runs")
      .select("finished_at,error")
      .eq("connector", CLOSE_LEAD_FUNNEL_CONNECTOR)
      .is("error", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.finished_at ?? null;
  } catch {
    return null;
  }
}

function logged(
  rows: MirrorRow[],
  field: "first_call_show_up" | "setter_name",
): { known: number; total: number } {
  return {
    known: rows.filter((row) => Boolean(row[field]?.trim())).length,
    total: rows.length,
  };
}

function within(day: string | null, period: Period): boolean {
  return day != null && day >= period.start && day <= period.end;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
