import { adminCardClass } from "@/components/admin/AdminUi";
import {
  WON_SOURCE,
  type WonDealsReport,
} from "@/lib/services/close-won-deals";

const money = (v: number | null) =>
  v === null ? "n/a" : `$${Math.round(v).toLocaleString("en-US")}`;
const num = (v: number | null) =>
  v === null ? "n/a" : v.toLocaleString("en-US");
const th = "py-1.5 pr-3 font-medium";
const td = "py-1.5 pr-3 tabular-nums";

export function WonDealsPanel({ report }: { report: WonDealsReport }) {
  if (!report.ok) {
    return (
      <section className={adminCardClass}>
        <p className="text-ui-bad text-sm">
          Close could not be read, so no wins are shown: {report.error}
        </p>
      </section>
    );
  }
  const { totals, rollup, deals } = report;
  return (
    <div className="space-y-5">
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">
          Closed-won by source, {report.from} to {report.to}
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          {num(totals.won)} won, {money(totals.revenue)}, median{" "}
          {num(totals.medianDays)} days from first engaged to won. {WON_SOURCE}{" "}
          Close rate = won in the range out of first calls shown in the range,
          so it compares two groups of people, not one cohort.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ui-text-muted text-left text-xs">
                <th className={th}>Source</th>
                <th className={`${th} text-right`}>Won</th>
                <th className={`${th} text-right`}>Revenue</th>
                <th className={`${th} text-right`}>Avg deal</th>
                <th className={`${th} text-right`}>Median days</th>
                <th className={`${th} text-right`}>p75 days</th>
                <th className={`${th} text-right`}>Shown</th>
                <th className={`${th} text-right`}>Close rate</th>
              </tr>
            </thead>
            <tbody>
              {rollup.map((r) => (
                <tr key={r.source} className="border-ui-line border-t">
                  <td className="text-ui-text py-1.5 pr-3">{r.source}</td>
                  <td className={`${td} text-right`}>{num(r.won)}</td>
                  <td className={`${td} text-right`}>{money(r.revenue)}</td>
                  <td className={`${td} text-right`}>{money(r.avgDeal)}</td>
                  <td className={`${td} text-right`}>{num(r.medianDays)}</td>
                  <td className={`${td} text-right`}>{num(r.p75Days)}</td>
                  <td className={`${td} text-right`}>{num(r.shown)}</td>
                  <td className={`${td} text-right`}>
                    {r.closeRate === null
                      ? "n/a"
                      : `${Math.round(r.closeRate * 100)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">Every sale</h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          First-touch UTM comes from the buyer&apos;s earliest site form; site
          forms start 2026-07-06, so earlier buyers show none.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ui-text-muted text-left text-xs">
                <th className={th}>Buyer</th>
                <th className={th}>Source</th>
                <th className={th}>First touch</th>
                <th className={th}>First engaged</th>
                <th className={th}>Via</th>
                <th className={th}>Won</th>
                <th className={`${th} text-right`}>Days</th>
                <th className={`${th} text-right`}>Value</th>
                <th className={th}>Closer</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr
                  key={`${d.leadId}-${d.dateWon}-${d.value}`}
                  className="border-ui-line border-t"
                >
                  <td className="py-1.5 pr-3">
                    <a
                      href={`https://app.close.com/lead/${d.leadId}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ui-accent hover:underline"
                    >
                      {d.name ?? d.leadId}
                    </a>
                  </td>
                  <td className="py-1.5 pr-3">
                    {d.source}
                    {d.funnel && d.funnel !== d.source ? (
                      <span className="text-ui-text-subtle block text-xs">
                        {d.funnel}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-ui-text-muted py-1.5 pr-3 text-xs">
                    {d.firstTouch ?? ""}
                  </td>
                  <td className={td}>
                    {d.firstEngagedAt?.slice(0, 10) ?? "n/a"}
                  </td>
                  <td className="text-ui-text-muted py-1.5 pr-3 text-xs">
                    {d.firstEngagedVia ?? ""}
                  </td>
                  <td className={td}>{d.dateWon}</td>
                  <td className={`${td} text-right`}>{num(d.daysToClose)}</td>
                  <td className={`${td} text-right`}>{money(d.value)}</td>
                  <td className="text-ui-text-muted py-1.5 text-xs">
                    {d.closer ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
