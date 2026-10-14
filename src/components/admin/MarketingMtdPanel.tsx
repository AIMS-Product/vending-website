import {
  AdminDeltaChip,
  AdminMetricPanel,
  AdminMetricStrip,
  adminLinkClass,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import { MarketingGoalPanel } from "@/components/admin/MarketingGoalPanel";
import {
  changeText,
  days,
  pct,
  rangeLabel,
  TD,
  TH,
} from "@/components/admin/marketing-mtd-format";
import { formatUsd as money } from "@/lib/admin/format-number";
import { formatPacificStampShort } from "@/lib/admin/format-time";
import type { MarketingMtdReport } from "@/lib/services/marketing-mtd-data";
import {
  countChange,
  median,
  rate,
  rateChange,
  type Change,
  type MarketingFigures,
} from "@/lib/services/marketing-mtd";

/**
 * Jess's marketing MTD view: every marketing channel except Reactivation
 * Scrapers, this month so far against the same dates last month, and the
 * 125-a-week booking goal. Rules: `marketing-mtd.ts`.
 */

const STICKY_BASE = "sticky left-0 z-10 px-4 text-left whitespace-nowrap";
const STICKY = `${STICKY_BASE} bg-ui-surface py-2 align-top`;

/** Up is good, except for days to win, where fewer is better. */
function ChangeChip({
  change,
  lowerIsBetter = false,
}: {
  change: Change;
  lowerIsBetter?: boolean;
}) {
  const value =
    change.kind === "pct" || change.kind === "pp" ? change.value : 0;
  const better = lowerIsBetter ? value < 0 : value > 0;
  const tone =
    change.kind === "new"
      ? "up"
      : value === 0
        ? "neutral"
        : better
          ? "up"
          : "down";
  return <AdminDeltaChip tone={tone}>{changeText(change)}</AdminDeltaChip>;
}

type Metric = {
  label: string;
  value: (f: MarketingFigures) => number | null;
  format: (value: number | null, f: MarketingFigures) => string;
  kind: "count" | "rate";
  lowerIsBetter?: boolean;
  /** The counts behind a rate, shown under the big number rather than in it. */
  detail?: (f: MarketingFigures) => string;
};

const showRate = (f: MarketingFigures) => rate(f.shown, f.booked);
const qualifiedRate = (f: MarketingFigures) => rate(f.qualified, f.shown);
const wonPerBooked = (f: MarketingFigures) => rate(f.won, f.booked);
const cycle = (f: MarketingFigures) => median(f.cycleDays);

const KPIS: Metric[] = [
  {
    label: "Booked calls",
    value: (f) => f.booked,
    format: (v) => String(v ?? 0),
    kind: "count",
  },
  {
    label: "Show rate",
    value: showRate,
    format: (v) => pct(v),
    detail: (f) => `${f.shown}/${f.booked}`,
    kind: "rate",
  },
  {
    label: "Qualified among shown",
    value: qualifiedRate,
    format: (v) => pct(v),
    detail: (f) => `${f.qualified}/${f.shown}`,
    kind: "rate",
  },
  {
    label: "Closed won",
    value: (f) => f.won,
    format: (v) => String(v ?? 0),
    kind: "count",
  },
  {
    label: "Median lead to win",
    value: cycle,
    format: (v) => days(v),
    detail: (f) => `n=${f.cycleDays.length}`,
    kind: "count",
    lowerIsBetter: true,
  },
  {
    label: "Closed won value",
    value: (f) => f.revenue,
    format: (v) => money(v ?? 0),
    kind: "count",
  },
];

/** "76/123 · Sep 1–14: 61.7% (95/154)": the fraction stays out of the big number. */
function kpiCaption(
  metric: Metric,
  now: MarketingFigures,
  then: MarketingFigures,
  priorLabel: string,
): string {
  const prior = `${priorLabel}: ${metric.format(metric.value(then), then)}`;
  return metric.detail
    ? `${metric.detail(now)} \u00b7 ${prior} (${metric.detail(then)})`
    : prior;
}

const changeOf = (
  metric: Metric,
  now: MarketingFigures,
  then: MarketingFigures,
) =>
  metric.kind === "rate"
    ? rateChange(metric.value(now), metric.value(then))
    : countChange(metric.value(now), metric.value(then));

const COLUMNS: Metric[] = [
  {
    label: "Booked",
    value: (f) => f.booked,
    format: (v) => String(v ?? 0),
    kind: "count",
  },
  { label: "Show rate", value: showRate, format: (v) => pct(v), kind: "rate" },
  {
    label: "Qualified rate",
    value: qualifiedRate,
    format: (v) => pct(v),
    kind: "rate",
  },
  {
    label: "Closed won",
    value: (f) => f.won,
    format: (v) => String(v ?? 0),
    kind: "count",
  },
  {
    label: "Won / booked",
    value: wonPerBooked,
    format: (v) => pct(v),
    kind: "rate",
  },
  {
    label: "Lead to win",
    value: cycle,
    format: (v) => days(v),
    kind: "count",
    lowerIsBetter: true,
  },
  {
    label: "Won value",
    value: (f) => f.revenue,
    format: (v) => money(v ?? 0),
    kind: "count",
  },
];

function Cells({
  now,
  then,
}: {
  now: MarketingFigures;
  then: MarketingFigures;
}) {
  return COLUMNS.map((metric) => (
    <td key={metric.label} className={TD}>
      <span className="text-ui-text block">
        {metric.format(metric.value(now), now)}
      </span>
      <span className="text-ui-text-subtle mt-0.5 flex items-center justify-end gap-1 text-xs">
        {metric.format(metric.value(then), then)}
        <ChangeChip
          change={changeOf(metric, now, then)}
          lowerIsBetter={metric.lowerIsBetter}
        />
      </span>
    </td>
  ));
}

export function MarketingMtdPanel({ report }: { report: MarketingMtdReport }) {
  if (!report.ok) {
    return (
      <section className={adminPanelClass}>
        <p className="text-ui-bad text-sm">
          The marketing month to date could not be read, so it is not shown:{" "}
          {report.error}
        </p>
      </section>
    );
  }
  const { mtd, goal } = report;
  const now = mtd.total.current;
  const then = mtd.total.prior;
  const conflicts = mtd.rows.flatMap((row) =>
    row.current.conflicts.map((lead) => ({ ...lead, channel: row.label })),
  );

  return (
    <div className="space-y-5">
      <p className="text-ui-text-muted text-sm">
        {rangeLabel(mtd.current)} against {rangeLabel(mtd.prior)}, Pacific days.
        Bookings and flags from our copy of Close as of{" "}
        {report.bookingsAsOf
          ? formatPacificStampShort(report.bookingsAsOf)
          : "unknown"}
        ; won deals read from Close within five minutes of{" "}
        {formatPacificStampShort(report.winsAsOf)}.
      </p>

      <AdminMetricStrip columns={6}>
        {KPIS.map((metric) => (
          <AdminMetricPanel
            key={metric.label}
            label={metric.label}
            value={metric.format(metric.value(now), now)}
            delta={
              <ChangeChip
                change={changeOf(metric, now, then)}
                lowerIsBetter={metric.lowerIsBetter}
              />
            }
            caption={kpiCaption(metric, now, then, rangeLabel(mtd.prior))}
          />
        ))}
      </AdminMetricStrip>

      <MarketingGoalPanel goal={goal} booked={now.booked} />

      <section className={adminPanelClass} aria-label="Marketing channels">
        <div className="px-4 pt-4">
          <h2 className={adminSectionTitleClass}>By channel</h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            This month on top; {rangeLabel(mtd.prior)} and the change beneath.
            Every channel except Reactivation Scrapers, including any that
            booked only last month.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-ui-canvas text-ui-text-muted text-xs">
              <tr>
                <th
                  scope="col"
                  className={`${STICKY_BASE} bg-ui-canvas py-2.5 font-semibold`}
                >
                  Channel
                </th>
                {COLUMNS.map((metric) => (
                  <th key={metric.label} scope="col" className={TH}>
                    {metric.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mtd.rows.map((row) => (
                <tr key={row.label} className="border-ui-line/60 border-t">
                  <th scope="row" className={`${STICKY} font-medium`}>
                    <span className="inline-flex items-center gap-1.5">
                      <ChannelLogo label={row.label} />
                      {row.label}
                    </span>
                  </th>
                  <Cells now={row.current} then={row.prior} />
                </tr>
              ))}
              <tr className="border-ui-line-strong border-t-2 font-semibold">
                <th scope="row" className={STICKY}>
                  Marketing total
                </th>
                <Cells now={now} then={then} />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        className={`${adminPanelClass} space-y-3 px-4 py-4 text-sm`}
        aria-label="How to read this"
      >
        <h2 className={adminSectionTitleClass}>How to read this</h2>
        <ul className="text-ui-text-muted list-disc space-y-1.5 pl-5">
          <li>
            Closed won counts deals won in the dates, whenever the call was
            booked: {now.won} won this month is not a subset of the {now.booked}{" "}
            booked. Won / booked is a period ratio, not a close rate.
          </li>
          <li>
            {rangeLabel(mtd.prior)} is rebuilt from Close as it stands today,
            not what a report showed on that day; today is still booking.
          </li>
          <li>
            Qualified rate counts calls logged both shown and qualified.{" "}
            {conflicts.length === 0
              ? "No booked call this month is marked qualified without a logged show."
              : `${conflicts.length} booked ${conflicts.length === 1 ? "call is" : "calls are"} marked qualified with no logged show, so ${conflicts.length === 1 ? "it is" : "they are"} left out of the rate. Close is not changed:`}
          </li>
        </ul>
        {conflicts.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 pl-5 text-xs">
            {conflicts.map((lead) => (
              <li key={lead.leadId}>
                <a
                  href={`https://app.close.com/lead/${lead.leadId}/`}
                  target="_blank"
                  rel="noreferrer"
                  className={adminLinkClass}
                >
                  {lead.name ?? "Unnamed lead"}
                </a>{" "}
                <span className="text-ui-text-subtle">({lead.channel})</span>
              </li>
            ))}
          </ul>
        )}
        <details className="text-ui-text-muted">
          <summary className="text-ui-text cursor-pointer font-medium">
            Definitions
          </summary>
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="text-ui-text font-medium">Booked calls</dt>
              <dd>
                Close leads whose First Sales Call Booked Date is in the dates,
                one per lead, by the lead&apos;s Funnel Name. Left out: leads
                now Canceled (by Lead) or Outside the US, The Land Geek and
                Publishing Profits Academy, Reactivation Scrapers, and leads
                whose owner is not on the MTD dashboard&apos;s Lane 1 roster. A
                blank funnel is Unknown (Needs Review) and still counts. This is
                not Dom&apos;s meeting-level rule (Booked calls V2 on Month over
                month), so the two totals differ by design.
              </dd>
            </div>
            <div>
              <dt className="text-ui-text font-medium">Show rate</dt>
              <dd>
                Booked calls a rep logged First Call Show Up = yes, over booked.
                Calls still ahead stay in the denominator; an unlogged show is
                not a no-show.
              </dd>
            </div>
            <div>
              <dt className="text-ui-text font-medium">Closed won and value</dt>
              <dd>
                Close opportunities won in the dates, same lead rules (no owner
                roster), leaving out deals owned by Ahmad B., Stephen O.,
                Spencer R., Mallory K. and Adam W. Value is the deal value in
                Close, not cash collected.
                {now.unvalued > 0 &&
                  ` ${now.unvalued} won this month carry no value.`}
              </dd>
            </div>
            <div>
              <dt className="text-ui-text font-medium">Lead to win</dt>
              <dd>
                Days from the lead being created in Close to the deal being won,
                Pacific days. The total is the median of every deal, not of
                channel medians; n is how many deals had both dates.
              </dd>
            </div>
          </dl>
        </details>
      </section>
    </div>
  );
}
