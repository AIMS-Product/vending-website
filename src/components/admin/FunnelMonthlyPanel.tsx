import { Fragment } from "react";
import Link from "next/link";
import { adminCardClass, adminEyebrowClass } from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import type {
  FunnelGrouping,
  FunnelMonthlyReport,
  FunnelPeriod,
  FunnelPeriodRow,
} from "@/lib/services/funnel-monthly";
import type { AdminAnalyticsRangeKey } from "@/lib/services/admin-analytics-range";

/**
 * The Funnels tab: one row per source (or per page), months running across,
 * so a trend is read along a line rather than by scrolling between tables.
 *
 * Green and red mark the change against the month to the left — a direction,
 * never a benchmark. There is no honest fixed threshold for a good conversion
 * rate, and colouring against an invented one would make every row lie in the
 * same direction.
 */

type MetricKey =
  | "leads"
  | "visits"
  | "optIn"
  | "questions"
  | "booked"
  | "book"
  | "show"
  | "won"
  | "revenue";

type Metric = {
  key: MetricKey;
  label: string;
  /** The number in the cell. */
  value: (row: FunnelPeriodRow) => number | null;
  /** How many observations the value rests on; a thin cell is not coloured. */
  weight: (row: FunnelPeriodRow) => number;
  format: (value: number) => string;
  /** False where a fall is the good direction. Nothing here is yet. */
  higherIsBetter: boolean;
};

const METRICS: Metric[] = [
  {
    key: "leads",
    label: "Leads",
    value: (row) => row.leads,
    weight: (row) => row.leads,
    format: count,
    higherIsBetter: true,
  },
  {
    key: "visits",
    label: "Visits",
    value: (row) => row.visits,
    weight: (row) => row.visits ?? 0,
    format: count,
    higherIsBetter: true,
  },
  {
    key: "optIn",
    label: "Opt-in %",
    value: (row) => row.rates.visitToLead,
    weight: (row) => row.visits ?? 0,
    format: percent,
    higherIsBetter: true,
  },
  {
    key: "questions",
    label: "Qs done %",
    value: (row) => row.rates.questionsCompleted,
    weight: (row) => row.questionsOffered,
    format: percent,
    higherIsBetter: true,
  },
  {
    key: "booked",
    label: "Booked",
    value: (row) => row.booked,
    weight: (row) => row.booked,
    format: count,
    higherIsBetter: true,
  },
  {
    key: "book",
    label: "Book %",
    value: (row) => row.rates.leadToBook,
    weight: (row) => row.leads,
    format: percent,
    higherIsBetter: true,
  },
  {
    key: "show",
    label: "Show %",
    value: (row) => row.rates.bookToShow,
    weight: (row) => row.showable,
    format: percent,
    higherIsBetter: true,
  },
  {
    key: "won",
    label: "Won",
    value: (row) => row.won,
    weight: (row) => row.booked,
    format: count,
    higherIsBetter: true,
  },
  {
    key: "revenue",
    label: "Revenue",
    value: (row) => row.revenue,
    weight: (row) => row.won,
    format: (value) => `$${Math.round(value).toLocaleString("en-US")}`,
    higherIsBetter: true,
  },
];

/**
 * Below this many observations a month-on-month move is noise. Two leads
 * becoming three is a 50% jump and means nothing; colouring it trains people
 * to ignore the colour everywhere else.
 */
const MIN_WEIGHT = 8;
/** Moves smaller than this are flat. Rates wobble a point either way. */
const FLAT_BAND = 5;
/** Rows below this many leads across every month fold into one tail row. */
const TAIL_LEADS = 3;

/**
 * The selected metrics, in the fixed funnel order above.
 *
 * Absent means all of them: the tab's job is to show the whole funnel at once,
 * and a metric is hidden only because someone hid it. An unrecognised or empty
 * selection also falls back to all rather than to an arbitrary single metric —
 * a stale bookmark should show too much, never too little.
 */
