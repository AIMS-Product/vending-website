import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCacReport,
  type CacMonthInput,
  type CacReport,
  type CacRouteInput,
} from "@/lib/services/cac-report";

/** Last day of a month, so a month row never has to be told how long it is twice. */
function lastDay(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

type MonthRow = {
  month: string;
  days_in_month: number;
  days_elapsed: number | null;
  note: string | null;
};

type RouteRow = {
  id: string;
  group_label: string;
  route: string;
  owner: string | null;
  sort_order: number;
  fixed_monthly_cost: number | null;
  variable_spend: number | null;
  spend_channel: string | null;
  spend_source: string;
  closed_won: number | null;
  march_cac: number | null;
  notes: string | null;
};

export type CacMonthOption = {
  readonly month: string;
  readonly label: string;
  /** True when the workbook's day count disagrees with the calendar. */
  readonly daysInMonthLooksWrong: boolean;
};

export type CacPageData = {
  readonly months: readonly CacMonthOption[];
  readonly report: CacReport | null;
  /** Set when the tables are not in production yet, so the page says so instead of reading empty. */
  readonly unavailable: string | null;
  readonly daysInMonthLooksWrong: boolean;
};

const monthLabel = (month: string) =>
  new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Ad spend the channel spine observed for a month, keyed 'channel|source' so a route
 * can name exactly what it wants to read. Summed over the whole calendar month, not
 * the elapsed window: the workbook's variable spend is month-to-date and a partial
 * month already shows as partial in the data.
 */
async function observedSpend(
  client: ReturnType<typeof createAdminClient>,
  month: string,
): Promise<Map<string, number>> {
  const end = `${month.slice(0, 7)}-${String(lastDay(month)).padStart(2, "0")}`;
  const { data, error } = await client
    .from("channel_daily")
    .select("channel,source,spend")
    .gte("day", month)
    .lte("day", end)
    .limit(5000);
  const totals = new Map<string, number>();
  if (error || !data) return totals;
  for (const row of data) {
    if (row.spend == null) continue;
    const key = `${row.channel}|${row.source}`;
    totals.set(key, (totals.get(key) ?? 0) + row.spend);
  }
  return totals;
}

export async function getCacPageData(
  requested: string | undefined,
  now = new Date(),
): Promise<CacPageData> {
  const client = createAdminClient();
  const { data: monthRows, error: monthError } = await client
    .from("cac_months")
    .select("month,days_in_month,days_elapsed,note")
    .order("month", { ascending: false })
    .limit(36);

  if (monthError) {
    // The tables ship in migration 20260917160000 ahead of being applied. Say that
    // plainly rather than rendering an empty tracker that reads like "no spend".
    return {
      months: [],
      report: null,
      unavailable:
        "The CAC tables are not in this database yet. Apply migration 20260917160000_cac_tracker.sql, then re-run the importer.",
      daysInMonthLooksWrong: false,
    };
  }

  const rows = (monthRows ?? []) as MonthRow[];
  const months: CacMonthOption[] = rows.map((row) => ({
    month: row.month,
    label: monthLabel(row.month),
    daysInMonthLooksWrong: row.days_in_month !== lastDay(row.month),
  }));
  if (!months.length) {
    return {
      months,
      report: null,
      unavailable:
        "No months imported yet. Run scripts/seed_cac_tracker.py --apply against MTD_CAC_Tracker.xlsx.",
      daysInMonthLooksWrong: false,
    };
  }

  const selected =
    months.find((m) => m.month === requested)?.month ?? months[0]!.month;
  const monthRow = rows.find((row) => row.month === selected)!;

  const { data: routeRows } = await client
    .from("cac_routes")
    .select(
      "id,group_label,route,owner,sort_order,fixed_monthly_cost,variable_spend,spend_channel,spend_source,closed_won,march_cac,notes",
    )
    .eq("month", selected)
    .order("sort_order")
    .limit(200);

  const month: CacMonthInput = {
    month: monthRow.month,
    daysInMonth: monthRow.days_in_month,
    daysElapsed: monthRow.days_elapsed,
    note: monthRow.note,
  };
  const routes: CacRouteInput[] = ((routeRows ?? []) as RouteRow[]).map(
    (row) => ({
      id: row.id,
      groupLabel: row.group_label,
      route: row.route,
      owner: row.owner,
      sortOrder: row.sort_order,
      fixedMonthlyCost: row.fixed_monthly_cost,
      variableSpend: row.variable_spend,
      spendChannel: row.spend_channel,
      spendSource: row.spend_source === "auto" ? "auto" : "manual",
      closedWon: row.closed_won,
      marchCac: row.march_cac,
      notes: row.notes,
    }),
  );

  return {
    months,
    report: buildCacReport(
      month,
      routes,
      await observedSpend(client, selected),
      now,
    ),
    unavailable: null,
    daysInMonthLooksWrong:
      months.find((m) => m.month === selected)?.daysInMonthLooksWrong ?? false,
  };
}
