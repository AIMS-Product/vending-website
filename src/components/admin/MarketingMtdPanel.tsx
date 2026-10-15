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
  UNKNOWN_CHANNEL,
  countChange,
  median,
  rate,
  rateChange,
  type Change,
  type MarketingFigures,
  type MarketingMtd,
} from "@/lib/services/marketing-mtd";
import { toCsv } from "@/lib/services/marketing-scorecard";

/**
 * The marketing month so far on Dom's booked-call rule, by lead source,
 * against the same dates last month, and the 125-a-week booking goal. Rules:
 * `marketing-mtd.ts`.
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

const showRate = (f: MarketingFigures) => rate(f.shown, f.booked - f.open);
const qualifiedRate = (f: MarketingFigures) => rate(f.qualified, f.shown);
const wonPerBooked = (f: MarketingFigures) => rate(f.won, f.booked);
const cycle = (f: MarketingFigures) => median(f.cycleDays);
const costPerBooked = (f: MarketingFigures) =>
  f.spend > 0 && f.booked > 0 ? f.spend / f.booked : null;
const moneyOrDash = (v: number | null) => (v === null ? "—" : money(v));

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
    detail: (f) => `${f.shown}/${f.booked - f.open}`,
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
    label: "Sales cycle (median)",
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

const count = (
  label: string,
  pick: (f: MarketingFigures) => number,
): Metric => ({
  label,
  value: pick,
  format: (v) => String(v ?? 0),
  kind: "count",
});

export const COLUMNS: Metric[] = [
  count("Booked", (f) => f.booked),
  count("Open calls", (f) => f.open),
  { label: "Show rate", value: showRate, format: (v) => pct(v), kind: "rate" },
  {
    label: "Qualified rate",
    value: qualifiedRate,
    format: (v) => pct(v),
    kind: "rate",
  },
  count("Closed won", (f) => f.won),
  {
    label: "Won / booked",
    value: wonPerBooked,
    format: (v) => pct(v),
    kind: "rate",
  },
  {
    label: "Sales cycle",
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
  {
    label: "Spend",
    value: (f) => (f.spend > 0 ? f.spend : null),
    format: moneyOrDash,
    kind: "count",
  },
  {
    label: "Cost per booked",
    value: costPerBooked,
    format: moneyOrDash,
    kind: "count",
    lowerIsBetter: true,
  },
  count("Lane 2 on marketing leads", (f) => f.lane2),
];

/** The channel table as CSV: this month, last month, per column. */
export function channelCsv(mtd: MarketingMtd): string {
  const raw = (metric: Metric, f: MarketingFigures) => {
    const v = metric.value(f);
    return v === null ? null : Math.round(v * 1000) / 1000;
  };
  const line = (
    label: string,
    now: MarketingFigures,
    then: MarketingFigures,
  ) => [label, ...COLUMNS.flatMap((m) => [raw(m, now), raw(m, then)])];
  return toCsv([
    [
      "Channel",
      ...COLUMNS.flatMap((m) => [
        `${m.label} ${rangeLabel(mtd.current)}`,
        `${m.label} ${rangeLabel(mtd.prior)}`,
      ]),
    ],
    ...mtd.rows.map((row) => line(row.label, row.current, row.prior)),
    line("Total", mtd.total.current, mtd.total.prior),
  ]);
}

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

