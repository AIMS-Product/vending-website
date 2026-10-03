import type { ReactNode } from "react";
import {
  AdminBar,
  AdminDeltaChip,
  AdminStatusBadge,
  adminPanelClass,
} from "@/components/admin/AdminUi";
import {
  type KeywordRow,
  type Mover,
  type SeoKeywords,
} from "@/lib/services/seo-command-center";
import { n, MoverTable } from "./shared";

/*
 * The tracked keywords as one ranked list: volume as a bar, where VP ranks,
 * and whether Google's AI Overview cites VP, as a chip. Everything else a
 * keyword carries (piece, difficulty, Search Console position) opens under
 * its row. Competitor gaps and untracked queries are research, not status,
 * so they start closed.
 */

// Phone: the keyword takes the first line, rank and chip the second.
const GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_9rem_5.5rem_8.5rem]";

function AiChip({ k }: { k: KeywordRow }) {
  if (k.aiOverview === null)
    return <AdminStatusBadge status="idle" tone="idle" label="Not checked" />;
  if (!k.aiOverview)
    return (
      <AdminStatusBadge status="idle" tone="idle" label="No AI Overview" />
    );
  if (k.citesSite)
    return <AdminStatusBadge status="ok" tone="ok" label="Cites VP site" />;
  if (k.citesYouTube)
    return <AdminStatusBadge status="warn" tone="warn" label="VP YouTube" />;
  return <AdminStatusBadge status="bad" tone="bad" label="Cites others" />;
}

function Rank({ k }: { k: KeywordRow }) {
  const moved =
    k.rank !== null && k.rankBefore !== null && k.rank !== k.rankBefore
      ? k.rankBefore - k.rank
      : null;
  return (
    <span className="flex items-center gap-1.5 pl-5 tabular-nums sm:justify-end sm:pl-0">
      <span
        className={k.rank === null ? "text-ui-text-subtle" : "text-ui-text"}
      >
        {!k.checked ? "n/a" : k.rank === null ? "100+" : `#${k.rank}`}
      </span>
      {moved !== null ? (
        <AdminDeltaChip tone={moved > 0 ? "up" : "down"}>
          {`${moved > 0 ? "+" : ""}${moved}`}
        </AdminDeltaChip>
      ) : null}
    </span>
  );
}

