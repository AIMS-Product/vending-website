import Link from "next/link";
import {
  AdminStatusBadge,
  adminCardClass,
  adminEyebrowClass,
  adminLinkClass,
} from "@/components/admin/AdminUi";
import {
  CardMessage,
  dayLabel,
  failed,
  money,
  num,
} from "@/components/admin/dashboard/DashboardPanels";
import type { DashboardWindow } from "@/lib/analytics/dashboard-window";
import {
  buildScorecard,
  scorecardWeeks,
  type ScorecardWeek,
} from "@/lib/analytics/weekly-scorecard";
import {
  readCalls,
  readFacts,
  readQualifiedDays,
} from "@/lib/services/analytics-dashboard-data";

/*
 * The Leadership Scorecard's marketing rows, week by week, on the page that
 * holds their sources. Weeks run Monday to Sunday like the Q4'26 sheet; the
 * card ignores the dashboard window on purpose so the sheet can be filled
 * from it any day. Definitions: METRICS.md §16 "Scorecard".
 */

const compactCardClass = `${adminCardClass} min-w-0`;

const cents = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export async function ScorecardCard({ window }: { window: DashboardWindow }) {
  const weeks = scorecardWeeks(window.today);
  const from = weeks.at(-1)!.start;
  const to = weeks[0]!.end;
  const [calls, facts, qualified] = await Promise.all([
    readCalls(from, to),
    readFacts(from, window.today),
    readQualifiedDays(from),
  ]);
  const problem = failed(calls, facts, qualified);
  const rows =
    calls.ok && facts.ok && qualified.ok
      ? buildScorecard({
          today: window.today,
          calls: calls.data,
          facts: facts.data,
          qualifiedDays: qualified.data,
        }) // newest left: this week and last are the ones read
      : [];
  const gaps = gapSummary(rows);
  // The sheet takes the last finished week; the running one is "so far".
  const shown = rows.find((w) => w.complete) ?? rows[0];
  const prior = shown ? rows[rows.indexOf(shown) + 1] : undefined;

  if (problem) return <section className={compactCardClass}>{problem}</section>;
  if (!shown)
    return (
      <section className={compactCardClass}>
        <CardMessage tone="empty">No weeks to show yet.</CardMessage>
      </section>
    );
  const short = shown.missingSpend.length > 0;

  return (
    <section
      id="scorecard"
      aria-label="Leadership scorecard: marketing"
      className={compactCardClass}
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="min-w-0">
          <h2 className={adminEyebrowClass}>Leadership scorecard</h2>
          <p className="text-ui-text-muted mt-0.5 text-xs whitespace-nowrap">
            {dayLabel(shown.start)} – {dayLabel(shown.end)}
          </p>
        </div>
        <Stat
          label="Booked calls"
          value={num(shown.booked)}
          now={shown.booked}
          before={prior?.booked}
        />
        <Stat
          label="MQLs"
          value={num(shown.mqls)}
          now={shown.mqls}
          before={prior?.mqls}
        />
        <Stat
          label={short ? "Ad spend (incomplete)" : "Ad spend"}
          value={money(shown.spend)}
          now={shown.spend}
          before={prior?.spend}
        />
        <Stat
          label={short ? "Cost per MQL (incomplete)" : "Cost per MQL"}
          value={shown.costPerMql === null ? "–" : cents(shown.costPerMql)}
          now={shown.costPerMql}
          before={prior?.costPerMql}
        />
      </div>
      <details className="group mt-3">
        <summary className="text-ui-accent cursor-pointer text-xs font-medium underline-offset-2 hover:underline">
          All weeks{gaps ? " · spend gap" : ""}
        </summary>
        <div className="mt-3">
          {gaps ? (
            <p role="alert" className="text-ui-warn-ink mb-2 text-xs">
              {gaps}{" "}
              <Link className={adminLinkClass} href="/admin/data">
                Data health
              </Link>
            </p>
          ) : null}
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[40rem] border-collapse text-[0.8125rem] tabular-nums">
              <caption className="sr-only">
                Booked calls, MQLs, ad spend and cost per MQL by week
              </caption>
              <thead>
                <tr className="border-ui-line border-b">
                  <th
                    scope="col"
                    className="text-ui-text-muted bg-ui-surface sticky left-0 py-2 pr-4 text-left font-medium"
                  >
                    Metric
                  </th>
                  {rows.map((w) => (
                    <th
                      key={w.start}
                      scope="col"
                      className="text-ui-text-muted px-2 py-2 text-right font-medium whitespace-nowrap"
                    >
                      {dayLabel(w.start)} – {dayLabel(w.end)}
                      {w.complete ? null : (
                        <span className="text-ui-text-subtle block text-[0.6875rem] font-normal">
                          so far
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-ui-line divide-y">
                <Row
                  label="Total booked calls"
                  rows={rows}
                  value={(w) => num(w.booked)}
                  detail={(w) =>
                    `${num(w.bookedKept)} kept · ${num(w.bookedMarketing)} mktg`
                  }
                />
                <Row
                  label="MQLs"
                  rows={rows}
                  value={(w) => num(w.mqls)}
                  detail={(w) => `${num(w.qualified)} scored`}
                />
                <Row
                  label="Ad spend"
                  rows={rows}
                  value={(w) => money(w.spend)}
                  detail={(w) =>
                    w.spendByNetwork.map((n) => `${n.label} ${money(n.spend)}`)
                  }
                  incomplete={(w) => w.missingSpend.length > 0}
                />
                <Row
                  label="Cost per MQL"
                  rows={rows}
                  value={(w) =>
                    w.costPerMql === null ? "–" : cents(w.costPerMql)
                  }
                  incomplete={(w) =>
                    w.missingSpend.length > 0 && w.costPerMql !== null
                  }
                />
              </tbody>
            </table>
          </div>
          <Definitions />
        </div>
      </details>
    </section>
  );
}

/** One number with its change on the week before, quiet unless asked. */
function Stat({
  label,
  value,
  now,
  before,
}: {
  label: string;
  value: string;
  now: number | null;
  before: number | null | undefined;
}) {
  const change =
    now !== null && before ? Math.round(((now - before) / before) * 100) : null;
  return (
    <div className="min-w-0">
      <p className="text-ui-text text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="text-ui-text-muted text-xs whitespace-nowrap">
        {label}
        {change === null ? null : (
          <span className="text-ui-text-subtle tabular-nums">
            {" "}
            · {change > 0 ? "+" : ""}
            {change}% wk/wk
          </span>
        )}
      </p>
    </div>
  );
}

function Row({
  label,
  rows,
  value,
  detail,
  incomplete,
}: {
  label: string;
  rows: ScorecardWeek[];
  value: (w: ScorecardWeek) => string;
  /** One line, or one line per part (spend by network). */
  detail?: (w: ScorecardWeek) => string | string[];
  incomplete?: (w: ScorecardWeek) => boolean;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="text-ui-text bg-ui-surface sticky left-0 py-2.5 pr-4 text-left font-medium whitespace-nowrap"
      >
        {label}
      </th>
      {rows.map((w) => {
        const short = incomplete?.(w) ?? false;
        return (
          <td key={w.start} className="px-2 py-2.5 text-right align-top">
            <span className="text-ui-text font-semibold">{value(w)}</span>
            {short ? (
              <span className="mt-1 block">
                <AdminStatusBadge
                  status="incomplete"
                  label="Incomplete"
                  tone="warn"
                />
              </span>
            ) : null}
            {detail
              ? [detail(w)].flat().map((line) => (
                  <span
                    key={line}
                    className="text-ui-text-subtle mt-0.5 block text-[0.6875rem] whitespace-nowrap"
                  >
                    {line}
                  </span>
                ))
              : null}
          </td>
        );
      })}
    </tr>
  );
}

function Definitions() {
  const items: Array<[string, string]> = [
    [
      "Total booked calls",
      "Close first sales calls dated in the week (the day the call is scheduled for), every one, as the sheet's Total counts them. Kept = after cancelled-by-lead, outside-the-US and quiz-funnel calls are removed (§3); mktg = kept, without Lane 2 reactivation.",
    ],
    [
      "MQLs",
      "Every new marketing lead captured: site form leads plus webinar registrations, off-site form fills and ManyChat contacts (§4, UTC days). Scored = site form fills the qualification quiz sent to a call (top closers, Lane 1, setting).",
    ],
    [
      "Ad spend",
      "Google Ads cost from Google Analytics (the property's Google Ads link) and Meta spend from Metricool, webinar campaigns included. Incomplete = a network that spent in these weeks has days with nothing recorded.",
    ],
    ["Cost per MQL", "Ad spend divided by MQLs for the same week."],
  ];
  return (
    <dl className="border-ui-line mt-4 grid gap-x-6 gap-y-2 border-t pt-3 text-xs sm:grid-cols-2">
      {items.map(([term, text]) => (
        <div key={term}>
          <dt className={adminEyebrowClass}>{term}</dt>
          <dd className="text-ui-text-muted mt-0.5">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One sentence naming every network with missing days, or null. */
function gapSummary(rows: readonly ScorecardWeek[]): string | null {
  const days = new Map<string, number>();
  for (const w of rows)
    for (const m of w.missingSpend)
      days.set(m.label, (days.get(m.label) ?? 0) + m.days);
  if (days.size === 0) return null;
  return `${[...days]
    .map(([label, n]) => `${label} has ${num(n)} day${n === 1 ? "" : "s"}`)
    .join(" and ")} with no spend recorded, so those weeks read low.`;
}
