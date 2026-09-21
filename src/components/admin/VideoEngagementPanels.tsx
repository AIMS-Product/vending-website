import {
  AdminMetricPanel,
  AdminMetricStrip,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import type {
  VideoBreakdownRow,
  VideoEngagementReport,
  VideoWatcherRow,
} from "@/lib/services/video-engagement-report";

/**
 * Pre-call video engagement, for people who booked a call.
 *
 * Two tables because there are two questions. "Who should I call before their
 * call" is answered per person; "which video is losing people" is answered per
 * video. One table trying to do both answers neither.
 *
 * Every label says REACHED, not watched. The stored number is a high-water
 * mark, so someone who rewinds and rewatches is not counted twice, and calling
 * that "watch time" would be a claim the data cannot support.
 */
export function VideoEngagementTab({
  report,
}: {
  report: VideoEngagementReport;
}) {
  if (!report.connected) {
    return (
      <p className={`${adminPanelClass} p-4 text-sm`}>
        The video engagement table is not available in this environment yet.
      </p>
    );
  }

  // Over the people this page could actually observe — a session, and booked
  // since recording started — not over every booking in the window. Three
  // watchers against 3,038 bookings rounds to "0% of everyone who booked",
  // which reads as "nobody watches these" when the real answer is half of
  // everyone we could see. The denominator was measuring our blind spot.
  const observed = report.watcherCount + report.coldCount;
  const engagedPct = observed
    ? Math.round((report.watcherCount / observed) * 100)
    : null;

  return (
    <>
      <AdminMetricStrip>
        <AdminMetricPanel
          label="Booked prospects"
          value={report.bookedCount}
          caption="Calls booked in the window"
        />
        <AdminMetricPanel
          tone="green"
          label="Opened a video"
          value={report.watcherCount}
          caption={
            engagedPct === null
              ? "Nobody trackable has booked yet"
              : `${engagedPct}% of the ${observed} we could see`
          }
        />
        <AdminMetricPanel
          tone="amber"
          label="Watched nothing"
          value={report.coldCount}
          caption="Booked since tracking began and opened nothing — the call list"
        />
        <AdminMetricPanel
          label="Before tracking"
          value={report.predatesTrackingCount}
          caption={
            report.trackingStartedAt
              ? `Booked before ${formatDay(report.trackingStartedAt)}; nothing was recording`
              : "Nothing has been recorded yet"
          }
        />
        <AdminMetricPanel
          label="Can't tell"
          value={report.unknownCount}
          caption="Booked since tracking began with no session to match; not the same as nothing"
        />
      </AdminMetricStrip>

      <PeoplePanel report={report} />
      <VideoPanel report={report} />
    </>
  );
}

function PeoplePanel({ report }: { report: VideoEngagementReport }) {
  if (report.people.length === 0) {
    return (
      <section className={`${adminPanelClass} mb-4 p-4`}>
        <h2 className={adminSectionTitleClass}>Who is engaging</h2>
        <p className="text-ui-text-muted mt-1 text-xs">
          Nobody in this window has opened a video, and nobody booked since
          tracking began.
        </p>
      </section>
    );
  }

  return (
    <section className={`${adminPanelClass} mb-4 p-4`}>
      <h2 className={adminSectionTitleClass}>Who is engaging</h2>
      <p className="text-ui-text-muted mt-1 mb-3 text-xs">
        One line per booked prospect, most engaged first, then soonest call.
        Time is the furthest point they reached, not time spent — a rewatch is
        not counted twice. Matched per browser, so a phone booking watched on a
        laptop shows as no session rather than as nothing. Listed are the
        bookings this page can answer for: everyone who has opened a video, plus
        everyone who booked since tracking began. A booking made earlier with
        nothing recorded against it is counted under &ldquo;Before
        tracking&rdquo; and left off — no history exists to recover, so its
        blank row would read as an answer.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="text-ui-text-muted text-left text-xs">
              <th className="py-1.5 font-medium">Prospect</th>
              <th className="py-1.5 font-medium">Call</th>
              <th className="py-1.5 font-medium">Videos opened</th>
              <th className="py-1.5 font-medium">Most of the way</th>
              <th className="py-1.5 font-medium">Reached</th>
              <th className="py-1.5 font-medium">Went deepest on</th>
              <th className="py-1.5 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {report.people.slice(0, 200).map((row) => (
              <PersonRow
                key={row.bookingId}
                row={row}
                total={report.totalVideos}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PersonRow({ row, total }: { row: VideoWatcherRow; total: number }) {
  return (
    <tr>
      <td className="text-ui-text py-2">
        {row.name}
        {row.email ? (
          <span className="text-ui-text-muted block text-xs">{row.email}</span>
        ) : null}
      </td>
      <td className="text-ui-text-muted py-2 text-xs whitespace-nowrap">
        {formatDay(row.startAt)}
        <span className="block">
          {row.canceled ? "Canceled" : row.upcoming ? "Upcoming" : "Past"}
        </span>
      </td>
      <td className="text-ui-text py-2 whitespace-nowrap">
        {row.predatesTracking ? (
          <span
            className="text-ui-text-muted text-xs"
            title="They booked before any of this was recorded. Whether they watched is unknowable — there is no earlier data anywhere to recover."
          >
            Not tracked yet
          </span>
        ) : row.videosStarted === 0 && !row.hasSession ? (
          <span
            className="text-ui-text-muted text-xs"
            title="No browser session on this booking, so there is nothing to match their watching against. They may well have watched — this is our blind spot, not their silence."
          >
            No session
          </span>
        ) : row.videosStarted === 0 ? (
          <span className="text-ui-text-muted">None</span>
        ) : (
          <>
            {row.videosStarted} of {total}
          </>
        )}
      </td>
      <td className="text-ui-text-muted py-2">{row.videosMostlyWatched}</td>
      <td className="text-ui-text-muted py-2 whitespace-nowrap">
        {row.secondsReached > 0 ? formatDuration(row.secondsReached) : "—"}
      </td>
      <td className="text-ui-text-muted py-2 text-xs">
        {row.deepest ? `${row.deepest.label} (${row.deepest.percent}%)` : "—"}
      </td>
      <td className="text-ui-text-muted py-2 text-xs whitespace-nowrap">
        {formatDay(row.lastSeenAt)}
      </td>
    </tr>
  );
}

function VideoPanel({ report }: { report: VideoEngagementReport }) {
  return (
    <section className={`${adminPanelClass} p-4`}>
      <h2 className={adminSectionTitleClass}>Where each video loses people</h2>
      <p className="text-ui-text-muted mt-1 mb-3 text-xs">
        Counted over booked prospects only. Each column is how many got at least
        that far, so the drop between two columns is where that video lost them.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="text-ui-text-muted text-left text-xs">
              <th className="py-1.5 font-medium">Video</th>
              <th className="py-1.5 font-medium">Length</th>
              <th className="py-1.5 font-medium">Opened</th>
              <th className="py-1.5 font-medium">25%</th>
              <th className="py-1.5 font-medium">50%</th>
              <th className="py-1.5 font-medium">75%</th>
              <th className="py-1.5 font-medium">Finished</th>
              <th className="py-1.5 font-medium">Avg reached</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {report.videos.map((video) => (
              <VideoRow key={video.embedId} video={video} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VideoRow({ video }: { video: VideoBreakdownRow }) {
  return (
    <tr>
      <td className="text-ui-text py-2">
        {video.label}
        <span className="text-ui-text-muted block text-xs capitalize">
          {video.group}
        </span>
      </td>
      <td className="text-ui-text-muted py-2 text-xs whitespace-nowrap">
        {video.durationSeconds ? formatDuration(video.durationSeconds) : "—"}
      </td>
      <td className="text-ui-text py-2 font-medium">{video.started}</td>
      <td className="text-ui-text-muted py-2">{video.reached25}</td>
      <td className="text-ui-text-muted py-2">{video.reached50}</td>
      <td className="text-ui-text-muted py-2">{video.reached75}</td>
      <td className="text-ui-text-muted py-2">{video.reached100}</td>
      <td className="text-ui-text-muted py-2">
        {video.averagePercent === null ? "—" : `${video.averagePercent}%`}
      </td>
    </tr>
  );
}

/** Seconds as m:ss — a rep reads "3:20", never "200 seconds". */
function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

function formatDay(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
