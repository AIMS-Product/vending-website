import {
  AdminMetricPanel,
  AdminMetricStrip,
  adminCardClass,
} from "@/components/admin/AdminUi";
import { SeoTrendChart } from "@/components/admin/SeoTrendChart";
import {
  type SeoOverview,
  type Totals,
} from "@/lib/services/seo-command-center";
import { type SeoScorecard } from "@/lib/services/seo-scorecard";
import { C, n, Delta, MoverTable, PointsDelta } from "./shared";

function Scorecard({ data }: { data: SeoScorecard }) {
  const { day0, current } = data;
  return (
    <details className={`${adminCardClass} group`}>
      <summary className="text-ui-text flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
        Scorecard vs Day 0, with the 30, 60 and 90-day targets
        <span className="text-ui-text-subtle text-xs font-normal group-open:hidden">
          Show
        </span>
        <span className="text-ui-text-subtle hidden text-xs font-normal group-open:inline">
          Hide
        </span>
      </summary>
      <p className="text-ui-text-subtle mt-2 text-xs">
        {day0
          ? `Day 0 frozen ${day0.day}. Now = the 28 days (7 for the north star) through ${data.asOf ?? "n/a"}; ranks from the newest DataForSEO pull. Targets are 30, 60 and 90 days after Day 0.`
          : "Day 0 is not frozen yet: paste APPLY-IN-SQL-EDITOR.md section 9, then run scripts/seo-day0.mjs --write."}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ui-text-muted text-left text-xs">
              <th className="py-1.5 pr-3 font-medium">Metric</th>
              <th className="py-1.5 pr-3 text-right font-medium">Day 0</th>
              <th className="py-1.5 pr-3 text-right font-medium">Now</th>
              <th className="py-1.5 pr-3 font-medium">vs Day 0</th>
              <th className="py-1.5 pr-3 text-right font-medium">30 days</th>
              <th className="py-1.5 pr-3 text-right font-medium">60 days</th>
              <th className="py-1.5 text-right font-medium">90 days</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => {
              const base = day0?.values[row.metric] ?? null;
              const now = current[row.metric] ?? null;
              return (
                <tr key={row.metric} className="border-ui-line border-t">
                  <td className="text-ui-text py-1.5 pr-3">
                    {row.label}
                    {row.note ? (
                      <span className="text-ui-text-subtle block text-xs">
                        {row.note}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {n(base)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {n(now)}
                  </td>
                  <td className="py-1.5 pr-3">
                    <Delta now={now} before={base} />
                  </td>
                  {(row.targets ?? [null, null, null]).map((t, i) => (
                    <td
                      key={i}
                      className="text-ui-text-muted py-1.5 pr-3 text-right tabular-nums last:pr-0"
                    >
                      {n(t)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function KpiStrip({
  current,
  prior,
  lastYear,
  brandShare,
}: {
  current: Totals;
  prior: Totals;
  lastYear: Totals | null;
  brandShare: number | null;
}) {
  const yoy = (pick: (t: Totals) => number | null) =>
    lastYear ? `vs last year ${n(pick(lastYear), 1)}` : "no data a year back";
  return (
    <AdminMetricStrip columns={4}>
      <AdminMetricPanel
        label="Google impressions, 28 days"
        value={n(current.impressions)}
        delta={<Delta now={current.impressions} before={prior.impressions} />}
        caption={`prior 28 days ${n(prior.impressions)}; ${yoy((t) => t.impressions)}`}
      />
      <AdminMetricPanel
        label="Clicks, 28 days"
        value={n(current.clicks)}
        delta={<Delta now={current.clicks} before={prior.clicks} />}
        caption={`prior ${n(prior.clicks)}; brand searches ${brandShare === null ? "n/a" : `${n(brandShare * 100)}%`} of impressions`}
      />
      <AdminMetricPanel
        label="Click-through rate"
        value={current.ctrPct === null ? "n/a" : `${n(current.ctrPct, 1)}%`}
        delta={<Delta now={current.ctrPct} before={prior.ctrPct} />}
        caption={`prior ${prior.ctrPct === null ? "n/a" : `${n(prior.ctrPct, 1)}%`}`}
      />
      <AdminMetricPanel
        label="Average position"
        value={n(current.position, 1)}
        delta={<PointsDelta now={current.position} before={prior.position} />}
        caption={`prior ${n(prior.position, 1)}; lower is better`}
      />
    </AdminMetricStrip>
  );
}

export function SeoOverviewTab({
  data,
  scorecard,
}: {
  data: SeoOverview;
  scorecard: SeoScorecard;
}) {
  const days = data.daily.map((d) => d.day);
  return (
    <div className="space-y-5">
      <KpiStrip
        current={data.current}
        prior={data.prior}
        lastYear={data.lastYear}
        brandShare={data.brandShareCurrent}
      />
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">
          Google impressions
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Branded = searches for Vendingpreneurs, Mike Hoffman and their
          misspellings; non-branded includes queries Google anonymizes. Dashed
          lines mark the Webflow to Next.js cutover (2026-07-27) and each
          /resources publish.
        </p>
        <SeoTrendChart
          ariaLabel="Google impressions, branded and non-branded, stacked"
          bars
          stacked
          days={days}
          markers={data.markers}
          series={[
            {
              label: "Non-branded",
              color: C.accent,
              values: data.daily.map((d) => d.impressions - d.brandImpressions),
            },
            {
              label: "Branded",
              color: "var(--ui-chart-7)",
              values: data.daily.map((d) => d.brandImpressions),
            },
          ]}
        />
      </section>
      <section aria-labelledby="seo-moved">
        <h2 id="seo-moved" className="text-ui-text mb-3 text-sm font-semibold">
          What changed, last 28 days against the 28 before
        </h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <MoverTable title="Pages" rows={data.movers.pages} />
          <MoverTable title="Queries" rows={data.movers.queries} />
        </div>
      </section>
      <Scorecard data={scorecard} />
      <p className="text-ui-text-subtle text-xs">
        Search Console web search, final data through {data.asOf ?? "n/a"}. The
        property holds data from {days[0] ?? "n/a"}; a year-back comparison
        appears once a year of history exists. Live /resources pages and their
        indexing are on the Content Plan tab.
      </p>
    </div>
  );
}