export function MarketingMtdPanel({
  report,
}: {
  report: Extract<MarketingMtdReport, { ok: true }>;
}) {
  const { mtd, goal } = report;
  const now = mtd.total.current;
  const then = mtd.total.prior;
  const conflicts = mtd.rows.flatMap((row) =>
    row.current.conflicts.map((lead) => ({ ...lead, channel: row.label })),
  );
  const domTotal = now.booked + now.lane2 + mtd.socialDms.current;

  return (
    <div className="space-y-5">
      <p className="text-ui-text-muted text-sm">
        {rangeLabel(mtd.current)} against {rangeLabel(mtd.prior)}, Pacific days,
        on Dom&apos;s booked-call rule. Read from Close and our copy of it at{" "}
        {formatPacificStampShort(report.readAt)}. Dom&apos;s total this month is{" "}
        {domTotal}: {now.booked} booked by Marketing, {now.lane2} by Lane 2 and{" "}
        {mtd.socialDms.current} by Social DMs, the Months V2 panel&apos;s
        figures.
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
        <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4">
          <div>
            <h2 className={adminSectionTitleClass}>By channel</h2>
            <p className="text-ui-text-subtle mt-1 text-xs">
              This month on top; {rangeLabel(mtd.prior)} and the change beneath.
              One row per lead source on Dom&apos;s map, including any that
              booked only last month.
            </p>
          </div>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(channelCsv(mtd))}`}
            download={`marketing-mtd-channels-${report.today}.csv`}
            className={`${adminLinkClass} text-xs print:hidden`}
          >
            Download CSV
          </a>
        </div>
        <div className="mt-3 overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[72rem] text-sm print:min-w-0 print:text-[10px]">
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
                  Total
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
            The 125-a-week goal was set on the old first-call count. Jess and
            Dom are resetting the Q4 targets on Dom&apos;s rule; until then read
            the goal panel as a guide.
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
              <li key={`${lead.leadId}-${lead.channel}`}>
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
        <details className="text-ui-text-muted print:hidden">
          <summary className="text-ui-text cursor-pointer font-medium">
            Definitions
          </summary>
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="text-ui-text font-medium">Booked calls</dt>
              <dd>
                Dom&apos;s booked_calls.v2.2: one per Close meeting that counts
                (not canceled, not a follow-up, no other meeting for the lead in
                the 60 days before), dated by the day it was booked, booked by
                Marketing (not a Lane 2 or Social DMs title). The row is the
                lead&apos;s original source on Dom&apos;s map. The same calls as
                the dashboard and the Months V2 panel.
              </dd>
            </div>
            <div>
              <dt className="text-ui-text font-medium">
                Lane 2 on marketing leads
              </dt>
              <dd>
                Counted meetings a Lane 2 setter booked, in the row of the
                lead&apos;s source. Never added to Booked. {UNKNOWN_CHANNEL}{" "}
                holds Lane 2 calls and wins whose lead has no source on
                Dom&apos;s map.
              </dd>
            </div>
            <div>
              <dt className="text-ui-text font-medium">
                Open calls and show rate
              </dt>
              <dd>
                Open calls are booked calls scheduled after today. Show rate is
                First Call Show Up = yes over the calls already due. Close keeps
                that flag for a lead&apos;s first call only, so a repeat booking
                reads unlogged, never a no-show.
              </dd>
            </div>
            <div>
              <dt className="text-ui-text font-medium">Closed won and value</dt>
              <dd>
                Close opportunities won in the dates, leaving out other brands,
                Reactivation Scrapers and deals owned by Ahmad B., Stephen O.,
                Spencer R., Mallory K. and Adam W., filed under the source
                Dom&apos;s map gives the deal&apos;s funnel. Value is the deal
                value in Close, not cash collected.
                {now.unvalued > 0 &&
                  ` ${now.unvalued} won this month carry no value.`}
              </dd>
            </div>
            <div>
              <dt className="text-ui-text font-medium">Sales cycle</dt>
              <dd>
                Days from the lead being created in Close to the deal being won,
                Pacific days, median of every deal.
              </dd>
            </div>
            <div>
              <dt className="text-ui-text font-medium">
                Spend and cost per booked
              </dt>
              <dd>
                Ad spend on the channel spine (Meta and Google): webinar ads on
                Internal Webinar, Google Ads and Meta Ads on their own rows.
                Cost per booked is spend over Marketing booked.
              </dd>
            </div>
          </dl>
        </details>
      </section>
    </div>
  );
}
