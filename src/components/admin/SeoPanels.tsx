import Link from "next/link";
import {
  AdminDeltaChip,
  AdminMetricPanel,
  AdminMetricStrip,
  adminCardClass,
  adminInputClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSmallButtonClass,
  adminStickyHeadClass,
} from "@/components/admin/AdminUi";
import { SeoTrendChart } from "@/components/admin/SeoTrendChart";
import { PLAYBOOK, TRIGGER_NAMES, type TriggerCode } from "@/lib/seo/triggers";
import type {
  KeywordRow,
  Mover,
  PageRow,
  SeoOverview,
  SeoSocial,
  Totals,
} from "@/lib/services/seo-command-center";
import { ROADMAP_PHASES, type ContentPlan } from "@/lib/services/seo-plan-data";
import type { Tables } from "@/types/database";
import {
  addTask,
  saveMonthlyReview,
  updatePieceStatus,
  updateTaskStatus,
} from "@/app/admin/seo/actions";

const SITE = "https://www.vendingpreneurs.com";
const C = {
  accent: "var(--ui-accent)",
  ok: "var(--ui-ok)",
  warn: "var(--ui-warn)",
  idle: "var(--ui-idle)",
  bad: "var(--ui-bad)",
};

const n = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined
    ? "n/a"
    : v.toLocaleString("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });

function Delta({
  now,
  before,
  lowerIsBetter = false,
}: {
  now: number | null;
  before: number | null;
  lowerIsBetter?: boolean;
}) {
  if (now === null || before === null || before === 0) return null;
  const change = ((now - before) / before) * 100;
  const good = lowerIsBetter ? change < 0 : change > 0;
  const tone = Math.abs(change) < 1 ? "neutral" : good ? "up" : "down";
  return (
    <AdminDeltaChip
      tone={tone}
    >{`${change > 0 ? "+" : ""}${n(change, 0)}%`}</AdminDeltaChip>
  );
}

export function SeoMissing() {
  return (
    <div className={`${adminCardClass} text-ui-text-muted text-sm`}>
      <p className="text-ui-text font-semibold">
        The SEO tables are not created yet.
      </p>
      <p className="mt-2">
        Paste the SEO block from{" "}
        <code>supabase/migrations/APPLY-IN-SQL-EDITOR.md</code> into the
        Supabase SQL editor, then run the backfill once:{" "}
        <code>/api/admin/search-console-sync/run?days=500</code> and{" "}
        <code>/api/admin/metricool-sync/run?days=400</code>.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Overview

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
        delta={
          <Delta now={current.position} before={prior.position} lowerIsBetter />
        }
        caption={`prior ${n(prior.position, 1)}; lower is better`}
      />
    </AdminMetricStrip>
  );
}

function MoverTable({ title, rows }: { title: string; rows: Mover[] }) {
  return (
    <div className={adminPanelClass}>
      <h3 className="text-ui-text border-ui-line border-b px-4 py-2.5 text-sm font-semibold">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-ui-text-subtle px-4 py-3 text-xs">
          Nothing moved by 20+ impressions.
        </p>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-ui-line divide-y">
            {rows.map((m) => (
              <tr key={m.key}>
                <td
                  className="text-ui-text max-w-0 truncate px-4 py-2"
                  title={m.key}
                >
                  {m.key}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(m.impressions)}
                </td>
                <td className="px-4 py-2 text-right">
                  <AdminDeltaChip
                    tone={
                      m.change > 0 ? "up" : m.change < 0 ? "down" : "neutral"
                    }
                  >
                    {`${m.change > 0 ? "+" : ""}${n(m.change)}`}
                  </AdminDeltaChip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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

// ------------------------------------------------------------------- Pages

export function SeoPagesTab({
  pages,
  asOf,
}: {
  pages: PageRow[];
  asOf: string | null;
}) {
  return (
    <section className={adminPanelClass}>
      <p className="text-ui-text-subtle px-4 pt-3 text-xs">
        Every URL Google showed in the last 16 weeks, through {asOf ?? "n/a"}.
        Trend = weekly impressions.
      </p>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full text-sm">
          <thead className={adminStickyHeadClass}>
            <tr className="text-ui-text-subtle text-left text-xs">
              <th className="px-4 py-2">Page</th>
              <th className="px-2 py-2 text-right">Impressions</th>
              <th className="px-2 py-2 text-right">Clicks</th>
              <th className="px-2 py-2 text-right">CTR</th>
              <th className="px-2 py-2 text-right">Position</th>
              <th className="px-2 py-2">16 weeks</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {pages.map((p) => (
              <tr key={p.url}>
                <td
                  className="text-ui-text max-w-[22rem] truncate px-4 py-2"
                  title={p.url}
                >
                  {p.path}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(p.current.impressions)}{" "}
                  <Delta
                    now={p.current.impressions}
                    before={p.prior.impressions}
                  />
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(p.current.clicks)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {p.current.ctrPct === null
                    ? "n/a"
                    : `${n(p.current.ctrPct, 1)}%`}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(p.current.position, 1)}
                </td>
                <td className="px-2 py-2">
                  <Bars values={p.weekly} />
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {p.cmsPageId ? (
                    <Link
                      className="text-ui-accent text-xs"
                      href={`/admin/pages/${p.cmsPageId}`}
                    >
                      Edit
                    </Link>
                  ) : null}{" "}
                  <a
                    className="text-ui-text-muted inline-flex items-center"
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${p.path} on the site`}
                  >
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Bars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <svg
      viewBox={`0 0 ${values.length * 5} 20`}
      className="h-5 w-20"
      aria-hidden="true"
    >
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * 5}
          y={20 - (v / max) * 20}
          width={4}
          height={(v / max) * 20}
          fill="var(--ui-accent)"
          opacity={0.7}
        />
      ))}
    </svg>
  );
}

// -------------------------------------------------------- Keywords and AEO

export function SeoKeywordsTab({
  keywords,
  lastPull,
  aeo,
  untracked,
}: {
  keywords: KeywordRow[];
  lastPull: string | null;
  aeo: {
    checked: number;
    withOverview: number;
    citeSite: number;
    youtubeOnly: number;
    neither: number;
  };
  untracked: Mover[];
}) {
  const cited = (k: KeywordRow) =>
    k.aiOverview === null
      ? "not checked"
      : !k.aiOverview
        ? "no AI Overview"
        : k.citesSite
          ? "site"
          : k.citesYouTube
            ? "YouTube only"
            : "no";
  return (
    <div className="space-y-5">
      <AdminMetricStrip columns={4}>
        <AdminMetricPanel
          label="Primary keywords checked"
          value={n(aeo.checked)}
          caption={
            lastPull
              ? `last DataForSEO pull ${lastPull}`
              : "DataForSEO not connected yet"
          }
        />
        <AdminMetricPanel
          label="Show an AI Overview"
          value={n(aeo.withOverview)}
          caption="of the checked primary keywords"
        />
        <AdminMetricPanel
          label="AI Overview cites the VP site"
          value={n(aeo.citeSite)}
          caption="the AEO win condition"
        />
        <AdminMetricPanel
          label="Cites VP YouTube only"
          value={n(aeo.youtubeOnly)}
          caption={`pair page + video; ${n(aeo.neither)} cite neither`}
        />
      </AdminMetricStrip>
      <section className={adminPanelClass}>
        <p className="text-ui-text-subtle px-4 pt-3 text-xs">
          Search Console position is the 28-day average for that exact query
          (history from 2025-11-26). Rank is DataForSEO&apos;s live US result;
          its history starts at the first weekly pull.
        </p>
        <div className="max-h-[36rem] overflow-auto">
          <table className="mt-2 w-full text-sm">
            <thead className={`${adminStickyHeadClass} sticky top-0`}>
              <tr className="text-ui-text-subtle text-left text-xs">
                <th className="px-4 py-2">Keyword</th>
                <th className="px-2 py-2">Piece</th>
                <th className="px-2 py-2 text-right">Volume</th>
                <th className="px-2 py-2 text-right">KD</th>
                <th className="px-2 py-2 text-right">GSC position</th>
                <th className="px-2 py-2 text-right">Rank</th>
                <th className="px-4 py-2">VP cited in AI Overview</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {keywords.map((k) => (
                <tr key={k.keyword}>
                  <td className="text-ui-text px-4 py-1.5">
                    {k.keyword}
                    {k.role === "primary" ? (
                      <span className="text-ui-text-subtle ml-1 text-xs">
                        primary
                      </span>
                    ) : null}
                  </td>
                  <td className="text-ui-text-muted px-2 py-1.5 text-xs">
                    {k.pieceIds.join(", ")}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {n(k.volume)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {n(k.kd)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {k.gscImpressions ? n(k.gscPosition, 1) : "not shown"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {k.checked ? (k.rank === null ? "100+" : n(k.rank)) : "n/a"}
                    {k.rank !== null &&
                    k.rankBefore !== null &&
                    k.rank !== k.rankBefore ? (
                      <span className="ml-1">
                        <AdminDeltaChip
                          tone={k.rank < k.rankBefore ? "up" : "down"}
                        >{`${k.rankBefore - k.rank > 0 ? "+" : ""}${k.rankBefore - k.rank}`}</AdminDeltaChip>
                      </span>
                    ) : null}
                  </td>
                  <td className="text-ui-text-muted px-4 py-1.5 text-xs">
                    {cited(k)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <MoverTable
        title="Top untracked, non-brand queries (28 days)"
        rows={untracked}
      />
    </div>
  );
}

// ------------------------------------------------------------ Content plan

const PIECE_STATUSES = [
  "planned",
  "drafting",
  "in_review",
  "verify_needed",
  "scheduled",
  "published",
  "refreshing",
] as const;
const label = (s: string) => s.replace(/_/g, " ");

export function SeoPlanTab({
  plan,
  canEdit,
}: {
  plan: ContentPlan;
  canEdit: boolean;
}) {
  const live = plan.pieces.filter((p) => p.live).length;
  const p1 = plan.pieces.filter(
    (p) => p.priority === "P1" && !p.notes?.startsWith("Same page"),
  );
  const chartDays = plan.burnUp.map((b) => `W${b.week}`);
  return (
    <div className="space-y-5">
      <AdminMetricStrip columns={4}>
        <AdminMetricPanel
          label="Live pieces"
          value={`${live} / ${plan.hubs.reduce((s, h) => s + h.total, 0)}`}
          caption="published /resources pages in the plan"
        />
        <AdminMetricPanel
          label="P1 live"
          value={`${p1.filter((p) => p.live).length} / ${p1.length}`}
          caption="weeks 1-10"
        />
        <AdminMetricPanel
          label="Drafts waiting on VERIFY"
          value={n(
            plan.pieces.filter((p) => p.verify_flags > 0 && !p.live).length,
          )}
          caption={`${n(plan.pieces.reduce((s, p) => s + (p.live ? 0 : p.verify_flags), 0))} flags to clear`}
        />
        <AdminMetricPanel
          label="Live pages under 2 live inbound links"
          value={n(
            plan.pieces.filter((p) => p.live && p.liveInbound < 2).length,
          )}
          caption="interlinking health"
        />
      </AdminMetricStrip>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className={`${adminCardClass} lg:col-span-2`}>
          <h2 className="text-ui-text text-sm font-semibold">
            Production vs plan
          </h2>
          <BurnUp rows={plan.burnUp} labels={chartDays} />
        </section>
        <section className={adminCardClass}>
          <h2 className="text-ui-text text-sm font-semibold">Hub coverage</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {plan.hubs.map((h) => (
              <li key={h.hub} className="flex items-center gap-2">
                <span className="text-ui-text-muted w-14">Hub {h.hub}</span>
                <span className="bg-ui-line relative h-2 flex-1 overflow-hidden rounded-full">
                  <span
                    className="bg-ui-ok absolute inset-y-0 left-0"
                    style={{
                      width: `${h.total ? (h.live / h.total) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span className="w-12 text-right tabular-nums">
                  {h.live}/{h.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className={adminPanelClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={adminStickyHeadClass}>
              <tr className="text-ui-text-subtle text-left text-xs">
                <th className="px-4 py-2">Piece</th>
                <th className="px-2 py-2">Primary keyword</th>
                <th className="px-2 py-2">Week</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Live links in</th>
                <th className="px-4 py-2">Draft</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {plan.pieces.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-1.5">
                    <span className="text-ui-text-subtle mr-2 text-xs tabular-nums">
                      {p.id}
                    </span>
                    {p.live ? (
                      <a
                        className="text-ui-accent"
                        href={`${SITE}/resources/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {p.title}
                      </a>
                    ) : (
                      <span className="text-ui-text">{p.title}</span>
                    )}
                    {p.cmsPageId ? (
                      <Link
                        className="text-ui-text-muted ml-2 text-xs"
                        href={`/admin/pages/${p.cmsPageId}`}
                      >
                        Edit
                      </Link>
                    ) : null}
                  </td>
                  <td className="text-ui-text-muted px-2 py-1.5 text-xs">
                    {p.primary_keyword}
                  </td>
                  <td className="px-2 py-1.5 text-xs tabular-nums">
                    {p.priority} {p.sequence_week ? `w${p.sequence_week}` : ""}
                  </td>
                  <td className="px-2 py-1.5 text-xs">
                    {p.live ? (
                      <span className="text-ui-ok font-medium">
                        live {p.liveSince}
                      </span>
                    ) : canEdit ? (
                      <form
                        action={updatePieceStatus}
                        className="flex items-center gap-1"
                      >
                        <input type="hidden" name="id" value={p.id} />
                        <select
                          name="status"
                          defaultValue={p.status}
                          aria-label={`Status of ${p.id}`}
                          className="rounded-ui border-ui-line border bg-transparent px-1 py-0.5 text-xs"
                        >
                          {PIECE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {label(s)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="text-ui-accent text-xs"
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      label(p.status)
                    )}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right text-xs tabular-nums ${p.live && p.liveInbound < 2 ? "text-ui-bad font-medium" : ""}`}
                  >
                    {p.liveInbound} / {p.plannedInbound}
                  </td>
                  <td className="text-ui-text-subtle px-4 py-1.5 text-xs">
                    {p.draft_file
                      ? `${p.draft_file}${p.verify_flags ? ` (${p.verify_flags} VERIFY)` : ""}`
                      : (p.notes ?? "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-ui-text-subtle px-4 py-2 text-xs">
          Drafts live in Desktop/vp-seo-output/02-p1-drafts/. A piece turns live
          on its own when /resources/&#123;slug&#125; is published in the page
          builder.
        </p>
      </section>
    </div>
  );
}

function BurnUp({
  rows,
  labels,
}: {
  rows: ContentPlan["burnUp"];
  labels: string[];
}) {
  // Weeks as pseudo-days so the shared chart can draw them.
  const start = Date.parse("2026-09-28T00:00:00Z");
  const days = rows.map((r) =>
    new Date(start + (r.week - 1) * 7 * 86_400_000).toISOString().slice(0, 10),
  );
  void labels;
  return (
    <SeoTrendChart
      ariaLabel="Pieces planned vs live, cumulative by week"
      days={days}
      series={[
        { label: "Planned", color: C.idle, values: rows.map((r) => r.planned) },
        {
          label: "Live",
          color: C.ok,
          values: rows.map((r) => (r.live < 0 ? null : r.live)),
        },
      ]}
    />
  );
}

// ------------------------------------------------------------------- Tasks

const TYPES = [
  "publish",
  "refresh",
  "optimize",
  "optimize_ctr",
  "add_links",
  "aeo_pairing",
  "verify_facts",
  "technical",
  "outreach",
];

export function SeoTasksTab({
  tasks,
  canEdit,
  status,
  today,
}: {
  tasks: Tables<"seo_tasks">[];
  canEdit: boolean;
  status: string;
  today: string;
}) {
  const weekEnd = new Date(Date.parse(`${today}T00:00:00Z`) + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const overdue = tasks.filter(
    (t) => t.due_date && t.due_date < today && t.status !== "done",
  );
  const thisWeek = tasks.filter(
    (t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd,
  );
  return (
    <div className="space-y-5">
      <AdminMetricStrip columns={4}>
        <AdminMetricPanel
          label="Showing"
          value={n(tasks.length)}
          caption={`${status} tasks`}
        />
        <AdminMetricPanel
          label="Overdue"
          value={n(overdue.length)}
          caption="due before today"
        />
        <AdminMetricPanel
          label="Due this week"
          value={n(thisWeek.length)}
          caption={`through ${weekEnd}`}
        />
        <AdminMetricPanel
          label="From Kody's triggers"
          value={n(tasks.filter((t) => t.trigger_code).length)}
          caption="opened by the Monday job"
        />
      </AdminMetricStrip>
      <nav className="flex flex-wrap gap-2 text-xs" aria-label="Task filter">
        {(["open", "done", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/seo?tab=tasks&status=${s}`}
            className={`rounded-ui border px-2 py-1 ${s === status ? "border-ui-accent text-ui-accent" : "border-ui-line text-ui-text-muted"}`}
          >
            {s}
          </Link>
        ))}
        {TYPES.map((t) => (
          <Link
            key={t}
            href={`/admin/seo?tab=tasks&status=${status}&type=${t}`}
            className="rounded-ui border-ui-line text-ui-text-muted border px-2 py-1"
          >
            {label(t)}
          </Link>
        ))}
      </nav>
      <ul className="space-y-3">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            canEdit={canEdit}
            overdue={Boolean(
              t.due_date && t.due_date < today && t.status !== "done",
            )}
          />
        ))}
      </ul>
      {canEdit ? <NewTaskForm /> : null}
    </div>
  );
}

function TaskCard({
  task,
  canEdit,
  overdue,
}: {
  task: Tables<"seo_tasks">;
  canEdit: boolean;
  overdue: boolean;
}) {
  const evidence =
    task.evidence &&
    typeof task.evidence === "object" &&
    !Array.isArray(task.evidence)
      ? Object.entries(task.evidence).filter(([k]) => k !== "seenAt")
      : [];
  const link = task.url
    ? task.url.startsWith("/")
      ? `${SITE}${task.url}`
      : task.url
    : null;
  return (
    <li className={adminCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-text text-sm font-semibold">{task.title}</p>
          <p className="text-ui-text-subtle mt-0.5 text-xs">
            {label(task.type)} · {task.priority}
            {task.trigger_code
              ? ` · trigger ${task.trigger_code} (${TRIGGER_NAMES[task.trigger_code as TriggerCode]})`
              : ""}
            {task.due_date ? (
              <span className={overdue ? "text-ui-bad font-medium" : ""}>
                {" "}
                · due {task.due_date}
              </span>
            ) : null}
            {task.owner ? ` · ${task.owner}` : ""} · {label(task.status)}
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-1.5">
            {task.status !== "in_progress" && task.status !== "done" ? (
              <StatusButton id={task.id} status="in_progress" text="Start" />
            ) : null}
            {task.status !== "done" ? (
              <StatusButton id={task.id} status="done" text="Mark done" />
            ) : (
              <StatusButton id={task.id} status="open" text="Reopen" />
            )}
            {task.status !== "dismissed" && task.status !== "done" ? (
              <StatusButton id={task.id} status="dismissed" text="Dismiss" />
            ) : null}
          </div>
        ) : null}
      </div>
      {task.detail ? (
        <p className="text-ui-text-muted mt-2 text-sm whitespace-pre-line">
          {task.detail}
        </p>
      ) : null}
      {task.trigger_code && !task.detail ? (
        <p className="text-ui-text-muted mt-2 text-sm">
          {PLAYBOOK[task.trigger_code as TriggerCode]}
        </p>
      ) : null}
      {evidence.length ? (
        <p className="text-ui-text-subtle mt-2 text-xs tabular-nums">
          {evidence.map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </p>
      ) : null}
      {link ? (
        <a
          className="text-ui-accent mt-2 inline-flex items-center gap-1 text-xs"
          href={link}
          target="_blank"
          rel="noreferrer"
        >
          {link.replace(SITE, "")}
        </a>
      ) : null}
      {task.metrics_at_done ? <OptimizationLog task={task} /> : null}
    </li>
  );
}

function OptimizationLog({ task }: { task: Tables<"seo_tasks"> }) {
  const cols: Array<[string, unknown]> = [
    ["At done", task.metrics_at_done],
    ["+14 days", task.metrics_after_14],
    ["+28 days", task.metrics_after_28],
  ];
  return (
    <table className="mt-3 text-xs tabular-nums">
      <thead>
        <tr className="text-ui-text-subtle">
          <th className="pr-4 text-left">Optimization log</th>
          <th className="pr-4">Impr. 28d</th>
          <th className="pr-4">Clicks</th>
          <th className="pr-4">CTR</th>
          <th>Position</th>
        </tr>
      </thead>
      <tbody>
        {cols.map(([name, m]) => {
          const v = (m ?? {}) as Record<string, number | null>;
          return (
            <tr key={name}>
              <td className="text-ui-text-muted pr-4">{name}</td>
              <td className="pr-4 text-center">
                {m ? n(v.impressions28) : "pending"}
              </td>
              <td className="pr-4 text-center">{m ? n(v.clicks28) : ""}</td>
              <td className="pr-4 text-center">
                {m && v.ctrPct !== null ? `${v.ctrPct}%` : ""}
              </td>
              <td className="text-center">{m ? n(v.position, 1) : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function StatusButton({
  id,
  status,
  text,
}: {
  id: string;
  status: string;
  text: string;
}) {
  return (
    <form action={updateTaskStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={adminSmallButtonClass}>
        {text}
      </button>
    </form>
  );
}

function NewTaskForm() {
  return (
    <details className={adminCardClass}>
      <summary className="text-ui-text cursor-pointer text-sm font-semibold">
        Add a task
      </summary>
      <form action={addTask} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          Title
          <input
            name="title"
            required
            minLength={3}
            maxLength={300}
            className={adminInputClass}
          />
        </label>
        <label className="text-sm">
          Type
          <select
            name="type"
            className={adminInputClass}
            defaultValue="optimize"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Priority
          <select
            name="priority"
            className={adminInputClass}
            defaultValue="medium"
          >
            {["urgent", "high", "medium", "low"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Page URL or path
          <input
            name="url"
            maxLength={500}
            placeholder="/resources/..."
            className={adminInputClass}
          />
        </label>
        <label className="text-sm">
          Owner
          <input name="owner" maxLength={120} className={adminInputClass} />
        </label>
        <label className="text-sm">
          Due
          <input name="due_date" type="date" className={adminInputClass} />
        </label>
        <label className="text-sm sm:col-span-2">
          Detail
          <textarea
            name="detail"
            rows={3}
            maxLength={4000}
            className={adminInputClass}
          />
        </label>
        <div>
          <button type="submit" className={adminPrimaryButtonClass}>
            Add task
          </button>
        </div>
      </form>
    </details>
  );
}

// ------------------------------------------------------------------ Social

export function SeoSocialTab({
  data,
  allBrands,
}: {
  data: SeoSocial;
  allBrands: boolean;
}) {
  const days = data.visibility.map((v) => v.day);
  return (
    <div className="space-y-5">
      <nav className="flex gap-2 text-xs" aria-label="Brands">
        <Link
          href="/admin/seo?tab=social"
          className={`rounded-ui border px-2 py-1 ${!allBrands ? "border-ui-accent text-ui-accent" : "border-ui-line text-ui-text-muted"}`}
        >
          Vendingpreneurs brand
        </Link>
        <Link
          href="/admin/seo?tab=social&brands=all"
          className={`rounded-ui border px-2 py-1 ${allBrands ? "border-ui-accent text-ui-accent" : "border-ui-line text-ui-text-muted"}`}
        >
          All brands (incl. Mike)
        </Link>
      </nav>
      <section className={adminPanelClass}>
        <table className="w-full text-sm">
          <thead className={adminStickyHeadClass}>
            <tr className="text-ui-text-subtle text-left text-xs">
              <th className="px-4 py-2">Network</th>
              <th className="px-2 py-2 text-right">Followers</th>
              <th className="px-2 py-2 text-right">28-day change</th>
              <th className="px-2 py-2 text-right">
                Impressions / views, 28 days
              </th>
              <th className="px-2 py-2 text-right">Interactions</th>
              <th className="px-4 py-2 text-right">Posts</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {data.networks.map((s) => (
              <tr key={s.network}>
                <td className="text-ui-text px-4 py-2 capitalize">
                  {s.network === "twitter" ? "X" : s.network}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(s.followers)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {s.followersChange === null
                    ? "n/a"
                    : `${s.followersChange > 0 ? "+" : ""}${n(s.followersChange)}`}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(s.impressions28)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(s.interactions28)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {n(s.posts28)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-ui-text-subtle px-4 py-2 text-xs">
          Metricool account series through {data.asOf ?? "n/a"}. History starts
          where Metricool&apos;s does (Instagram about August 2026, YouTube
          about June 2026). A network a brand has not connected shows no row.
          YouTube counts views.
        </p>
      </section>
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">
          Brand visibility: Google + social, per day
        </h2>
        <SeoTrendChart
          ariaLabel="Google impressions and social impressions per day, stacked"
          stacked
          days={days}
          series={[
            {
              label: "Google impressions",
              color: C.accent,
              values: data.visibility.map((v) => v.google),
            },
            {
              label: "Social impressions and views",
              color: C.ok,
              values: data.visibility.map((v) => v.social),
            },
          ]}
        />
      </section>
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">
          Does social lift branded search?
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Branded Google impressions against social impressions. Read the shapes
          together, not as cause.
        </p>
        <SeoTrendChart
          ariaLabel="Branded search impressions against social impressions per day"
          days={days}
          series={[
            {
              label: "Branded Google impressions",
              color: C.accent,
              values: data.visibility.map((v) => v.brandSearch),
            },
            {
              label: "Social impressions / 100",
              color: C.warn,
              values: data.visibility.map((v) => Math.round(v.social / 100)),
            },
          ]}
        />
      </section>
    </div>
  );
}

// ----------------------------------------------------------------- Roadmap

const REVIEW_QUESTIONS: Array<[string, string]> = [
  [
    "worked",
    "What worked: top pages by clicks gained, and what we did to them",
  ],
  [
    "didnt",
    "What didn't: pages refreshed with no movement after 28 days, and why",
  ],
  ["backlog", "Trigger backlog: open triggers by type"],
  [
    "competitive",
    "Competitive landscape: new entrants in a hub's top 5, AI Overview gained or lost",
  ],
  [
    "decisions",
    "Decisions, each with an owner: sequence moves, retargets, merges, new pieces, outreach, tooling, Google Ads support",
  ],
  ["priorities", "Next month's top 5 priorities"],
];

export function SeoRoadmapTab({
  items,
  reviews,
  canEdit,
  month,
}: {
  items: Tables<"seo_tasks">[];
  reviews: Tables<"seo_monthly_reviews">[];
  canEdit: boolean;
  month: string;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {ROADMAP_PHASES.map((phase) => {
          const list = items.filter((i) => i.phase === phase);
          if (list.length === 0) return null;
          return (
            <section key={phase} className={adminCardClass}>
              <h2 className="text-ui-text text-sm font-semibold">
                {phase}{" "}
                <span className="text-ui-text-subtle font-normal">
                  {list.filter((i) => i.status === "done").length}/{list.length}
                </span>
              </h2>
              <ul className="mt-3 space-y-3">
                {list.map((item) => (
                  <li key={item.id} className="flex items-start gap-3">
                    {canEdit ? (
                      <form action={updateTaskStatus}>
                        <input type="hidden" name="id" value={item.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={item.status === "done" ? "open" : "done"}
                        />
                        <button
                          type="submit"
                          aria-label={`${item.status === "done" ? "Reopen" : "Complete"}: ${item.title}`}
                          className={`rounded-ui mt-0.5 h-4 w-4 border ${item.status === "done" ? "bg-ui-ok border-ui-ok" : "border-ui-line-strong"}`}
                        />
                      </form>
                    ) : (
                      <span
                        className={`rounded-ui mt-0.5 h-4 w-4 border ${item.status === "done" ? "bg-ui-ok border-ui-ok" : "border-ui-line-strong"}`}
                      />
                    )}
                    <div>
                      <p
                        className={`text-sm ${item.status === "done" ? "text-ui-text-subtle line-through" : "text-ui-text"}`}
                      >
                        {item.title}
                      </p>
                      {item.detail ? (
                        <p className="text-ui-text-muted mt-0.5 text-xs">
                          {item.detail}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">
          Monthly SEO review
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          First Monday of each month. Saving stores this month&apos;s Search
          Console, rank and AI Overview numbers with the answers.
        </p>
        {canEdit ? (
          <form action={saveMonthlyReview} className="mt-3 space-y-3">
            <label className="block text-sm">
              Month
              <input
                type="month"
                name="month"
                defaultValue={month}
                required
                className={adminInputClass}
              />
            </label>
            {REVIEW_QUESTIONS.map(([key, q]) => (
              <label key={key} className="block text-sm">
                {q}
                <textarea
                  name={`q_${key}`}
                  rows={2}
                  maxLength={4000}
                  className={adminInputClass}
                />
              </label>
            ))}
            <button type="submit" className={adminPrimaryButtonClass}>
              Save review
            </button>
          </form>
        ) : null}
        {reviews.length ? (
          <ul className="divide-ui-line mt-4 divide-y text-sm">
            {reviews.map((r) => (
              <li key={r.month} className="py-2">
                <p className="text-ui-text font-medium">
                  {r.month.slice(0, 7)}{" "}
                  <span className="text-ui-text-subtle text-xs font-normal">
                    {r.reviewed_by}
                  </span>
                </p>
                {Object.entries((r.answers ?? {}) as Record<string, string>)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <p key={k} className="text-ui-text-muted mt-1 text-xs">
                      <span className="text-ui-text-subtle">{k}:</span> {v}
                    </p>
                  ))}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className={`${adminCardClass} text-ui-text-muted text-xs`}>
        <p className="text-ui-text text-sm font-semibold">
          Tool stack and paid rules (Kody, 2026-09-23)
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            DataForSEO now for ranks and AI Overviews. Ahrefs and Profound after
            20+ pages are live.
          </li>
          <li>
            Google Ads: core conversion queries, direct competitor terms and a
            brand campaign. No broad match, no AI expansion. UTM the triggering
            search term.
          </li>
          <li>
            Don&apos;t touch a page in its first 6 weeks; the trigger job
            already skips them.
          </li>
        </ul>
      </section>
    </div>
  );
}
