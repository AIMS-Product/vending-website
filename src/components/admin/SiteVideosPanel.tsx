import {
  AdminMetricPanel,
  AdminMetricStrip,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { formatPacificDay } from "@/lib/admin/format-time";
import type {
  SiteVideoReport,
  SiteVideoRow,
} from "@/lib/services/site-video-report";

/**
 * Every video on the site: our own count of real plays (sound on, per page)
 * next to YouTube's count of the same videos, on our site and on YouTube.
 * The two are never added: a site play and a YouTube embedded view are the
 * same event seen from two sides, so a gap between them is a tracking gap
 * (blocked scripts, muted autoplay YouTube counts), not extra viewing.
 * Until the playback split is connected, Metricool's all-places total stands
 * in, with "on YouTube" estimated as that total minus our plays.
 */
export function SiteVideosPanel({ report }: { report: SiteVideoReport }) {
  const totals = report.videos.reduce(
    (sum, video) => ({
      played: sum.played + video.site.played,
      reached25: sum.reached25 + video.site.reached25,
      finished: sum.finished + video.site.finished,
      ytEngaged: sum.ytEngaged + (video.youtube?.embeddedEngaged ?? 0),
      ytMinutes: sum.ytMinutes + (video.youtube?.embeddedMinutes ?? 0),
      ytTotal: sum.ytTotal + (video.youtubeTotal ?? 0),
      ytEstimate: sum.ytEstimate + (video.onYouTubeEstimate ?? 0),
    }),
    {
      played: 0,
      reached25: 0,
      finished: 0,
      ytEngaged: 0,
      ytMinutes: 0,
      ytTotal: 0,
      ytEstimate: 0,
    },
  );
  const since = formatPacificDay(report.since) ?? "—";
  const through = report.youtubeTotalsThrough
    ? (formatPacificDay(`${report.youtubeTotalsThrough}T12:00:00Z`) ??
      report.youtubeTotalsThrough)
    : null;
  const split = report.youtubeConnected;

  return (
    <section className="mb-8">
      <h2 className={`${adminSectionTitleClass} mb-2`}>
        Every video on the site
      </h2>
      <AdminMetricStrip>
        <AdminMetricPanel
          label="Plays on the site"
          value={totals.played}
          caption={`People who pressed play with sound, since ${since}. Muted autoplay never counts.`}
        />
        <AdminMetricPanel
          tone="green"
          label="Watched a quarter or more"
          value={totals.reached25}
          caption={`${totals.finished.toLocaleString("en-US")} watched to the end`}
        />
        {split ? (
          <>
            <AdminMetricPanel
              label="YouTube: real views in embeds"
              value={totals.ytEngaged}
              caption="YouTube's engaged views inside embedded players: ours, plus any other site embedding our videos. Two to three days behind."
            />
            <AdminMetricPanel
              label="YouTube: watch time in embeds"
              value={formatMinutes(totals.ytMinutes)}
              caption="Minutes watched inside embedded players, from YouTube"
            />
          </>
        ) : (
          <>
            <AdminMetricPanel
              label="YouTube: all views of these videos"
              value={through ? totals.ytTotal : "—"}
              caption={
                through
                  ? `Every view anywhere, from Metricool, through ${through}.`
                  : "Metricool has no views for these videos in this range."
              }
            />
            <AdminMetricPanel
              label="On YouTube (est.)"
              value={through ? totals.ytEstimate : "—"}
              caption="All views minus our site plays. Approximate: YouTube counts muted autoplay we leave out."
            />
          </>
        )}
      </AdminMetricStrip>

      <div className={`${adminPanelClass} mt-3 p-4`}>
        <p className="text-ui-text-muted mb-3 text-xs">
          Played, 25%, Finished: our count, one per browser, sound on.
          {split ? (
            <>
              &ldquo;Embedded&rdquo; and &ldquo;On YouTube&rdquo;:
              YouTube&rsquo;s engaged views (its stricter count that leaves out
              instant autoplay), with watch time. Embedded is mostly our site;
              other sites embedding our videos count there too.
            </>
          ) : (
            <>
              &ldquo;All views&rdquo;: every YouTube view, from Metricool.
              &ldquo;On YouTube (est.)&rdquo;: all views minus our plays.
            </>
          )}{" "}
          Vidalytics videos have no YouTube numbers.
        </p>
        {report.videos.length === 0 ? (
          <p className="text-ui-text-muted text-sm">
            No video has been played in this range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="text-ui-text-muted text-left text-xs">
                  <th className="py-1.5 font-medium">Video</th>
                  <th className="py-1.5 font-medium">Played</th>
                  <th className="py-1.5 font-medium">25%</th>
                  <th className="py-1.5 font-medium">Finished</th>
                  <th className="py-1.5 font-medium">
                    {split ? "Embedded (YouTube)" : "All views (YouTube)"}
                  </th>
                  <th className="py-1.5 font-medium">
                    {split ? "On YouTube" : "On YouTube (est.)"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-ui-line divide-y">
                {report.videos.map((video) => (
                  <SiteVideoTableRow
                    key={video.videoId}
                    video={video}
                    split={split}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function SiteVideoTableRow({
  video,
  split,
}: {
  video: SiteVideoRow;
  split: boolean;
}) {
  const pages = video.pages.slice(0, 4);
  return (
    <tr className="align-top">
      <td className="text-ui-text max-w-[26rem] py-2 pr-4">
        {video.label}
        <span className="text-ui-text-muted block text-xs">
          {video.player}
          {pages.length > 0
            ? ` · ${pages.map((page) => `${page.path} ${page.played}`).join(" · ")}`
            : null}
        </span>
      </td>
      <td className="text-ui-text py-2 font-medium">{video.site.played}</td>
      <td className="text-ui-text-muted py-2">{video.site.reached25}</td>
      <td className="text-ui-text-muted py-2">{video.site.finished}</td>
      <td className="text-ui-text-muted py-2 whitespace-nowrap">
        {!split
          ? formatCount(video.youtubeTotal, "—")
          : video.youtube
            ? `${formatCount(video.youtube.embeddedEngaged)} · ${formatMinutes(video.youtube.embeddedMinutes)}`
            : "—"}
      </td>
      <td className="text-ui-text-muted py-2 whitespace-nowrap">
        {!split
          ? formatCount(video.onYouTubeEstimate, "—")
          : video.youtube
            ? `${formatCount(video.youtube.onYouTubeEngaged)} · ${formatMinutes(video.youtube.onYouTubeMinutes)}`
            : "—"}
      </td>
    </tr>
  );
}

function formatCount(value: number | null, empty = "n/a"): string {
  return value === null ? empty : value.toLocaleString("en-US");
}

/** "45m", "3h 20m": nobody reads 200 minutes as a length of time. */
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours.toLocaleString("en-US")}h ${minutes % 60}m`;
}
