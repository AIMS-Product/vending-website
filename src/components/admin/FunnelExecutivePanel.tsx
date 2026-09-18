import { Fragment } from "react";
import { adminCardClass, adminEyebrowClass } from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import {
  FLAT_BAND,
  MIN_WEIGHT,
  trendTone,
} from "@/components/admin/FunnelMonthlyPanel";
import type {
  ExecutiveMonth,
  FunnelExecutiveReport,
} from "@/lib/services/funnel-executive";
import type { FunnelPeriodRow } from "@/lib/services/funnel-monthly";

/**
 * The executive rollup: one row per month, whole funnel, most recent first.
 *
 * Deliberately not per channel or per page at the top level — those are the
 * drill-downs underneath, collapsed, and the Channels and Funnels tabs already
 * do them properly. The question this table answers is "are we improving",
 * which needs the months on top of each other and nothing else in the way.
 *
 * Colour is the month-on-month direction against the row BELOW, on the same
 * rule the Funnels tab uses — imported, not redefined.
 */

type Column = {
  key: string;
  label: string;
  value: (month: ExecutiveMonth) => number | null;
  /** Observations the value rests on. A thin cell is never coloured. */
  weight: (month: ExecutiveMonth) => number;
  format: (value: number) => string;
  higherIsBetter: boolean;
  /**
   * True where the two sides of the division come from different instruments,
   * so the cell is greyed and the header carries a note. Opt-in divides GA4
   * sessions by our own leads; cost per lead divides ad-platform spend by
   * them.
   */
  crossSystem?: boolean;
};

const COLUMNS: Column[] = [
  {
    key: "visits",
    label: "Visits",
    value: (month) => month.totals.visits,
    weight: (month) => month.totals.visits ?? 0,
    format: count,
    higherIsBetter: true,
  },
  {
    key: "leads",
    label: "Leads",
    value: (month) => month.totals.leads,
    weight: (month) => month.totals.leads,
    format: count,
    higherIsBetter: true,
  },
  {
    key: "optIn",
    label: "Opt-in %",
    value: (month) => month.totals.rates.visitToLead,
    weight: (month) => month.totals.visits ?? 0,
    format: percent,
    higherIsBetter: true,
    crossSystem: true,
  },
  {
    key: "booked",
    label: "Booked",
    value: (month) => month.totals.booked,
    weight: (month) => month.totals.booked,
    format: count,
    higherIsBetter: true,
  },
  {
    key: "book",
    label: "Book %",
    value: (month) => month.totals.rates.leadToBook,
    weight: (month) => month.totals.leads,
    format: percent,
    higherIsBetter: true,
  },
  {
    key: "showed",
    label: "Showed",
    value: (month) => month.totals.held,
    weight: (month) => month.totals.showable,
    format: count,
    higherIsBetter: true,
  },
  {
    key: "show",
    label: "Show %",
    value: (month) => month.totals.rates.bookToShow,
    weight: (month) => month.totals.showable,
    format: percent,
    higherIsBetter: true,
  },
  {
    key: "won",
    label: "Won",
    value: (month) => month.totals.won,
    weight: (month) => month.totals.booked,
    format: count,
    higherIsBetter: true,
  },
  {
    key: "revenue",
    label: "Revenue",
    value: (month) => month.totals.revenue,
    weight: (month) => month.totals.won,
    format: money,
    higherIsBetter: true,
  },
  {
    key: "cpl",
    label: "Cost per lead",
    value: (month) => month.costPerLead,
    weight: (month) => month.totals.leads,
    format: (value) => `$${value.toFixed(0)}`,
    // Cheaper is better, so a fall is the good direction.
    higherIsBetter: false,
    crossSystem: true,
  },
];

