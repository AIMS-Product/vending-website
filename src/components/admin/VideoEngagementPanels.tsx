import {
  AdminMetricPanel,
  AdminMetricStrip,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { VideoShowUpPanel } from "@/components/admin/VideoShowUpPanel";
import type { FirstCallOutcome } from "@/lib/services/video-engagement-outcomes";
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

  const since = report.trackingStartedAt
    ? formatDay(report.trackingStartedAt)
    : null;

  // Leads with the people this page can actually answer for. The window's full
  // booking count used to head the strip, and with recording only days old it
  // was ~96% people booked before anything was recorded: the biggest number
  // on the page was the one that said nothing.
  return (
    <>
      <AdminMetricStrip>
        <AdminMetricPanel
          label="Tracked prospects"
          value={report.trackedCount}
          caption={
            since
              ? `Booked since ${since}, plus anyone booked earlier who has opened a video since`
              : "Nothing has been recorded yet"
          }
        />
        <AdminMetricPanel
          tone="green"
          label="Opened a video"
          value={report.watcherCount}
          caption={
            engagedPct === null
              ? "Nobody we can track has booked yet"
              : `${engagedPct}% of the ${observed} we can track`
          }
        />
        <AdminMetricPanel
          tone="amber"
          label="Watched nothing"
          value={report.coldCount}
          caption="Booked since tracking began and opened no video. This is the call list."
        />
        <AdminMetricPanel
          label="Can't tell"
          value={report.unknownCount}
          caption="We cannot link the booking to a browser, so we cannot tell if they watched"
        />
      </AdminMetricStrip>

      <p className="text-ui-text-muted mt-2 mb-4 text-xs">
        {report.bookedCount.toLocaleString("en-US")} people booked a call in
        this range.{" "}
        {since
          ? `${report.predatesTrackingCount.toLocaleString("en-US")} of them booked before ${since}, when recording began, and have not opened a video since. No earlier viewing data exists anywhere, so they are counted here and left off the page. Recording is permanent from ${since} on, so this number shrinks as the range moves past it.`
          : "Recording has not started, so none of them can be shown yet."}
      </p>

      {report.linksAvailable ? null : (
        <p className={`${adminPanelClass} mb-4 p-3 text-xs`}>
          The booking-to-browser links could not be read just now, so some
          people who booked on our site calendar show as &ldquo;No
          session&rdquo; below. Reload to try again.
        </p>
      )}

      <VideoShowUpPanel showUp={report.showUp} />
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
          Nobody in this range has opened a video, and nobody booked since
          tracking began.
        </p>
      </section>
    );
  }

  return (
    <section className={`${adminPanelClass} mb-4 p-4`}>
      <h2 className={adminSectionTitleClass}>Who is engaging</h2>
      <p className="text-ui-text-muted mt-1 mb-2 text-xs">
        One line per person who booked, most engaged first, then soonest call.
        Listed: everyone who opened a video, plus everyone who booked since
        tracking began. People who booked earlier with nothing recorded are
        counted under &ldquo;Before tracking&rdquo; and left off, because there
        is no history to recover.
      </p>
      <p className="text-ui-text-muted mb-3 text-xs">
        <span className="font-medium">Most of the way</span>: videos they got at
        least 75% through. <span className="font-medium">Reached</span>: the
        furthest point in each video, added up across videos; a rewatch is not
        counted twice, so this is not time spent.{" "}
        <span className="font-medium">No session</span>: we cannot link the
        booking to a browser, so they may have watched. A booking made in a
        calendar on our site (including the webinar&rsquo;s /start page) is now
        linked to the browser that made it; bookings from before that change,
        calls booked through a link sent by sales, and people who watch on a
        different device still cannot be.{" "}
        <span className="font-medium">First call</span>: the show-up a rep
        logged in Close. Close records it for the first sales call only, so a
        follow-up, onboarding or rescheduled booking reads &ldquo;Not a first
        call&rdquo; rather than borrowing another call&rsquo;s answer.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[58rem] text-sm">
          <thead>
            <tr className="text-ui-text-muted text-left text-xs">
              <th className="py-1.5 font-medium">Prospect</th>
              <th className="py-1.5 font-medium">Call</th>
              <th className="py-1.5 font-medium">Videos opened</th>
              <th className="py-1.5 font-medium">Most of the way</th>
              <th className="py-1.5 font-medium">Reached</th>
              <th className="py-1.5 font-medium">Went deepest on</th>
              <th className="py-1.5 font-medium">Last active</th>
              <th className="py-1.5 font-medium">First call</th>
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
      <td className="py-2 text-xs whitespace-nowrap">
        <FirstCallCell outcome={row.firstCall} canceled={row.canceled} />
      </td>
    </tr>
  );
}

const FIRST_CALL_LABEL: Record<FirstCallOutcome, string> = {
  held: "Showed",
  noShow: "No-show",
  pending: "Not yet",
  unlogged: "Not logged",
  notFirstCall: "Not a first call",
  unavailable: "—",
};

function FirstCallCell({
  outcome,
  canceled,
}: {
  outcome: FirstCallOutcome;
  canceled: boolean;
}) {
  if (canceled) return <span className="text-ui-text-muted">Canceled</span>;
  const strong = outcome === "held" || outcome === "noShow";
  return (
    <span
      className={strong ? "text-ui-text font-medium" : "text-ui-text-muted"}
    >
      {FIRST_CALL_LABEL[outcome]}
    </span>
  );
}

function VideoPanel({ report }: { report: VideoEngagementReport }) {
  return (
    <section className={`${adminPanelClass} p-4`}>
      <h2 className={adminSectionTitleClass}>Where each video loses people</h2>
      <p className="text-ui-text-muted mt-1 mb-3 text-xs">
        Counts only people who booked a call. Each column is how many got at
        least that far, so the drop between two columns is where that video lost
        them. Avg reached is the average furthest point among those who opened
        it.
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