function KeywordList({ keywords }: { keywords: KeywordRow[] }) {
  const maxVolume = Math.max(1, ...keywords.map((k) => k.volume ?? 0));
  const cited = keywords.filter((k) => k.citesSite).length;
  const ranked = keywords.filter((k) => k.rank !== null && k.rank <= 10).length;
  return (
    <section className={adminPanelClass} aria-labelledby="kw-title">
      <header className="border-ui-line flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 id="kw-title" className="text-ui-text text-sm font-semibold">
          Tracked keywords, by search volume
        </h2>
        <p className="text-ui-text-muted text-xs tabular-nums">
          {n(keywords.length)} tracked · {n(ranked)} in the top 10 · {n(cited)}{" "}
          cited in an AI Overview
        </p>
      </header>
      <div
        className={`${GRID} text-ui-text-subtle border-ui-line hidden border-b px-4 py-2 text-xs sm:grid`}
      >
        <span>Keyword</span>
        <span className="hidden sm:block">Monthly searches</span>
        <span className="text-right">Google rank</span>
        <span>AI Overview</span>
      </div>
      <ul className="divide-ui-line max-h-[40rem] divide-y overflow-auto">
        {keywords.map((k) => (
          <li key={k.keyword}>
            <details className="group">
              <summary
                className={`${GRID} hover:bg-ui-canvas cursor-pointer list-none px-4 py-2.5 text-[0.8125rem]`}
              >
                <span className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                  <svg
                    viewBox="0 0 12 12"
                    className="text-ui-text-subtle size-3 shrink-0 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  >
                    <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" />
                  </svg>
                  <span className="text-ui-text truncate">{k.keyword}</span>
                  {k.role === "primary" ? (
                    <span className="text-ui-text-subtle border-ui-line rounded-ui shrink-0 border px-1.5 text-[0.6875rem]">
                      primary
                    </span>
                  ) : null}
                </span>
                <span className="hidden items-center gap-2 sm:flex">
                  <span className="text-ui-text w-12 shrink-0 text-right tabular-nums">
                    {n(k.volume)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <AdminBar share={(k.volume ?? 0) / maxVolume} />
                  </span>
                </span>
                <Rank k={k} />
                <span className="justify-self-end sm:justify-self-auto">
                  <AiChip k={k} />
                </span>
              </summary>
              <dl className="bg-ui-canvas text-ui-text-muted grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 pl-9 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-ui-text-subtle">Content piece</dt>
                  <dd className="text-ui-text mt-0.5">
                    {k.pieceIds.length ? k.pieceIds.join(", ") : "None yet"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ui-text-subtle">Difficulty (KD)</dt>
                  <dd className="text-ui-text mt-0.5 tabular-nums">
                    {n(k.kd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ui-text-subtle">
                    Search Console, 28 days
                  </dt>
                  <dd className="text-ui-text mt-0.5 tabular-nums">
                    {k.gscImpressions
                      ? `position ${n(k.gscPosition, 1)} · ${n(k.gscImpressions)} impressions`
                      : "Not shown for this exact query"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ui-text-subtle">
                    Live rank (DataForSEO)
                  </dt>
                  <dd className="text-ui-text mt-0.5 tabular-nums">
                    {!k.checked
                      ? "Not checked yet"
                      : `${k.rank === null ? "Not in the top 100" : `#${k.rank}`}${k.rankBefore !== null ? `, was #${k.rankBefore}` : ""} · ${k.checked}`}
                  </dd>
                </div>
              </dl>
            </details>
          </li>
        ))}
      </ul>
      <p className="text-ui-text-subtle border-ui-line border-t px-4 py-2 text-xs">
        Google rank is DataForSEO&apos;s live US result, history from the first
        weekly pull. Search Console position (inside each row) is the 28-day
        average for that exact query, history from 2025-11-26.
      </p>
    </section>
  );
}

function Collapsed({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <details className={`${adminPanelClass} group`}>
      <summary className="text-ui-text hover:bg-ui-canvas flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
        <span>
          {title}{" "}
          <span className="text-ui-text-subtle font-normal tabular-nums">
            {n(count)}
          </span>
        </span>
        <span className="text-ui-text-subtle text-xs font-normal group-open:hidden">
          Show
        </span>
        <span className="text-ui-text-subtle hidden text-xs font-normal group-open:inline">
          Hide
        </span>
      </summary>
      <div className="border-ui-line border-t">{children}</div>
    </details>
  );
}

export function SeoKeywordsTab({
  keywords,
  untracked,
  gaps,
  competitorMonth,
  spend,
}: {
  keywords: KeywordRow[];
  gaps: SeoKeywords["gaps"];
  competitorMonth: string | null;
  spend: SeoKeywords["spend"];
  untracked: Mover[];
}) {
  const maxGap = Math.max(1, ...gaps.map((g) => g.volume ?? 0));
  return (
    <div className="space-y-5">
      <KeywordList keywords={keywords} />
      <Collapsed
        title="Competitor keywords VP neither tracks nor ranks for"
        count={gaps.length}
      >
        {gaps.length === 0 ? (
          <p className="text-ui-text-subtle px-4 py-3 text-xs">
            {competitorMonth
              ? "No gaps in the latest pull."
              : "First pull runs with the first monthly DataForSEO run."}
          </p>
        ) : (
          <ul className="divide-ui-line divide-y text-[0.8125rem]">
            {gaps.map((g) => (
              <li
                key={g.keyword}
                className="grid grid-cols-[minmax(0,1fr)_8rem_2.5rem] items-center gap-3 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_10rem_2.5rem_minmax(0,12rem)]"
              >
                <span className="text-ui-text truncate" title={g.keyword}>
                  {g.keyword}
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-right tabular-nums">
                    {n(g.volume)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <AdminBar share={(g.volume ?? 0) / maxGap} />
                  </span>
                </span>
                <span className="text-right tabular-nums">#{g.best}</span>
                <span className="text-ui-text-muted hidden truncate text-xs sm:block">
                  {g.domains.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-ui-text-subtle border-ui-line border-t px-4 py-2 text-xs">
          Top-10 keywords for vendsoft, upflip or wendor. DataForSEO this month:
          ${spend.usd.toFixed(2)} of the ${spend.budgetUsd} cap
          {competitorMonth
            ? `; competitors as of ${competitorMonth.slice(0, 7)}`
            : ""}
          . The weekly job stops pulling once the cap is reached.
        </p>
      </Collapsed>
      <Collapsed
        title="Untracked non-brand queries people found VP with, 28 days"
        count={untracked.length}
      >
        <MoverTable title="Queries" rows={untracked} bare />
      </Collapsed>
    </div>
  );
}