export function FunnelExecutiveTab({ data }: { data: FunnelExecutiveReport }) {
  if (data.months.length === 0) {
    return (
      <section className={adminCardClass}>
        <h2 className={adminEyebrowClass}>Executive rollup</h2>
        <p className="text-ui-text-subtle mt-2 text-sm">
          No months to show yet — no leads have been captured.
        </p>
      </section>
    );
  }

  const latest = data.months[0];

  return (
    <div className="space-y-6">
      <section className={adminCardClass} aria-label="Executive rollup">
        <h2 className={adminEyebrowClass}>Month on month</h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          One row per month, every source and page together. A lead counts in
          the month it arrived and its call, show and sale count there too,
          whenever they happened — so a September sale from a July lead is in
          July, and July keeps moving for weeks.
        </p>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Green and red mark the move against the month below, never a target. A
          move resting on fewer than {MIN_WEIGHT} observations, or smaller than{" "}
          {FLAT_BAND}%, is left uncoloured. A dash means not observed; it never
          means zero.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[54rem] text-sm">
            <thead>
              <tr className="text-ui-text-subtle border-ui-line border-b text-left text-xs">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Month
                </th>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="py-2 pr-3 text-right font-medium"
                  >
                    {column.label}
                    {column.crossSystem ? (
                      <span
                        className="text-ui-text-subtle"
                        title="Divides one instrument by another — read the direction, not the decimal."
                      >
                        {" "}
                        ‡
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.months.map((month, index) => (
                <tr key={month.key} className="border-ui-line/60 border-b">
                  <th
                    scope="row"
                    className="py-2.5 pr-3 text-left font-medium whitespace-nowrap"
                  >
                    {month.label}
                    {month.visitsEnd || month.visitsStart ? (
                      <span className="text-ui-text-subtle block text-xs font-normal">
                        {month.spendFrom ? "visits & spend" : "visits"}{" "}
                        {month.visitsStart ?? "month start"} –{" "}
                        {month.visitsEnd ?? "month end"}
                      </span>
                    ) : null}
                  </th>
                  {COLUMNS.map((column) => (
                    <Cell
                      key={column.key}
                      column={column}
                      month={month}
                      previous={data.months[index + 1] ?? null}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-ui-text-subtle mt-3 text-xs">
          ‡ divides one instrument by another. Visits are GA4 sessions, leads
          are rows in our own table and spend comes from the ad platforms, so
          read these as a direction rather than an exact figure.
          {data.spendChannels.length > 0 ? (
            <>
              {" "}
              Spend is observed for {data.spendChannels.join(", ")} only; every
              other channel&rsquo;s cost per lead is a dash because nothing was
              observed, not because it was free.
            </>
          ) : null}
        </p>
        {data.visitsThrough ? (
          <p className="text-ui-text-subtle mt-1 text-xs">
            GA4 has reported through {data.visitsThrough}. The current month is
            still filling, so its visit total covers fewer days than its leads.
          </p>
        ) : null}
      </section>

      <Breakdown
        title="By channel"
        caption="The same months, split by where the lead came from."
        months={data.months}
        rowsOf={(month) => month.byChannel}
        costOf={(month, row) => month.costPerLeadByChannel[row.funnel] ?? null}
        withLogo
      />
      <Breakdown
        title="By page"
        caption="The same months, split by the page the lead came in on. Spend has no page, so cost per lead is a dash throughout."
        months={data.months}
        rowsOf={(month) => month.byPage}
        costOf={() => null}
      />

      <p className="text-ui-text-subtle text-xs">
        Show rate could be answered for {latest.totals.showable} of{" "}
        {latest.totals.booked} booked calls in {latest.label}.
      </p>
    </div>
  );
}

/**
 * One collapsed drill-down. Rows run down, months run across, which is the
 * opposite of the table above on purpose: the top table answers "are we
 * improving" and this one answers "who moved".
 */
function Breakdown({
  title,
  caption,
  months,
  rowsOf,
  costOf,
  withLogo,
}: {
  title: string;
  caption: string;
  months: ExecutiveMonth[];
  rowsOf: (month: ExecutiveMonth) => FunnelPeriodRow[];
  costOf: (month: ExecutiveMonth, row: FunnelPeriodRow) => number | null;
  withLogo?: boolean;
}) {
  const keys = [
    ...new Set(
      months.flatMap((month) => rowsOf(month).map((row) => row.funnel)),
    ),
  ];
  if (keys.length === 0) return null;

  const leadsOf = (key: string) =>
    months.reduce(
      (total, month) =>
        total + (rowsOf(month).find((row) => row.funnel === key)?.leads ?? 0),
      0,
    );
  keys.sort((a, b) => leadsOf(b) - leadsOf(a));

  return (
    <details className={adminCardClass}>
      <summary className="cursor-pointer text-sm font-medium">
        {title}
        <span className="text-ui-text-subtle ml-2 text-xs font-normal">
          {keys.length} rows — collapsed
        </span>
      </summary>
      <p className="text-ui-text-subtle mt-2 text-xs">{caption}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="text-ui-text-subtle border-ui-line border-b text-left text-xs">
              <th scope="col" className="py-2 pr-3 font-medium">
                {title.replace("By ", "")}
              </th>
              {months.map((month) => (
                <th
                  key={month.key}
                  scope="col"
                  colSpan={3}
                  className="border-ui-line/60 border-l py-2 pr-3 text-right font-medium"
                >
                  {month.label}
                </th>
              ))}
            </tr>
            <tr className="text-ui-text-subtle border-ui-line border-b text-left text-[11px]">
              <th scope="col" className="py-1 pr-3 font-normal" />
              {months.map((month) => (
                <Fragment key={month.key}>
                  <th
                    scope="col"
                    className="border-ui-line/60 border-l py-1 pr-3 text-right font-normal"
                  >
                    Leads
                  </th>
                  <th scope="col" className="py-1 pr-3 text-right font-normal">
                    Opt-in
                  </th>
                  <th scope="col" className="py-1 pr-3 text-right font-normal">
                    CPL
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key} className="border-ui-line/60 border-b">
                <th
                  scope="row"
                  className="py-1.5 pr-3 text-left text-xs font-medium whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {withLogo ? <ChannelLogo label={key} /> : null}
                    {key}
                  </span>
                </th>
                {months.map((month) => {
                  const row =
                    rowsOf(month).find((entry) => entry.funnel === key) ?? null;
                  const cost = row ? costOf(month, row) : null;
                  return (
                    <Fragment key={month.key}>
                      <td className="border-ui-line/60 border-l py-1.5 pr-3 text-right text-xs tabular-nums">
                        {row ? count(row.leads) : "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-xs tabular-nums">
                        {row?.rates.visitToLead === null ||
                        row?.rates.visitToLead === undefined
                          ? "—"
                          : percent(row.rates.visitToLead)}
                      </td>
                      <td className="text-ui-text-subtle py-1.5 pr-3 text-right text-xs tabular-nums">
                        {cost === null ? "—" : `$${cost.toFixed(0)}`}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Cell({
  column,
  month,
  previous,
}: {
  column: Column;
  month: ExecutiveMonth;
  previous: ExecutiveMonth | null;
}) {
  const value = column.value(month);
  const before = previous ? column.value(previous) : null;
  const tone = trendTone({
    value,
    before,
    weight: column.weight(month),
    weightBefore: previous ? column.weight(previous) : 0,
    higherIsBetter: column.higherIsBetter,
  });

  return (
    <td
      className={`py-2.5 pr-3 text-right align-middle whitespace-nowrap tabular-nums ${
        tone === "up" ? "text-ui-ok" : tone === "down" ? "text-ui-bad" : ""
      } ${column.crossSystem ? "opacity-80" : ""}`}
      title={
        tone === "flat" && value !== null && before !== null
          ? "Change too small, or resting on too few observations, to call"
          : undefined
      }
    >
      {value === null ? "—" : column.format(value)}
    </td>
  );
}

function count(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
