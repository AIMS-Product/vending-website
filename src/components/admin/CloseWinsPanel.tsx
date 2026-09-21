import { adminCardClass, adminEyebrowClass } from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import {
  CLOSE_WINS_SOURCE,
  type CloseWinsPeriod,
  type CloseWinsReport,
} from "@/lib/services/close-wins";

interface CloseWinsPanelProps {
  report: CloseWinsReport;
  /** Columns in display order. A column Close returned no deals for reads 0. */
  columns: Array<{ key: string; label: string }>;
  caption: string;
}

/**
 * Won deals and revenue per channel, straight from Close. The only place a
 * sale by someone who never filled a site form (a webinar buyer) is counted.
 */
export function CloseWinsPanel({
  report,
  columns,
  caption,
}: CloseWinsPanelProps) {
  return (
    <section className={adminCardClass} aria-label="Won in Close">
      <h2 className={adminEyebrowClass}>Won in Close</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">{caption}</p>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Source: {CLOSE_WINS_SOURCE} These are sales, not leads.
      </p>
      {report.ok ? (
        <>
          <WinsTable periods={report.periods} columns={columns} />
          {/*
            The other half of a win. Until now a sale was credited to a channel
            and to nobody, so "whose close was that" could not be answered here
            at all — which is how one ends up argued over in Slack. Same deals,
            same totals, grouped by the opportunity's owner in Close.
          */}
          <h3 className="text-ui-text mt-6 text-sm font-semibold">
            Who closed them
          </h3>
          <p className="text-ui-text-subtle mt-1 text-xs">
            The opportunity&rsquo;s owner in Close. Who set the call is a
            separate question, answered on Bookings.
          </p>
          <WinsTable periods={report.byCloser} columns={columns} people />
        </>
      ) : (
        <p className="text-ui-bad mt-3 text-sm">
          Close could not be read, so won deals are not shown: {report.error}
        </p>
      )}
    </section>
  );
}

function WinsTable({
  periods,
  columns,
  people = false,
}: {
  periods: CloseWinsPeriod[];
  columns: CloseWinsPanelProps["columns"];
  /** Rows are people, so no channel logo is drawn beside the name. */
  people?: boolean;
}) {
  const byKey = new Map(periods.map((period) => [period.key, period]));
  const shown = columns.map((column) => byKey.get(column.key) ?? null);
  const revenueOf = (label: string) =>
    shown.reduce(
      (sum, period) =>
        sum + (period?.rows.find((row) => row.label === label)?.revenue ?? 0),
      0,
    );
  const labels = [
    ...new Set(
      shown.flatMap((period) => period?.rows.map((r) => r.label) ?? []),
    ),
  ].sort((a, b) => revenueOf(b) - revenueOf(a));
  const unvalued = shown.reduce(
    (sum, period) => sum + (period?.unvalued ?? 0),
    0,
  );

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="text-ui-text-subtle border-ui-line border-b text-left text-xs">
            <th scope="col" className="py-2 pr-3 font-medium">
              Channel
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="py-2 pr-3 text-right font-medium"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label) => (
            <tr key={label} className="border-ui-line/60 border-b">
              <th
                scope="row"
                className="py-1.5 pr-3 text-left text-xs font-medium whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-1.5">
                  {people ? null : <ChannelLogo label={label} />}
                  {label}
                </span>
              </th>
              {shown.map((period, index) => {
                const row = period?.rows.find((entry) => entry.label === label);
                return (
                  <WinsCell
                    key={columns[index].key}
                    won={row?.won ?? 0}
                    revenue={row?.revenue ?? 0}
                  />
                );
              })}
            </tr>
          ))}
          <tr className="font-medium">
            <th scope="row" className="py-2 pr-3 text-left text-xs">
              All channels
            </th>
            {shown.map((period, index) => (
              <WinsCell
                key={columns[index].key}
                won={period?.won ?? 0}
                revenue={period?.revenue ?? 0}
              />
            ))}
          </tr>
        </tbody>
      </table>
      {unvalued > 0 ? (
        <p className="text-ui-text-subtle mt-2 text-xs">
          {unvalued} won {unvalued === 1 ? "deal has" : "deals have"} no value
          in Close; counted as won, left out of revenue.
        </p>
      ) : null}
    </div>
  );
}

function WinsCell({ won, revenue }: { won: number; revenue: number }) {
  return (
    <td className="py-1.5 pr-3 text-right text-xs whitespace-nowrap tabular-nums">
      {won.toLocaleString("en-US")}
      <span className="text-ui-text-subtle">
        {" "}
        · ${Math.round(revenue).toLocaleString("en-US")}
      </span>
    </td>
  );
}
