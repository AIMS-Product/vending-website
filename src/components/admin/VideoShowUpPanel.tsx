import {
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import type {
  ShowUpComparison,
  ShowUpGroup,
} from "@/lib/services/video-engagement-outcomes";

/**
 * Below this many logged first calls in a group, the page gives counts and no
 * percentage. Three of four is 75% and means nothing yet; a percentage invites
 * exactly the reading the sample cannot support.
 */
export const MIN_CALLS_FOR_RATE = 20;

/**
 * The long-term question the tracking exists for: do people who watch the
 * pre-call videos turn up to their call more often than people who do not?
 */
export function VideoShowUpPanel({ showUp }: { showUp: ShowUpComparison }) {
  return (
    <section className={`${adminPanelClass} mb-4 p-4`}>
      <h2 className={adminSectionTitleClass}>Do watchers show up?</h2>
      <p className="text-ui-text-muted mt-1 mb-3 text-xs">
        First sales calls in this range with a show-up logged in Close, split by
        whether the person opened a video first. People we cannot link to a
        browser are left out of both rows. A percentage appears once a row has{" "}
        {MIN_CALLS_FOR_RATE} logged calls.
      </p>
      {showUp.connected ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <ShowUpLine label="Opened a video" group={showUp.watched} />
          <ShowUpLine label="Watched nothing" group={showUp.watchedNothing} />
        </dl>
      ) : (
        <p className="text-ui-text-muted text-sm">
          Close&rsquo;s show-up data could not be read just now, so this is
          blank rather than partial.
        </p>
      )}
    </section>
  );
}

function ShowUpLine({ label, group }: { label: string; group: ShowUpGroup }) {
  const decided = group.held + group.noShow;
  return (
    <div>
      <dt className="text-ui-text-muted text-xs">{label}</dt>
      <dd className="text-ui-text tabular-nums">{describe(group, decided)}</dd>
    </div>
  );
}

function describe(group: ShowUpGroup, decided: number): string {
  if (decided === 0) return "No logged first calls yet";
  const counts = `${group.held} of ${decided} showed`;
  if (decided < MIN_CALLS_FOR_RATE) return `${counts} (too few to compare yet)`;
  return `${counts} (${Math.round((group.held / decided) * 100)}%)`;
}
