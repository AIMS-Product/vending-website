import {
  AdminDeltaChip,
  AdminMetricPanel,
  AdminMetricStrip,
  adminPanelClass,
  adminStickyHeadClass,
} from "@/components/admin/AdminUi";
import {
  type KeywordRow,
  type Mover,
  type SeoKeywords,
} from "@/lib/services/seo-command-center";
import { n, MoverTable } from "./shared";

export function SeoKeywordsTab({
  keywords,
  lastPull,
  aeo,
  untracked,
  gaps,
  competitorMonth,
  spend,
}: {
  keywords: KeywordRow[];
  gaps: SeoKeywords["gaps"];
  competitorMonth: string | null;
  spend: SeoKeywords["spend"];
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
      <section className={adminPanelClass}>
        <h3 className="text-ui-text border-ui-line border-b px-4 py-2.5 text-sm font-semibold">
          Competitor gaps: top-10 keywords for vendsoft, upflip or wendor that
          VP neither tracks nor ranks for
        </h3>
        {gaps.length === 0 ? (
          <p className="text-ui-text-subtle px-4 py-3 text-xs">
            {competitorMonth
              ? "No gaps in the latest pull."
              : "First pull runs with the first monthly DataForSEO run."}
          </p>
        ) : (
          <table className="w-full table-fixed text-sm">
            <tbody className="divide-ui-line divide-y">
              {gaps.map((g) => (
                <tr key={g.keyword}>
                  <td
                    className="text-ui-text w-1/2 truncate px-4 py-1.5"
                    title={g.keyword}
                  >
                    {g.keyword}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {n(g.volume)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    #{g.best}
                  </td>
                  <td className="text-ui-text-muted truncate px-4 py-1.5 text-xs">
                    {g.domains.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-ui-text-subtle px-4 py-2 text-xs">
          DataForSEO this month: ${spend.usd.toFixed(2)} of the $
          {spend.budgetUsd} cap
          {competitorMonth
            ? `; competitors as of ${competitorMonth.slice(0, 7)}`
            : ""}
          . The weekly job stops pulling once the cap is reached.
        </p>
      </section>
      <MoverTable
        title="Top untracked, non-brand queries (28 days)"
        rows={untracked}
      />
    </div>
  );
}
