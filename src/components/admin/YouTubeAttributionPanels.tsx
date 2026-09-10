import {
  AdminBar,
  adminCardClass,
  adminEyebrowClass,
} from "@/components/admin/AdminUi";
import type { YouTubeAttribution } from "@/lib/services/youtube-attribution";
import type {
  YouTubeCohortRow,
  YouTubeCoverage,
  YouTubeStage,
  YouTubeTimeToClose,
  YouTubeVideoFunnelRow,
} from "@/lib/services/youtube-attribution-rollup";

/**
 * "Not measured" and "measured, and it was zero" are different facts, and the
 * whole tab depends on never confusing them: a dash means no data source is
 * connected for that stage yet.
 */
function num(value: number | null): string {
  return value === null ? "—" : value.toLocaleString();
}

function pct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

/** The six-stage funnel, with the gaps left visibly empty. */
export function YouTubeStageFunnel({ stages }: { stages: YouTubeStage[] }) {
  const top = stages.find((stage) => stage.count !== null)?.count ?? 0;

  return (
    <section className={adminCardClass} aria-label="YouTube funnel by stage">
      <h2 className={adminEyebrowClass}>Click to close</h2>
      <ol className="mt-3 space-y-2.5">
        {stages.map((stage, index) => (
          <li key={stage.label} className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2 text-[0.8125rem]">
              <span className="text-ui-text min-w-0 flex-1 truncate">
                {stage.label}
                {stage.note ? (
                  <span className="text-ui-text-subtle"> · {stage.note}</span>
                ) : null}
              </span>
              <span className="text-ui-text shrink-0 font-semibold tabular-nums">
                {num(stage.count)}
              </span>
            </div>
            <AdminBar
              share={
                stage.count !== null && top > 0
                  ? Math.min(1, stage.count / top)
                  : 0
              }
            />
            {index > 0 ? (
              <p className="text-ui-text-subtle text-xs">
                {stage.ofPreviousPct === null
                  ? "Not connected yet — no conversion rate to show."
                  : `${stage.ofPreviousPct}% continued from the step above`}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The per-video table Kody asked for.
 *
 * Sorting is server-side and driven by a URL param so the page stays a Server
 * Component — the existing range and tab switchers already work this way.
 */
export function YouTubeVideoTable({
  rows,
  sortHref,
  activeSort,
}: {
  rows: YouTubeVideoFunnelRow[];
  sortHref: (sort: YouTubeVideoSort) => string;
  activeSort: YouTubeVideoSort;
}) {
  return (
    <section className={adminCardClass} aria-label="Per-video funnel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={adminEyebrowClass}>Every video that produced a lead</h2>
        <p className="text-ui-text-subtle text-xs">
          {rows.length} video{rows.length === 1 ? "" : "s"} in this range
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No YouTube leads in this range.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[64rem] text-[0.8125rem]">
            <thead>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                <th className="py-2 pr-3 font-semibold">Video</th>
                {YOUTUBE_VIDEO_COLUMNS.map((column) => (
                  <th
                    key={column.sort}
                    className="py-2 pr-3 text-right font-semibold"
                  >
                    <a
                      href={sortHref(column.sort)}
                      className="hover:text-ui-text"
                      aria-current={
                        activeSort === column.sort ? "true" : undefined
                      }
                      title={column.title}
                    >
                      {column.label}
                      {activeSort === column.sort ? " ↓" : ""}
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {rows.map((row) => (
                <tr key={row.utmCampaign}>
                  <td className="py-2.5 pr-3">
                    <span
                      className="text-ui-text block max-w-[22rem] truncate font-medium"
                      title={row.title}
                    >
                      {row.videoUrl ? (
                        <a
                          href={row.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {row.title}
                        </a>
                      ) : (
                        row.title
                      )}
                    </span>
                    <span className="text-ui-text-subtle block text-xs">
                      {row.utmCampaign}
                      {row.publishedAt ? ` · ${row.publishedAt}` : ""}
                      {row.inRegistry ? "" : " · not in registry"}
                    </span>
                  </td>
                  <Num value={row.clicks} />
                  <Num value={row.visits} />
                  <Num value={row.leads} />
                  <Num value={row.qualified} />
                  <Num value={row.booked} />
                  <Num value={row.attended} />
                  <Num value={row.closed} />
                  <Pct value={row.visitToLeadPct} />
                  <Pct value={row.leadToBookedPct} />
                  <Pct value={row.bookedToClosedPct} />
                  <td className="text-ui-text-muted py-2.5 pr-3 text-right tabular-nums">
                    {row.avgDaysToClose === null
                      ? "—"
                      : `${row.avgDaysToClose}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Num({ value }: { value: number | null }) {
  return (
    <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
      {num(value)}
    </td>
  );
}

function Pct({ value }: { value: number | null }) {
  return (
    <td className="text-ui-text py-2.5 pr-3 text-right font-semibold tabular-nums">
      {pct(value)}
    </td>
  );
}

export const YOUTUBE_VIDEO_SORTS = [
  "leads",
  "clicks",
  "visits",
  "qualified",
  "booked",
  "attended",
  "closed",
  "visit-to-lead",
  "lead-to-booked",
  "booked-to-closed",
  "days-to-close",
] as const;

export type YouTubeVideoSort = (typeof YOUTUBE_VIDEO_SORTS)[number];

const YOUTUBE_VIDEO_COLUMNS: Array<{
  sort: YouTubeVideoSort;
  label: string;
  title: string;
}> = [
  { sort: "clicks", label: "Clicks", title: "Bitly link clicks" },
  { sort: "visits", label: "Visits", title: "Tagged landing page visits" },
  { sort: "leads", label: "Leads", title: "Forms submitted" },
  { sort: "qualified", label: "Qual.", title: "Completed the questions" },
  { sort: "booked", label: "Booked", title: "Booked a sales call" },
  {
    sort: "attended",
    label: "Attended",
    title:
      "Booked minus no-show and cancelled — a derivation, not a Close field",
  },
  { sort: "closed", label: "Won", title: "Closed / won in Close" },
  { sort: "visit-to-lead", label: "Visit→lead", title: "Leads per visit" },
  { sort: "lead-to-booked", label: "Lead→book", title: "Bookings per lead" },
  { sort: "booked-to-closed", label: "Book→won", title: "Wins per booking" },
  {
    sort: "days-to-close",
    label: "Avg close",
    title: "Average days from first touch to won",
  },
];

export function parseYouTubeVideoSort(
  value: string | null | undefined,
): YouTubeVideoSort {
  const trimmed = value?.trim();
  return (YOUTUBE_VIDEO_SORTS as readonly string[]).includes(trimmed ?? "")
    ? (trimmed as YouTubeVideoSort)
    : "leads";
}

/** Sorts descending, with unmeasured values always last rather than as zero. */
export function sortYouTubeVideos(
  rows: YouTubeVideoFunnelRow[],
  sort: YouTubeVideoSort,
): YouTubeVideoFunnelRow[] {
  const valueOf = (row: YouTubeVideoFunnelRow): number | null => {
    switch (sort) {
      case "clicks":
        return row.clicks;
      case "visits":
        return row.visits;
      case "qualified":
        return row.qualified;
      case "booked":
        return row.booked;
      case "attended":
        return row.attended;
      case "closed":
        return row.closed;
      case "visit-to-lead":
        return row.visitToLeadPct;
      case "lead-to-booked":
        return row.leadToBookedPct;
      case "booked-to-closed":
        return row.bookedToClosedPct;
      case "days-to-close":
        return row.avgDaysToClose;
      default:
        return row.leads;
    }
  };

  return [...rows].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    if (left === null && right === null) return b.leads - a.leads;
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left || b.leads - a.leads;
  });
}

export function YouTubeTimeToCloseChart({
  timeToClose,
}: {
  timeToClose: YouTubeTimeToClose;
}) {
  const max = Math.max(1, ...timeToClose.buckets.map((b) => b.count));

  return (
    <section className={adminCardClass} aria-label="Time to close">
      <h2 className={adminEyebrowClass}>First touch to closed / won</h2>
      {timeToClose.measured === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No dated wins in this range yet.
          {timeToClose.undated > 0 ? (
            <>
              {" "}
              {timeToClose.undated} lead
              {timeToClose.undated === 1 ? " is" : "s are"} marked won in Close
              but carry no reliable won date, so no cycle can be measured for
              {timeToClose.undated === 1 ? " it" : " them"} yet.
            </>
          ) : null}
        </p>
      ) : (
        <>
          <p className="text-ui-text-subtle mt-2 text-xs">
            <span className="text-ui-text-muted font-medium">
              {timeToClose.medianDays} days median
            </span>{" "}
            · {timeToClose.avgDays} average · {timeToClose.longCycleCount} ran
            14 days or longer · {timeToClose.measured} measured
            {timeToClose.undated > 0
              ? ` · ${timeToClose.undated} won without a reliable date, excluded`
              : ""}
          </p>
          <ol className="mt-3 space-y-1.5">
            {timeToClose.buckets.map((bucket) => (
              <li key={bucket.label} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2 text-[0.8125rem]">
                  <span className="text-ui-text min-w-0 flex-1">
                    {bucket.label}
                  </span>
                  <span className="text-ui-text shrink-0 font-semibold tabular-nums">
                    {bucket.count}
                  </span>
                </div>
                <AdminBar share={bucket.count / max} />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/**
 * Leads by the month they FIRST engaged, with wins split by whether they landed
 * in that same month or a later one — the distortion Kody described, where a
 * 1-3 week cycle makes a good month look flat until the next one.
 */
export function YouTubeCohortTable({
  cohorts,
  outcomesConnected,
}: {
  cohorts: YouTubeCohortRow[];
  outcomesConnected: boolean;
}) {
  return (
    <section className={adminCardClass} aria-label="First-touch cohorts">
      <h2 className={adminEyebrowClass}>By first-touch month</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        A lead that first watched in August and closed in September is credited
        to August.
      </p>
      {cohorts.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No YouTube leads in this range.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-[0.8125rem]">
            <thead>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                <th className="py-2 pr-3 font-semibold">Month</th>
                <th className="py-2 pr-3 text-right font-semibold">Leads</th>
                <th className="py-2 pr-3 text-right font-semibold">Booked</th>
                {outcomesConnected ? (
                  <>
                    <th className="py-2 pr-3 text-right font-semibold">Won</th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      Won same month
                    </th>
                    <th className="py-2 text-right font-semibold">Won later</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {cohorts.map((row) => (
                <tr key={row.month}>
                  <td className="text-ui-text py-2.5 pr-3 font-medium">
                    {row.month}
                  </td>
                  <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
                    {row.leads}
                  </td>
                  <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
                    {row.booked}
                  </td>
                  {outcomesConnected ? (
                    <>
                      <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
                        {row.closed}
                      </td>
                      <td className="text-ui-text-muted py-2.5 pr-3 text-right tabular-nums">
                        {row.closedSameMonth}
                      </td>
                      <td className="text-ui-text-muted py-2.5 text-right tabular-nums">
                        {row.closedLaterMonth}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * States plainly which stages are live and which are waiting on a switch, so a
 * dash in the table is never read as a zero.
 */
export function YouTubeCoverageNote({
  coverage,
  range,
}: {
  coverage: YouTubeCoverage;
  range: YouTubeAttribution["range"];
}) {
  const gaps: string[] = [];
  if (!coverage.clicksConnected) {
    gaps.push("Link clicks need a Bitly token before they can be synced.");
  }
  if (!coverage.visitsConnected) {
    gaps.push(
      "Landing page visits start recording once this slice's migration is applied.",
    );
  } else if (coverage.visitsSource === "ga4") {
    gaps.push(
      "Visits are GA4 sessions by Pacific day, so they read lower than a views count in GA4 Explorations.",
    );
  } else if (coverage.visitsSource === "site") {
    gaps.push(
      "Visits come from the site's own tracking, which started 2026-09-10. GA4 history appears after its first sync.",
    );
  }
  if (!coverage.outcomesConnected) {
    gaps.push(
      "Attended and won need the closed-won columns from this slice's migration.",
    );
  }

  return (
    <div className={`${adminCardClass} mb-5`}>
      <p className="text-ui-text-muted text-sm">
        <span className="text-ui-text font-semibold">
          {coverage.videosWithLeads}
        </span>{" "}
        of {coverage.registryVideos.toLocaleString()} tracked videos produced a
        lead in the {range.label.toLowerCase()}.
        {coverage.campaignsMissingFromRegistry.length > 0 ? (
          <>
            {" "}
            <span className="text-ui-text font-semibold">
              {coverage.campaignsMissingFromRegistry.length}
            </span>{" "}
            campaign
            {coverage.campaignsMissingFromRegistry.length === 1 ? "" : "s"} on
            real leads{" "}
            {coverage.campaignsMissingFromRegistry.length === 1 ? "is" : "are"}{" "}
            missing from the registry (
            {coverage.campaignsMissingFromRegistry.slice(0, 3).join(", ")}
            ), so{" "}
            {coverage.campaignsMissingFromRegistry.length === 1
              ? "it shows"
              : "they show"}{" "}
            as a slug rather than a title.
          </>
        ) : null}
        {coverage.bookedBeforeLead > 0 ? (
          <>
            {" "}
            <span className="text-ui-text font-semibold">
              {coverage.bookedBeforeLead}
            </span>{" "}
            booked before they filled the form — Close already had them, so they
            are excluded from cycle times.
          </>
        ) : null}
      </p>
      {gaps.length > 0 ? (
        <ul className="text-ui-text-subtle mt-2 space-y-0.5 text-xs">
          {gaps.map((gap) => (
            <li key={gap}>· {gap}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
