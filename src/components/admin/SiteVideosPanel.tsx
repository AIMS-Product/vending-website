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
 */
export function SiteVideosPanel({ report }: { report: SiteVideoReport }) {
  const totals = report.videos.reduce(
    (sum, video) => ({
      played: sum.played + video.site.played,
      reached25: sum.reached25 + video.site.reached25,
      finished: sum.finished + video.site.finished,
      ytEngaged: sum.ytEngaged + (video.youtube?.embeddedEngaged ?? 0),
      ytMinutes: sum.ytMinutes + (video.youtube?.embeddedMinutes ?? 0),
    }),
    { played: 0, reached25: 0, finished: 0, ytEngaged: 0, ytMinutes: 0 },
  );
  const since = formatPacificDay(report.since) ?? "—";

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
        <AdminMetricPanel
          label="YouTube: real views in embeds"
          value={report.youtubeConnected ? totals.ytEngaged : "—"}
          caption={
            report.youtubeConnected
              ? "YouTube's engaged views inside embedded players: ours, plus any other site embedding our videos. Two to three days behind."
              : "Waiting on the one-time YouTube table setup."
          }
        />
        <AdminMetricPanel
          label="YouTube: watch time in embeds"
          value={
            report.youtubeConnected ? formatMinutes(totals.ytMinutes) : "—"
          }
          caption="Minutes watched inside embedded players, from YouTube"
        />
      </AdminMetricStrip>

      {report.youtubeConnected ? null : (
        <p className={`${adminPanelClass} mt-2 p-3 text-xs`}>
          YouTube&rsquo;s own numbers (on our site vs on YouTube, watch time)
          appear here once the YouTube playback tables are set up. Until then
          this shows our site&rsquo;s plays only.
        </p>
      )}

      <div className={`${adminPanelClass} mt-3 p-4`}>
        <p className="text-ui-text-muted mb-3 text-xs">
          Played, 25%, Finished: our count, one per browser, sound on.
          &ldquo;Embedded&rdquo; and &ldquo;On YouTube&rdquo;: YouTube&rsquo;s
          engaged views (its stricter count that leaves out instant autoplay),
          with watch time. Embedded is mostly our site; other sites embedding
          our videos count there too. Vidalytics videos have no YouTube numbers.
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
                  <th className="py-1.5 font-medium">Embedded (YouTube)</th>
                  <th className="py-1.5 font-medium">On YouTube</th>
                </tr>
              </thead>
              <tbody className="divide-ui-line divide-y">
                {report.videos.map((video) => (
                  <SiteVideoTableRow key={video.videoId} video={video} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function SiteVideoTableRow({ video }: { video: SiteVideoRow }) {
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
        {video.youtube
          ? `${formatCount(video.youtube.embeddedEngaged)} · ${formatMinutes(video.youtube.embeddedMinutes)}`
          : "—"}
      </td>
      <td className="text-ui-text-muted py-2 whitespace-nowrap">
        {video.youtube
          ? `${formatCount(video.youtube.onYouTubeEngaged)} · ${formatMinutes(video.youtube.onYouTubeMinutes)}`
          : "—"}
      </td>
    </tr>
  );
}

function formatCount(value: number | null): string {
  return value === null ? "n/a" : value.toLocaleString("en-US");
}

/** "45m", "3h 20m": nobody reads 200 minutes as a length of time. */
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours.toLocaleString("en-US")}h ${minutes % 60}m`;
}