export function parseFunnelMetrics(
  value: string | null | undefined,
): MetricKey[] {
  const wanted = new Set(
    value
      ?.split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  const picked = METRICS.filter((metric) => wanted.has(metric.key)).map(
    (metric) => metric.key,
  );
  return picked.length > 0 ? picked : METRICS.map((metric) => metric.key);
}

export function parseFunnelGrouping(
  value: string | null | undefined,
): FunnelGrouping {
  return value?.trim() === "channel" ? "channel" : "page";
}

export function FunnelMonthlyTab({
  data,
  range,
  includeInternal,
  metrics: metricKeys,
}: {
  data: FunnelMonthlyReport;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
  metrics: MetricKey[];
}) {
  const selected = METRICS.filter((entry) => metricKeys.includes(entry.key));
  const metrics = selected.length > 0 ? selected : METRICS;
  // The sparkline needs one number per month, so it only has a column to live
  // in while a single metric is showing.
  const trend = metrics.length === 1 ? metrics[0]! : null;
  if (data.months.length === 0) {
    return (
      <div className={adminCardClass}>
        <p className="text-ui-text-muted text-sm">
          No leads have been captured yet, so there is no funnel to report.
        </p>
      </div>
    );
  }

  // Oldest first: a trend read left to right is a trend forward in time.
  const months = [...data.months].reverse();
  const rowKeys = orderedRowKeys(months);
  const tailKeys = new Set(
    rowKeys.filter(
      (key) =>
        months.every((month) => (find(month, key)?.leads ?? 0) < TAIL_LEADS) &&
        key !== null,
    ),
  );
  const mainKeys = rowKeys.filter((key) => !tailKeys.has(key));
  // Months whose visit denominator starts later than the month does, so the
  // number carries its own caveat instead of quietly reading low.
  const clipped = months.filter((month) => month.visitsStart !== null);

  return (
    <div className="space-y-5">
      <Controls
        data={data}
        range={range}
        includeInternal={includeInternal}
        metrics={metrics}
      />

      <section
        className={adminCardClass}
        aria-label={`The funnel by month, by ${
          data.grouping === "channel" ? "source" : "page"
        }`}
      >
        <h2 className={adminEyebrowClass}>
          {metrics.length === METRICS.length
            ? "The funnel"
            : metrics.map((entry) => entry.label).join(" · ")}{" "}
          by {data.grouping === "channel" ? "source" : "page"}, by month
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Green and red are the change against the month to the left, not a
          target. A move is left uncoloured when it rests on fewer than{" "}
          {MIN_WEIGHT} observations or is smaller than {FLAT_BAND}%, because
          below that the arithmetic moves more than the funnel does.
          {data.grouping === "channel"
            ? " Open a source for every page and link under it."
            : " Open a page for the sources that sent it."}
        </p>
        {clipped.length > 0 ? (
          <p className="text-ui-text-subtle mt-1 text-xs">
            {clipped
              .map(
                (month) =>
                  `${month.label} counts visits from ${month.visitsStart}`,
              )
              .join("; ")}
            , where this site started capturing leads. Before that GA4 was
            recording and we were not, so the whole month&rsquo;s sessions
            against a few days&rsquo; leads would understate opt-in several
            times over.
          </p>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-[0.8125rem]">
            <thead>
              <tr className={`text-left ${adminEyebrowClass}`}>
                <th
                  rowSpan={2}
                  className="bg-ui-surface border-ui-line sticky left-0 z-10 border-r py-2 pr-4 pl-0 align-bottom font-semibold"
                >
                  {data.grouping === "channel" ? "Source" : "Page"}
                </th>
                {months.map((month) => (
                  <th
                    key={month.key}
                    colSpan={metrics.length}
                    className="border-ui-line border-b py-2 pr-3 text-right font-semibold whitespace-nowrap"
                  >
                    {month.label}
                  </th>
                ))}
                {trend ? (
                  <th
                    rowSpan={2}
                    className="py-2 text-right align-bottom font-semibold whitespace-nowrap"
                  >
                    Trend
                  </th>
                ) : null}
              </tr>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                {months.map((month) =>
                  metrics.map((entry) => (
                    <th
                      key={`${month.key}:${entry.key}`}
                      scope="col"
                      className="text-ui-text-subtle py-1.5 pr-3 text-right font-normal whitespace-nowrap"
                    >
                      {entry.label}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {mainKeys.map((key) => (
                <PivotRow
                  key={key ?? "(none)"}
                  rowKey={key}
                  months={months}
                  metrics={metrics}
                  trend={trend}
                  grouping={data.grouping}
                />
              ))}
              <tr className="font-medium">
                <td className="bg-ui-surface border-ui-line sticky left-0 z-10 border-r py-2.5 pr-4 pl-0">
                  All {data.grouping === "channel" ? "sources" : "pages"}
                </td>
                {months.map((month, index) =>
                  metrics.map((entry) => (
                    <Cell
                      key={`${month.key}:${entry.key}`}
                      row={month.totals}
                      previous={index > 0 ? months[index - 1]!.totals : null}
                      metric={entry}
                    />
                  )),
                )}
                {trend ? <td /> : null}
              </tr>
            </tbody>
          </table>
        </div>
        {tailKeys.size > 0 ? (
          <p className="text-ui-text-subtle mt-2 text-xs">
            {tailKeys.size} more{" "}
            {data.grouping === "channel" ? "sources" : "pages"} are hidden: they
            never reached {TAIL_LEADS} leads in any month, so their rates move
            entirely on single events.
          </p>
        ) : null}
      </section>

      {data.beforeAfter ? <BeforeAfter data={data} metrics={metrics} /> : null}
      <Caveats data={data} />
    </div>
  );
}

function Controls({
  data,
  range,
  includeInternal,
  metrics,
}: {
  data: FunnelMonthlyReport;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
  metrics: Metric[];
}) {
  const showing = new Set(metrics.map((entry) => entry.key));
  const href = (next: { metrics?: MetricKey[]; group?: FunnelGrouping }) => {
    const params = new URLSearchParams({ range, tab: "funnels" });
    const keys = next.metrics ?? [...showing];
    // All selected is the default, so it is left off the URL and a shared link
    // stays short.
    if (keys.length > 0 && keys.length < METRICS.length) {
      params.set("metric", keys.join(","));
    }
    params.set("group", next.group ?? data.grouping);
    if (includeInternal) params.set("internal", "1");
    return `?${params.toString()}`;
  };

  /**
   * Clicking a metric adds or drops it, keeping the funnel order. The last one
   * showing is not a toggle: an empty table would read as "no data" rather than
   * as "you hid everything".
   */
  const toggled = (key: MetricKey): MetricKey[] => {
    if (!showing.has(key)) {
      return METRICS.filter(
        (entry) => showing.has(entry.key) || entry.key === key,
      ).map((entry) => entry.key);
    }
    if (showing.size === 1) return [key];
    return METRICS.filter(
      (entry) => showing.has(entry.key) && entry.key !== key,
    ).map((entry) => entry.key);
  };

  const allShowing = showing.size === METRICS.length;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <span className={`${adminEyebrowClass} mr-1`}>Rows</span>
        {(["channel", "page"] as const).map((group) => (
          <Pill
            key={group}
            href={href({ group })}
            active={data.grouping === group}
          >
            {group === "channel" ? "By source" : "By page"}
          </Pill>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className={`${adminEyebrowClass} mr-1`}>Metrics</span>
        {METRICS.map((entry) => (
          <Pill
            key={entry.key}
            href={href({ metrics: toggled(entry.key) })}
            active={showing.has(entry.key)}
            pressed
          >
            {entry.label}
          </Pill>
        ))}
        <Pill
          href={href({ metrics: METRICS.map((entry) => entry.key) })}
          active={allShowing}
          muted
        >
          {allShowing ? "All showing" : "Show all"}
        </Pill>
      </div>
    </div>
  );
}

function Pill({
  href,
  active,
  pressed,
  muted,
  children,
}: {
  href: string;
  active: boolean;
  /** A toggle rather than a choice: it reports pressed state, not current page. */
  pressed?: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-pressed={pressed ? active : undefined}
      aria-current={!pressed && active ? "true" : undefined}
      className={`rounded border px-2 py-1 text-xs transition ${
        active
          ? muted
            ? "border-ui-line text-ui-text-subtle"
            : "border-ui-accent bg-ui-accent-soft text-ui-text font-medium"
          : "border-ui-line text-ui-text-subtle hover:text-ui-text"
      }`}
    >
      {children}
    </Link>
  );
}

function PivotRow({
  rowKey,
  months,
  metrics,
  trend,
  grouping,
}: {
  rowKey: string;
  months: FunnelPeriod[];
  metrics: Metric[];
  trend: Metric | null;
  grouping: FunnelGrouping;
}) {
  const rows = months.map((month) => find(month, rowKey));
  const childKeys = orderedChildKeys(rows);
  // Grouped by source, this row IS a channel and gets its mark; grouped by
  // page it is a URL, and the channels are the children below.
  const logo = grouping === "channel";

  return (
    <>
      <tr>
        <td className="bg-ui-surface border-ui-line sticky left-0 z-10 min-w-[14rem] border-r py-2.5 pr-4 pl-0 align-middle">
          {childKeys.length > 0 ? (
            // Native disclosure: no client component, no hydration, and it
            // keeps working with JavaScript off.
            <details>
              <summary className="text-ui-text hover:text-ui-accent cursor-pointer list-none font-medium">
                <span className="text-ui-text-subtle mr-1 text-xs">▸</span>
                <span className="inline-flex items-center gap-2 align-middle">
                  {logo ? <ChannelLogo label={rowKey} /> : null}
                  {rowKey}
                </span>
              </summary>
              <ul className="text-ui-text-subtle mt-1 ml-4 space-y-0.5 text-xs">
                {childKeys.map((child) => (
                  <li key={child} className="whitespace-nowrap">
                    {child}
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <span className="text-ui-text inline-flex items-center gap-2 font-medium">
              {logo ? <ChannelLogo label={rowKey} /> : null}
              {rowKey}
            </span>
          )}
        </td>
        {months.map((month, index) =>
          metrics.map((entry) => (
            <Cell
              key={`${month.key}:${entry.key}`}
              row={rows[index] ?? null}
              previous={index > 0 ? (rows[index - 1] ?? null) : null}
              metric={entry}
            />
          )),
        )}
        {trend ? (
          <td className="py-2.5 text-right align-middle">
            <Sparkline rows={rows} metric={trend} />
          </td>
        ) : null}
      </tr>
      {childKeys.length > 0 ? (
        <ChildRows
          rowKey={rowKey}
          childKeys={childKeys}
          months={months}
          metrics={metrics}
          trend={trend}
          grouping={grouping}
        />
      ) : null}
    </>
  );
}

/**
 * The children of an open row, as their own rows.
 *
 * They are rendered inside a `<details>` in the first cell above rather than
 * here, because a table row cannot live inside a disclosure element without
 * breaking the column alignment that makes the whole table readable. So the
 * summary lists the names and these rows carry the numbers, always visible.
 * One list, two jobs — see the note in the panel header.
 */
function ChildRows({
  rowKey,
  childKeys,
  months,
  metrics,
  trend,
  grouping,
}: {
  rowKey: string;
  childKeys: string[];
  months: FunnelPeriod[];
  metrics: Metric[];
  trend: Metric | null;
  grouping: FunnelGrouping;
}) {
  // The mirror of the parent row: grouped by page, the children are channels.
  const logo = grouping === "page";
  return (
    <>
      {childKeys.map((child) => {
        const rows = months.map(
          (month) =>
            find(month, rowKey)?.children?.find(
              (candidate) => candidate.funnel === child,
            ) ?? null,
        );
        return (
          <tr key={`${rowKey}:${child}`} className="text-ui-text-subtle">
            <td className="bg-ui-surface border-ui-line sticky left-0 z-10 border-r py-1.5 pr-4 pl-4 text-xs">
              <span className="text-ui-text-subtle mr-1">└</span>
              <span className="inline-flex items-center gap-1.5 align-middle">
                {logo ? <ChannelLogo label={child} /> : null}
                {child}
              </span>
            </td>
            {months.map((month, index) =>
              metrics.map((entry) => (
                <Cell
                  key={`${month.key}:${entry.key}`}
                  row={rows[index] ?? null}
                  previous={index > 0 ? (rows[index - 1] ?? null) : null}
                  metric={entry}
                  small
                />
              )),
            )}
            {trend ? <td /> : null}
          </tr>
        );
      })}
    </>
  );
}

function Cell({
  row,
  previous,
  metric,
  small,
}: {
  row: FunnelPeriodRow | null;
  previous: FunnelPeriodRow | null;
  metric: Metric;
  small?: boolean;
}) {
  const value = row ? metric.value(row) : null;
  const before = previous ? metric.value(previous) : null;
  const tone = trendTone({
    value,
    before,
    weight: row ? metric.weight(row) : 0,
    weightBefore: previous ? metric.weight(previous) : 0,
    higherIsBetter: metric.higherIsBetter,
  });

  return (
    <td
      className={`pr-3 text-right align-middle whitespace-nowrap tabular-nums ${
        small ? "py-1.5 text-xs" : "py-2.5"
      } ${tone === "up" ? "text-ui-ok" : tone === "down" ? "text-ui-bad" : ""}`}
      title={
        tone === "flat" && value !== null && before !== null
          ? "Change too small, or resting on too few observations, to call"
          : undefined
      }
    >
      {value === null ? "—" : metric.format(value)}
    </td>
  );
}

/** A bar per month, so the shape is readable without reading nine numbers. */
function Sparkline({
  rows,
  metric,
}: {
  rows: Array<FunnelPeriodRow | null>;
  metric: Metric;
}) {
  const values = rows.map((row) => (row ? metric.value(row) : null));
  const peak = Math.max(...values.map((value) => value ?? 0), 0);
  if (peak <= 0) return null;
  return (
    <span className="inline-flex h-5 items-end gap-0.5" aria-hidden>
      {values.map((value, index) => (
        <span
          key={index}
          className="bg-ui-line inline-block w-1 rounded-sm"
          style={{
            height: `${Math.max(2, ((value ?? 0) / peak) * 20)}px`,
          }}
        />
      ))}
    </span>
  );
}

function trendTone(input: {
  value: number | null;
  before: number | null;
  weight: number;
  weightBefore: number;
  higherIsBetter: boolean;
}): "up" | "down" | "flat" {
  const { value, before } = input;
  if (value === null || before === null || before === 0) return "flat";
  if (input.weight < MIN_WEIGHT || input.weightBefore < MIN_WEIGHT) {
    return "flat";
  }
  const change = ((value - before) / before) * 100;
  if (Math.abs(change) < FLAT_BAND) return "flat";
  const better = change > 0 === input.higherIsBetter;
  return better ? "up" : "down";
}

function BeforeAfter({
  data,
  metrics,
}: {
  data: FunnelMonthlyReport;
  metrics: Metric[];
}) {
  const { before, after, changedOn } = data.beforeAfter!;
  const keys = orderedRowKeys([before, after]);

  return (
    <section
      className={adminCardClass}
      aria-label="Before and after the rebuild"
    >
      <h2 className={adminEyebrowClass}>Since the funnel rebuild</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        {after.label} against {before.label} — the same weekdays a week apart,
        because bookings are weekday-shaped. The rebuild shipped {changedOn}.
        Far too short a window to conclude anything; it is here so the starting
        point is on the record.
      </p>
      {after.visitsEnd && after.visitsEnd < after.end ? (
        <p className="text-ui-text-subtle mt-1 text-xs">
          Visit counts in the later window stop at {after.visitsEnd}, so it
          holds fewer days of traffic. Rates are unaffected — both sides of each
          division use the same days — but do not read the visit totals against
          each other.
        </p>
      ) : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-[0.8125rem]">
          <thead>
            <tr className={`text-left ${adminEyebrowClass}`}>
              <th rowSpan={2} className="py-2 pr-4 align-bottom font-semibold">
                {data.grouping === "channel" ? "Source" : "Page"}
              </th>
              {metrics.map((entry) => (
                <th
                  key={entry.key}
                  colSpan={2}
                  className="border-ui-line border-b py-2 pr-3 text-right font-semibold whitespace-nowrap"
                >
                  {entry.label}
                </th>
              ))}
            </tr>
            <tr
              className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
            >
              {metrics.map((entry) => (
                <Fragment key={entry.key}>
                  <th className="text-ui-text-subtle py-1.5 pr-3 text-right font-normal">
                    Before
                  </th>
                  <th className="text-ui-text-subtle py-1.5 pr-3 text-right font-normal">
                    After
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {keys.map((key) => (
              <tr key={key}>
                <td className="py-2 pr-4">{key}</td>
                {metrics.map((entry) => (
                  <Fragment key={entry.key}>
                    <Cell
                      row={find(before, key)}
                      previous={null}
                      metric={entry}
                    />
                    <Cell
                      row={find(after, key)}
                      previous={find(before, key)}
                      metric={entry}
                    />
                  </Fragment>
                ))}
              </tr>
            ))}
            <tr className="font-medium">
              <td className="py-2 pr-4">All</td>
              {metrics.map((entry) => (
                <Fragment key={entry.key}>
                  <Cell row={before.totals} previous={null} metric={entry} />
                  <Cell
                    row={after.totals}
                    previous={before.totals}
                    metric={entry}
                  />
                </Fragment>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Caveats({ data }: { data: FunnelMonthlyReport }) {
  return (
    <section className={adminCardClass} aria-label="How to read these">
      <h2 className={adminEyebrowClass}>Before you read these</h2>
      <ul className="text-ui-text-subtle mt-2 space-y-1.5 text-xs">
        <li>
          <strong className="text-ui-text">A dash is not a zero.</strong> It
          means nothing was observed, or the group is too young to judge.
        </li>
        <li>
          <strong className="text-ui-text">
            Opt-in stops at {data.visitsThrough ?? "—"}.
          </strong>{" "}
          GA4 reports a day late, so the visit rate is measured only over days
          it has finished counting — on both sides of the division.
        </li>
        <li>
          <strong className="text-ui-text">
            Grouped by source, visits cannot tell paid from organic.
          </strong>{" "}
          GA4 stores no medium on this table, so Google Ads traffic sits under
          Organic search and Meta ad traffic under Meta. Leads are split
          correctly because our own table keeps the medium. Read Opt-in % by
          page, not by source.
        </li>
        <li>
          <strong className="text-ui-text">
            Half-filled forms are counted after contact details, not before.
          </strong>{" "}
          The form writes a lead row at the first submit, so somebody who typed
          and left before that leaves no trace anywhere.
        </li>
        <li>
          <strong className="text-ui-text">Win % waits 30 days.</strong> The Won
          count does not — a sale is a fact the day it happens.
        </li>
        <li>
          <strong className="text-ui-text">
            Show rate covers {percent(data.showCoverage.pct ?? 0)} of booked
            calls
          </strong>{" "}
          ({data.showCoverage.known} of {data.showCoverage.total} old enough to
          judge carry a yes/no in Close). The rest leave the denominator rather
          than counting as no-shows.
        </li>
      </ul>
    </section>
  );
}

/** Row order is decided once, by total leads, so it does not jump per metric. */
function orderedRowKeys(months: FunnelPeriod[]): string[] {
  const totals = new Map<string, number>();
  for (const month of months) {
    for (const row of month.rows) {
      totals.set(row.funnel, (totals.get(row.funnel) ?? 0) + row.leads);
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
}

function orderedChildKeys(rows: Array<FunnelPeriodRow | null>): string[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    for (const child of row?.children ?? []) {
      totals.set(child.funnel, (totals.get(child.funnel) ?? 0) + child.leads);
    }
  }
  return [...totals.entries()]
    .filter(([, leads]) => leads > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key]) => key);
}

function find(period: FunnelPeriod, key: string): FunnelPeriodRow | null {
  return period.rows.find((row) => row.funnel === key) ?? null;
}

function count(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}
