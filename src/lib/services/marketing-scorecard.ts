/**
 * The Q4 Leadership Scorecard's marketing rows on Jess's field rule (the
 * dashboard's `keptCalls`, one per lead by first-call booked date), and
 * the webinar summary, for the Marketing MTD page. Pure and client-safe.
 *
 * Weeks are Monday to Friday, as the Q4 sheet counts them: a call booked on a
 * Saturday or Sunday is in no week, and its own row says how many there were.
 * Spend is summed over the same five days, so cost per booked divides like
 * for like.
 */

import { isReactivation, keptCalls } from "@/lib/analytics/dashboard-metrics";
import type { CloseCall } from "@/lib/services/close-week-view";
import {
  channelLabel,
  spendChannel,
  type Range,
  type SpendFact,
} from "@/lib/services/marketing-mtd";

/** Monday of Q4'26 week 1 (the sheet's W1 is Sep 28 - Oct 2). */
export const SCORECARD_FROM = "2026-09-28";
// ponytail: one quarter hard-coded; move to the next quarter's Monday in January.

export const WEBINAR_SOURCE = "Internal Webinar";

export type ScorecardRow = {
  label: string;
  kind: "count" | "money";
  /** One value per week; null where the week has nothing to divide. */
  values: (number | null)[];
  /** Indented under the row above. */
  child?: boolean;
  /** A track row: watched, not one of the sheet's rows. */
  track?: boolean;
};

export type Scorecard = { weeks: Range[]; rows: ScorecardRow[] };

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/** Mon-Fri weeks from `from` through the week holding `today`, newest last. */
export function scorecardWeeks(from: string, today: string): Range[] {
  const weeks: Range[] = [];
  for (let monday = from; monday <= today; monday = addDays(monday, 7)) {
    const friday = addDays(monday, 4);
    weeks.push({ from: monday, to: friday < today ? friday : today });
  }
  return weeks;
}

export function buildScorecard(input: {
  calls: readonly CloseCall[];
  spend: readonly SpendFact[];
  today: string;
  from?: string;
}): Scorecard {
  const weeks = scorecardWeeks(input.from ?? SCORECARD_FROM, input.today);
  const weekOf = (day: string | null | undefined) =>
    day ? weeks.findIndex((w) => day >= w.from && day <= w.to) : -1;
  const zeros = () => weeks.map(() => 0);

  const total = zeros();
  const marketing = zeros();
  const scrapers = zeros();
  const weekend = zeros();
  const byChannel = new Map<string, number[]>();
  for (const call of keptCalls(input.calls)) {
    const day = call.bookedDate.slice(0, 10);
    const wk = [0, 6].includes(weekday(day))
      ? weekOf(addDays(day, weekday(day) === 0 ? -6 : -5))
      : weekOf(day);
    if (wk < 0) continue;
    if ([0, 6].includes(weekday(day))) {
      weekend[wk]! += 1;
      continue;
    }
    total[wk]! += 1;
    if (isReactivation(call)) scrapers[wk]! += 1;
    else {
      marketing[wk]! += 1;
      const label = channelLabel(call.funnel);
      const row = byChannel.get(label) ?? zeros();
      row[wk]! += 1;
      byChannel.set(label, row);
    }
  }

  const spend = zeros();
  for (const fact of input.spend) {
    const wk = weekOf(fact.day.slice(0, 10));
    if (wk >= 0 && fact.spend) spend[wk]! += fact.spend;
  }

  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const channels = [...byChannel.entries()]
    .sort((a, b) => sum(b[1]) - sum(a[1]) || a[0].localeCompare(b[0]))
    .map(([label, values]) => ({
      label,
      kind: "count" as const,
      values,
      child: true,
    }));

  return {
    weeks,
    rows: [
      { label: "Booked calls", kind: "count", values: total },
      { label: "Marketing booked", kind: "count", values: marketing },
      ...channels,
      {
        label: "Reactivation Scrapers booked",
        kind: "count",
        values: scrapers,
      },
      {
        label: "Booked Sat-Sun (in no week)",
        kind: "count",
        values: weekend,
        track: true,
      },
      { label: "Ad spend", kind: "money", values: spend.map(Math.round) },
      {
        label: "Cost per marketing booked",
        kind: "money",
        values: spend.map((s, i) =>
          marketing[i]! > 0 ? Math.round(s / marketing[i]!) : null,
        ),
      },
    ],
  };
}

// --- Webinars ----------------------------------------------------------------

export type WebinarEvent = {
  date: string;
  label: string;
  registrations: number | null;
  attendees: number | null;
  booked_calls: number | null;
  won: number | null;
  revenue: number | null;
  spend: number | null;
};

export type WebinarTotals = {
  events: number;
  registrations: number;
  attendees: number;
  /** The webinar board's own booked count for the room (its link, not Dom's rule). */
  roomBooked: number;
  won: number;
  revenue: number;
  spend: number;
};

export function webinarTotals(
  events: readonly WebinarEvent[],
  range: Range,
): WebinarTotals {
  return events
    .filter((e) => e.date >= range.from && e.date <= range.to)
    .reduce<WebinarTotals>(
      (t, e) => ({
        events: t.events + 1,
        registrations: t.registrations + (e.registrations ?? 0),
        attendees: t.attendees + (e.attendees ?? 0),
        roomBooked: t.roomBooked + (e.booked_calls ?? 0),
        won: t.won + (e.won ?? 0),
        revenue: t.revenue + (e.revenue ?? 0),
        spend: t.spend + (e.spend ?? 0),
      }),
      {
        events: 0,
        registrations: 0,
        attendees: 0,
        roomBooked: 0,
        won: 0,
        revenue: 0,
        spend: 0,
      },
    );
}

// --- CSV ---------------------------------------------------------------------

const cell = (value: string | number | null) => {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (
  rows: ReadonlyArray<ReadonlyArray<string | number | null>>,
) => rows.map((row) => row.map(cell).join(",")).join("\n");

export function scorecardCsv(card: Scorecard): string {
  return toCsv([
    ["Row", ...card.weeks.map((w) => `${w.from} to ${w.to}`)],
    ...card.rows.map((row) => [row.label, ...row.values]),
  ]);
}

/** Re-exported so the page needs one import for spend routing. */
export { spendChannel };
