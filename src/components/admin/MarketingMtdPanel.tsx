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
 * The marketing month so far on Jess's field-based rule, by Close Funnel
 * Name, against the same dates last month, and the 125-a-week booking goal.
 * Rules: `marketing-mtd.ts`.
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

  return (
    <div className="space-y-5">
      <p className="text-ui-text-muted text-sm">
        {rangeLabel(mtd.current)} against {rangeLabel(mtd.prior)}. Every channel
        except Reactivation Scrapers, one row per Close Funnel Name. Bookings
        and call flags from our hourly copy of Close
        {report.bookingsAsOf
          ? ` (${formatPacificStampShort(report.bookingsAsOf)})`
          : ""}
        , wins read at {formatPacificStampShort(report.readAt)}.
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
              One row per Close Funnel Name, including any that booked only last
              month. Open a channel below to see its people.
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
        <ChannelPeople mtd={mtd} />
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
            {now.open} booked {now.open === 1 ? "lead has" : "leads have"} a
            verified upcoming first call and no show logged yet; they stay in
            the show-rate denominator, as on Jess&apos;s sheet.
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
                Close leads whose First Sales Call Booked Date is in the dates,
                one per lead, in the row of the lead&apos;s current Funnel Name
                (blank is {UNKNOWN_CHANNEL}). Leaves out Reactivation Scrapers,
                leads now Canceled (by Lead) or Outside the US, other brands
                (TLG, PPA) and leads owned by someone off the Lane 1 roster. Who
                booked the call does not matter: this is source credit.
              </dd>
            </div>
            <div>
              <dt className="text-ui-text font-medium">
                Open calls and show rate
              </dt>
              <dd>
                Open calls are booked leads not marked shown with an upcoming
                Close meeting that is not canceled or a follow-up, and no
                completed meeting since booking. Show rate is First Call Show Up
                = yes over every booked lead, future bookings included.
              </dd>
            </div>
            <div>
              <dt className="text-ui-text font-medium">Closed won and value</dt>
              <dd>
                Close opportunities won in the dates, leaving out other brands,
                Reactivation Scrapers and deals owned by Ahmad B., Stephen O.,
                Spencer R., Mallory K. and Adam W., filed under the deal&apos;s
                Funnel Name. Value is the deal value in Close, not cash
                collected.
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

/** Per channel: the booked leads and won deals behind the row, with Close links. */
function ChannelPeople({ mtd }: { mtd: MarketingMtd }) {
  const labels = mtd.rows
    .map((row) => row.label)
    .filter(
      (label) =>
        mtd.leads.some((l) => l.channel === label) ||
        mtd.wins.some((w) => w.channel === label),
    );
  if (labels.length === 0) return null;
  return (
    <div className="border-ui-line/60 space-y-1 border-t px-4 py-3 text-sm print:hidden">
      {labels.map((label) => {
        const leads = mtd.leads.filter((l) => l.channel === label);
        const wins = mtd.wins.filter((w) => w.channel === label);
        return (
          <details key={label}>
            <summary className="text-ui-text cursor-pointer py-1 font-medium">
              {label}{" "}
              <span className="text-ui-text-subtle font-normal">
                · {leads.length} booked · {wins.length} won
              </span>
            </summary>
            <ul className="text-ui-text-muted space-y-1 py-2 pl-5 text-xs">
              {leads.map((lead) => (
                <li key={lead.leadId}>
                  <a
                    href={`https://app.close.com/lead/${lead.leadId}/`}
                    target="_blank"
                    rel="noreferrer"
                    className={adminLinkClass}
                  >
                    {lead.name ?? "Unnamed lead"}
                  </a>{" "}
                  booked {lead.bookedDate} · shown {lead.shown ? "yes" : "no"}
                  {lead.shown &&
                    ` · qualified ${lead.qualified ? "yes" : "no"}`}
                  {lead.open && " · upcoming call"}
                </li>
              ))}
              {wins.map((win) => (
                <li key={`${win.leadId}-${win.dateWon}-${win.value}`}>
                  <a
                    href={`https://app.close.com/lead/${win.leadId}/`}
                    target="_blank"
                    rel="noreferrer"
                    className={adminLinkClass}
                  >
                    Won {win.dateWon.slice(0, 10)}
                  </a>{" "}
                  {win.value === null ? "no value" : money(win.value)}
                  {win.closer && ` · ${win.closer}`}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
