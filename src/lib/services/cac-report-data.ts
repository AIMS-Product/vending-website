import "server-only";

import { config } from "@/lib/config";
import { cachedCloseReads, fetchCloseDeals } from "@/lib/services/close-wins";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCacReport,
  type CacMonthInput,
  type CacReport,
  type CacRouteInput,
} from "@/lib/services/cac-report";

/**
 * The Close funnels ("Funnel Name DEAL (Opp)") each CAC route's closes are
 * counted from. A route absent here has no Close count and falls back to the
 * typed number. Edit here when a route or funnel is renamed.
 */
export const CAC_ROUTE_FUNNELS: Readonly<Record<string, readonly string[]>> = {
  Instagram: ["Instagram", "Anthony IG"],
  "LTF — Low Ticket Funnel": ["LTF - In-House"],
  "X (Twitter / Birdhouse)": ["X", "Anthony X"],
  "YouTube In House": ["YouTube"],
  "Internal Webinar": ["Internal Webinar"],
  VSL: ["VSL"],
  "Retargeting Meta Ads": ["Meta Ads"],
  // Recapture / Email is deliberately absent: "Reactivation Email" shows 0 won
  // in Close where the workbook typed 10 for September 2026, so it is the wrong
  // funnel. The route keeps its typed count until the right funnel is confirmed.
  "Mike Newsletter": ["Mike Newsletter", "Newsletter"],
  "Website / SEO / PPC": ["Website", "Google Ads", "Website - OG - Cam"],
  Referred: ["Referred"],
};

/**
 * Won deals per route for one calendar month, from Close by date won. Null
 * when Close cannot be read, so every route falls back to its typed closes and
 * the page says why.
 */
async function closesByRoute(
  client: ReturnType<typeof createAdminClient>,
  month: string,
): Promise<{ counts: Map<string, number> | null; error: string | null }> {
  if (!config.CLOSE_API_KEY) {
    return { counts: null, error: "CLOSE_API_KEY is not set." };
  }
  const end = `${month.slice(0, 7)}-${String(lastDay(month)).padStart(2, "0")}`;
  try {
    const deals = await fetchCloseDeals({
      from: month,
      to: end,
      close: cachedCloseReads(),
      mirror: client,
    });
    const routeOf = new Map(
      Object.entries(CAC_ROUTE_FUNNELS).flatMap(([route, funnels]) =>
        funnels.map((funnel) => [funnel.toLowerCase(), route] as const),
      ),
    );
    const counts = new Map<string, number>(
      Object.keys(CAC_ROUTE_FUNNELS).map((route) => [route, 0]),
    );
    for (const deal of deals) {
      const route = routeOf.get(deal.funnel?.trim().toLowerCase() ?? "");
      if (route) counts.set(route, (counts.get(route) ?? 0) + 1);
    }
    return { counts, error: null };
  } catch (error) {
    console.error("CAC Close closes read failed", error);
    return {
      counts: null,
      error: error instanceof Error ? error.message : "Close read failed.",
    };
  }
}

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
  updated_at: string;
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
  /** Set when Close could not be read; closes then fall back to typed numbers. */
  readonly closeError: string | null;
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
    .not("spend", "is", null)
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
      closeError: null,
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
      closeError: null,
    };
  }

  const selected =
    months.find((m) => m.month === requested)?.month ?? months[0]!.month;
  const monthRow = rows.find((row) => row.month === selected)!;

  const [{ data: routeRows }, closes] = await Promise.all([
    client
      .from("cac_routes")
      .select(
        "id,group_label,route,owner,sort_order,fixed_monthly_cost,variable_spend,spend_channel,spend_source,closed_won,march_cac,notes,updated_at",
      )
      .eq("month", selected)
      .order("sort_order")
      .limit(200),
    closesByRoute(client, selected),
  ]);

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
      closedWonClose:
        closes.counts && row.route in CAC_ROUTE_FUNNELS
          ? (closes.counts.get(row.route) ?? 0)
          : null,
      marchCac: row.march_cac,
      notes: row.notes,
      updatedAt: row.updated_at,
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
    closeError: closes.error,
  };
}
