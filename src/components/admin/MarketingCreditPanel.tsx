import {
  AdminMetricPanel,
  AdminMetricStrip,
  adminPanelClass,
} from "@/components/admin/AdminUi";
import { rangeLabel, TD, TH } from "@/components/admin/marketing-mtd-format";
import { formatUsd as money } from "@/lib/admin/format-number";
import type { MarketingCredit } from "@/lib/services/marketing-credit-data";
import {
  both,
  type CreditRow,
  type MarketingSource,
  sumRows,
} from "@/lib/services/marketing-credit";

interface MarketingCreditPanelProps {
  report: Extract<MarketingCredit, { ok: true }>;
}

/** What "came in" means for each source. */
const ENTERED_UNIT: Record<MarketingSource, string> = {
  Webinar: "registered",
  "Site form": "form fills",
  "Lead magnet": "opt-ins",
  Chatbot: "chats",
  "No marketing touch": "",
};

const n = (v: number) => v.toLocaleString("en-US");
const pct = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";
const GROUP =
  "border-ui-line border-l px-3 pt-2.5 text-center text-[11px] font-semibold tracking-wide uppercase";
const EDGE = "border-ui-line border-l";

function Cells({
  row,
}: {
  row: Pick<CreditRow, "entered" | "booked" | "won" | "revenue"> & {
    unit?: string;
  };
}) {
  const booked = both(row.booked);
  return (
    <>
      <td className={TD}>
        {row.entered === null ? "—" : n(row.entered)}
        {row.unit ? (
          <span className="text-ui-text-subtle block text-[11px]">
            {row.unit}
          </span>
        ) : null}
      </td>
      <td className={`${TD} ${EDGE}`}>{n(row.booked.self)}</td>
      <td className={TD}>{n(row.booked.reactivated)}</td>
      <td className={`${TD} font-semibold`}>{n(booked)}</td>
      <td className={TD}>{row.entered ? pct(booked, row.entered) : "—"}</td>
      <td className={`${TD} ${EDGE}`}>{n(row.won.self)}</td>
      <td className={TD}>{n(row.won.reactivated)}</td>
      <td className={TD}>{pct(both(row.won), booked)}</td>
      <td className={`${TD} ${EDGE}`}>{money(row.revenue.self)}</td>
      <td className={TD}>{money(row.revenue.reactivated)}</td>
      <td className={`${TD} font-semibold`}>{money(both(row.revenue))}</td>
    </>
  );
}

export function MarketingCreditPanel({ report }: MarketingCreditPanelProps) {
  const marketing = sumRows(
    report.rows.filter((r) => r.source !== "No marketing touch"),
  );
  const all = sumRows(report.rows);

  return (
    <div className="space-y-5">
      <p className="text-ui-text-muted text-sm">
        {rangeLabel({ from: report.from, to: report.to })} · from first touch to
        closed, booked on their own vs reactivated by a setter or scraper
      </p>

      <AdminMetricStrip columns={6}>
        <AdminMetricPanel
          label="Came in"
          value={n(marketing.entered)}
          caption="registrations, form fills, opt-ins, chats"
        />
        <AdminMetricPanel
          label="Booked themselves"
          value={n(marketing.booked.self)}
          caption={`${pct(marketing.booked.self, both(marketing.booked))} of marketing calls`}
        />
        <AdminMetricPanel
          label="Reactivated, then booked"
          value={n(marketing.booked.reactivated)}
          caption="marketing lead, setter or scraper booked"
        />
        <AdminMetricPanel
          label="Closed themselves"
          value={money(marketing.revenue.self)}
          caption={`${n(marketing.won.self)} deals`}
        />
        <AdminMetricPanel
          label="Closed via reactivation"
          value={money(marketing.revenue.reactivated)}
          caption={`${n(marketing.won.reactivated)} deals`}
        />
        <AdminMetricPanel
          label="Marketing share of revenue"
          value={pct(both(marketing.revenue), both(all.revenue))}
          caption={`${money(both(marketing.revenue))} of ${money(both(all.revenue))}`}
        />
      </AdminMetricStrip>

      <section className={adminPanelClass} aria-label="Credit by source">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-sm">
            <thead className="bg-ui-canvas text-ui-text-muted text-xs">
              <tr>
                <th colSpan={2} />
                <th colSpan={4} className={GROUP}>
                  Booked
                </th>
                <th colSpan={3} className={GROUP}>
                  Closed won
                </th>
                <th colSpan={3} className={GROUP}>
                  Revenue
                </th>
              </tr>
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">
                  Source
                </th>
                <th scope="col" className={TH}>
                  Came in
                </th>
                <th scope="col" className={`${TH} ${EDGE}`}>
                  Themselves
                </th>
                <th scope="col" className={TH}>
                  Reactivated
                </th>
                <th scope="col" className={TH}>
                  Total
                </th>
                <th scope="col" className={TH}>
                  Book %
                </th>
                <th scope="col" className={`${TH} ${EDGE}`}>
                  Themselves
                </th>
                <th scope="col" className={TH}>
                  Reactivated
                </th>
                <th scope="col" className={TH}>
                  Close %
                </th>
                <th scope="col" className={`${TH} ${EDGE}`}>
                  Themselves
                </th>
                <th scope="col" className={TH}>
                  Reactivated
                </th>
                <th scope="col" className={TH}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.source} className="border-ui-line/60 border-t">
                  <th
                    scope="row"
                    className="px-4 py-2 text-left font-medium whitespace-nowrap"
                  >
                    {row.source}
                  </th>
                  <Cells row={{ ...row, unit: ENTERED_UNIT[row.source] }} />
                </tr>
              ))}
              <tr className="border-ui-line-strong border-t-2 font-semibold">
                <th scope="row" className="px-4 py-2 text-left">
                  Total
                </th>
                <Cells row={{ ...all, entered: null }} />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
