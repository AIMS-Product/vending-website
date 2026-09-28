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
import { C, n, Delta, MoverTable, PointsDelta } from "./shared";

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

export function SeoOverviewTab({ data }: { data: SeoOverview }) {
  const days = data.daily.map((d) => d.day);
  return (
    <div className="space-y-5">
      <KpiStrip
        current={data.current}
        prior={data.prior}
        lastYear={data.lastYear}
        brandShare={data.brandShareCurrent}
      />
      <p className="text-ui-text-subtle text-xs">
        Search Console web search, final data through {data.asOf ?? "n/a"}. The
        property holds data from {days[0] ?? "n/a"}; a year-back comparison
        appears once a year of history exists. Dashed amber lines mark the
        Webflow to Next.js cutover (2026-07-27) and each /resources publish.
      </p>
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">
          Impressions and clicks
        </h2>
        <SeoTrendChart
          ariaLabel="Google impressions and clicks per day"
          days={days}
          markers={data.markers}
          series={[
            {
              label: "Impressions",
              color: C.accent,
              values: data.daily.map((d) => d.impressions),
            },
            {
              label: "Clicks",
              color: C.ok,
              values: data.daily.map((d) => d.clicks),
            },
          ]}
        />
      </section>
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">
          Branded vs non-branded impressions
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Branded = searches for Vendingpreneurs, Mike Hoffman and their
          misspellings. Non-branded includes queries Google anonymizes.
        </p>
        <SeoTrendChart
          ariaLabel="Branded and non-branded impressions per day, stacked"
          stacked
          days={days}
          markers={data.markers}
          series={[
            {
              label: "Branded",
              color: C.accent,
              values: data.daily.map((d) => d.brandImpressions),
            },
            {
              label: "Non-branded",
              color: C.idle,
              values: data.daily.map((d) => d.impressions - d.brandImpressions),
            },
          ]}
        />
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={adminCardClass}>
          <h2 className="text-ui-text text-sm font-semibold">
            Average position
          </h2>
          <SeoTrendChart
            width={560}
            ariaLabel="Average Google position per day, 1 at the top"
            invert
            days={days}
            markers={data.markers}
            series={[
              {
                label: "Position",
                color: C.accent,
                values: data.daily.map((d) => d.position),
              },
            ]}
          />
        </section>
        <section className={adminCardClass}>
          <h2 className="text-ui-text text-sm font-semibold">
            Live /resources pages
          </h2>
          {data.livePagesByDay.length === 0 ? (
            <p className="text-ui-text-muted mt-3 text-sm">
              None published yet. The first P1 piece is due this week (Content
              Plan tab).
            </p>
          ) : (
            <SeoTrendChart
              width={560}
              ariaLabel="Live /resources pages over time"
              days={data.livePagesByDay.map((p) => p.day)}
              series={[
                {
                  label: "Live pages",
                  color: C.ok,
                  values: data.livePagesByDay.map((p) => p.count),
                },
              ]}
            />
          )}
          <p className="text-ui-text-subtle mt-2 text-xs">
            Published in the page builder. Search Console indexing is checked
            per URL (Content Plan).
          </p>
        </section>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <MoverTable
          title="Pages that moved most (28 days vs prior 28)"
          rows={data.movers.pages}
        />
        <MoverTable
          title="Queries that moved most"
          rows={data.movers.queries}
        />
      </div>
    </div>
  );
}
