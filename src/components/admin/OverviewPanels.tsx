import Link from "next/link";
import { AdminViewerLink } from "@/components/admin/AdminViewerLink";
import { isViewerReadableHref } from "@/lib/admin/viewer-access";
import {
  AdminBar,
  AdminDeltaChip,
  AdminMetricPanel,
  AdminMetricStrip,
  adminCardClass,
  adminEyebrowClass,
} from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import type { AdminOverview } from "@/lib/services/admin-overview";
import type {
  ChannelReportRow,
  SyncHealthRow,
} from "@/lib/services/channel-report-rollup";
import {
  MIN_LEADS_FOR_RATE,
  rateWithSample,
  type ChannelMove,
  type ChannelMoves,
} from "@/lib/services/overview-highlights";

/**
 * The panels of the admin overview. Presentation only: every number arrives
 * already decided by `getChannelsTab` and `rankChannelMoves`.
 *
 * A null is a dash with "not observed" on hover, never a zero, and every
 * number on the page is a link to the screen that can explain it.
 */

export function channelHref(channel: string, range: string) {
  const params = new URLSearchParams({ range, tab: "channels", channel });
  return `/admin/analytics?${params.toString()}`;
}

/**
 * A few channels have a first-party page that explains them far better than
 * the channels table does. Matched loosely because the spine's label is
 * whatever the connector wrote.
 */
const OWN_PAGE: ReadonlyArray<[RegExp, string]> = [
  [/chatbot|chat\b/i, "/admin/chatbot"],
];

export function drillHref(channel: string, range: string, canEdit = true) {
  const own = OWN_PAGE.find(([pattern]) => pattern.test(channel));
  // A viewer cannot open /admin/chatbot, so send them to the channels table
  // instead — a real drill-down they are allowed to read, rather than a row
  // that bounces them back to the overview.
  if (own && (canEdit || isViewerReadableHref(own[1]))) return own[1];
  return channelHref(channel, range);
}

/** One headline number, clickable through to the screen that owns it. */
function OverviewMetric({
  canEdit,
  href,
  label,
  value,
  caption,
  delta,
}: {
  canEdit: boolean;
  href: string;
  label: string;
  value: number | null;
  caption: string;
  delta?: React.ReactNode;
}) {
  return (
    <AdminViewerLink
      canEdit={canEdit}
      href={href}
      className="hover:bg-ui-canvas block transition"
    >
      <AdminMetricPanel
        label={label}
        value={value == null ? "—" : value.toLocaleString()}
        caption={value == null ? "not observed" : caption}
        delta={delta}
      />
    </AdminViewerLink>
  );
}

export function OverviewHeadline({
  canEdit,
  leads,
  booked,
  won,
  contacts,
  prior,
  bookingRatePct,
  days,
  range,
}: {
  canEdit: boolean;
  leads: number | null;
  booked: number | null;
  won: number | null;
  /**
   * Everyone acquired who is not a site form fill: webinar registrations,
   * off-site GHL form fills, ManyChat contacts. Roughly 10x `leads`, so a
   * tile labelled "Leads" over `leads` alone reads as a collapse. See
   * REPORTING.md section 2.
   */
  contacts: number | null;
  prior: {
    leads: number | null;
    contacts: number | null;
    booked: number | null;
    won: number | null;
  };
  /** Already measured against the leads it can honestly be measured against. */
  bookingRatePct: number | null;
  days: number;
  range: string;
}) {
  const since = `vs the ${days} days before`;
  return (
    <AdminMetricStrip columns={5}>
      <OverviewMetric
        canEdit={canEdit}
        href="/admin/leads"
        label="Site form fills"
        value={leads}
        caption={since}
        delta={<Delta current={leads} prior={prior.leads} />}
      />
      <OverviewMetric
        canEdit={canEdit}
        href={`/admin/analytics?range=${range}&tab=channels`}
        label="Total captured"
        value={total(leads, contacts)}
        caption="form fills, registrations, GHL and ManyChat"
        delta={
          <Delta
            current={total(leads, contacts)}
            prior={total(prior.leads, prior.contacts)}
          />
        }
      />
      <OverviewMetric
        canEdit={canEdit}
        href="/admin/bookings"
        label="Calls booked"
        value={booked}
        caption={since}
        delta={<Delta current={booked} prior={prior.booked} />}
      />
      <OverviewMetric
        canEdit={canEdit}
        href={`/admin/analytics?range=${range}&tab=kpi`}
        label="Won"
        value={won}
        caption={since}
        delta={<Delta current={won} prior={prior.won} />}
      />
      <Link
        href={`/admin/analytics?range=${range}&tab=channels`}
        className="hover:bg-ui-canvas block transition"
      >
        <AdminMetricPanel
          label="Leads who booked"
          value={bookingRatePct == null ? "—" : `${bookingRatePct}%`}
          caption={
            bookingRatePct == null
              ? "not measurable on this range"
              : "of the leads a call can be traced to"
          }
        />
      </Link>
    </AdminMetricStrip>
  );
}

/**
 * Leads plus contacts, the one acquisition number. Null only when neither was
 * observed: a channel reporting one of the two still has a real total, and
 * treating an unobserved half as zero would understate it silently.
 */
export function total(
  leads: number | null,
  contacts: number | null,
): number | null {
  if (leads == null && contacts == null) return null;
  return (leads ?? 0) + (contacts ?? 0);
}

const LEADERBOARD_LIMIT = 10;

/**
 * Leads by channel: the page's centerpiece. The mark carries the channel, the
 * bar carries the size, and the row is a link into that channel's detail. A
 * channel with no leads observed still gets a row, because a channel that
 * stopped reporting is news.
 */
export function ChannelLeaderboard({
  canEdit,
  rows,
  tailCount,
  range,
}: {
  canEdit: boolean;
  rows: readonly ChannelReportRow[];
  tailCount: number;
  range: string;
}) {
  const max = rows.reduce(
    (highest, row) => Math.max(highest, row.metrics.leads ?? 0),
    0,
  );
  // Rows arrive sorted by leads. Past about ten the panel stops being a shape
  // you read at a glance and becomes the channels table, which already exists
  // one click away. The count of what was cut is printed underneath.
  const shown = rows.slice(0, LEADERBOARD_LIMIT);
  const hidden = rows.length - shown.length;

  return (
    <section className={adminCardClass} aria-label="Leads by channel">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={adminEyebrowClass}>Leads by channel</h2>
        <Link
          href={`/admin/analytics?range=${range}&tab=channels`}
          className="text-ui-accent text-xs font-medium underline-offset-2 hover:underline"
        >
          Full channel report
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No channel reported anything in this range.
        </p>
      ) : (
        <ul className="divide-ui-line mt-2 divide-y">
          {shown.map((row) => (
            <ChannelRow
              key={row.key}
              canEdit={canEdit}
              row={row}
              max={max}
              range={range}
            />
          ))}
        </ul>
      )}
      {hidden > 0 || tailCount > 0 ? (
        <p className="text-ui-text-subtle mt-3 text-xs">
          {hidden > 0
            ? `${hidden} more ${hidden === 1 ? "channel" : "channels"} sent fewer leads than these. `
            : null}
          {tailCount > 0
            ? `${tailCount} more ${tailCount === 1 ? "source" : "sources"} sent visits but no leads, bookings or spend. `
            : null}
          <Link
            href={`/admin/analytics?range=${range}&tab=channels`}
            className="text-ui-accent underline-offset-2 hover:underline"
          >
            See them all
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}

function ChannelRow({
  canEdit,
  row,
  max,
  range,
}: {
  canEdit: boolean;
  row: ChannelReportRow;
  max: number;
  range: string;
}) {
  const leads = row.metrics.leads;
  const booked = row.metrics.booked;
  const bookRate = rateWithSample(row.rates.bookPct, leads);

  return (
    <li>
      <Link
        href={drillHref(row.key, range, canEdit)}
        className="hover:bg-ui-canvas -mx-2 block rounded-[6px] px-2 py-2.5 transition"
      >
        <div className="flex items-center gap-2.5">
          <ChannelLogo label={row.label} />
          <span className="text-ui-text min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
            {row.label}
          </span>
          <Delta current={leads} prior={row.prior.leads} />
          <span className="text-ui-text shrink-0 text-[0.8125rem] font-semibold tabular-nums">
            {leads == null ? (
              <span className="text-ui-text-subtle" title="Not observed">
                —
              </span>
            ) : (
              leads.toLocaleString()
            )}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <AdminBar share={max > 0 ? (leads ?? 0) / max : 0} />
          </div>
          <span className="text-ui-text-subtle shrink-0 text-xs tabular-nums">
            {booked == null ? (
              <span title="No booking was traced to this channel.">
                no calls booked
              </span>
            ) : bookRate == null ? (
              <span
                title={`Fewer than ${MIN_LEADS_FOR_RATE} leads behind it, so a booking rate here would be noise.`}
              >
                {booked.toLocaleString()} booked
              </span>
            ) : (
              <>
                {booked.toLocaleString()} booked · {bookRate}% of leads
              </>
            )}
          </span>
        </div>
      </Link>
    </li>
  );
}

/**
 * The honest read. Ranked on leads gained or lost rather than on percentage,
 * and silent about any channel too small to carry a verdict.
 */
export function PerformanceRead({
  canEdit,
  moves,
  days,
  range,
}: {
  canEdit: boolean;
  moves: ChannelMoves;
  days: number;
  range: string;
}) {
  return (
    <section className={adminCardClass} aria-label="What is moving">
      <h2 className={adminEyebrowClass}>What is moving</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        Leads gained or lost against the {days} days before this range.
      </p>

      <MoveList
        title="Gaining"
        tone="up"
        canEdit={canEdit}
        moves={moves.gaining}
        empty="No channel gained enough leads to call it out."
        range={range}
      />
      <MoveList
        title="Slipping"
        tone="down"
        canEdit={canEdit}
        moves={moves.slipping}
        empty="No channel lost enough leads to call it out."
        range={range}
      />

      {moves.unrated > 0 ? (
        <p className="text-ui-text-subtle border-ui-line mt-4 border-t pt-3 text-xs">
          {moves.unrated}{" "}
          {moves.unrated === 1 ? "other channel is" : "other channels are"} too
          small or too new to judge on this range.
        </p>
      ) : null}
    </section>
  );
}

function MoveList({
  canEdit,
  title,
  tone,
  moves,
  empty,
  range,
}: {
  canEdit: boolean;
  title: string;
  tone: "up" | "down";
  moves: ChannelMove[];
  empty: string;
  range: string;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-ui-text text-[0.8125rem] font-semibold">{title}</h3>
      {moves.length === 0 ? (
        <p className="text-ui-text-subtle mt-1.5 text-xs">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {moves.map((move) => (
            <li key={move.key}>
              <Link
                href={drillHref(move.key, range, canEdit)}
                className="hover:bg-ui-canvas -mx-2 flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 transition"
              >
                <ChannelLogo label={move.label} />
                <span className="text-ui-text min-w-0 flex-1 truncate text-[0.8125rem]">
                  {move.label}
                </span>
                <AdminDeltaChip tone={tone}>
                  {move.change > 0 ? "+" : ""}
                  {move.change} leads
                  {move.changePct == null ? "" : ` (${move.changePct}%)`}
                </AdminDeltaChip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type AttentionItem = {
  key: string;
  label: string;
  count: number;
  href: string;
  tone: "red" | "neutral";
};

/**
 * Everything that is stuck, in one place at the bottom. It was the top of the
 * old overview, which meant a clean week filled the first screen with "all
 * clear" and the business numbers started below the fold.
 */
export function NeedsAttention({
  canEdit,
  overview,
  syncHealth,
  range,
}: {
  canEdit: boolean;
  overview: AdminOverview;
  syncHealth: readonly SyncHealthRow[];
  range: string;
}) {
  const items = buildAttentionItems(overview, syncHealth, range);

  return (
    <section aria-label="Needs attention">
      <h2 className={`${adminEyebrowClass} mb-2`}>Needs attention</h2>
      {items.length === 0 ? (
        <p className="bg-ui-ok-fill text-ui-ok-ink rounded-ui px-4 py-3 text-sm font-medium">
          Nothing is stuck right now.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.key}>
              {/* Still shown to a viewer: "leads stuck on a failed sync" is a
                  number the reporting audience needs even when the screen that
                  fixes it is not theirs to open. */}
              <AdminViewerLink
                canEdit={canEdit}
                href={item.href}
                className={`rounded-ui flex items-center justify-between gap-4 px-4 py-3 text-sm shadow-sm transition ${
                  item.tone === "red"
                    ? "bg-ui-bad-fill text-ui-bad-ink hover:brightness-[0.98]"
                    : "border-ui-line text-ui-text-muted bg-ui-surface hover:bg-ui-canvas border"
                }`}
              >
                <span className="font-medium">{item.label}</span>
                <span className="font-semibold tabular-nums">{item.count}</span>
              </AdminViewerLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A connector in one of these states is not reporting; the page says so. */
const BROKEN_FEED_STATUSES = new Set(["failed", "stale", "never", "empty"]);

function buildAttentionItems(
  overview: AdminOverview,
  syncHealth: readonly SyncHealthRow[],
  range: string,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const brokenFeeds = syncHealth.filter((row) =>
    BROKEN_FEED_STATUSES.has(row.status),
  ).length;

  if (brokenFeeds > 0) {
    items.push({
      key: "broken-feeds",
      // First item on purpose: while a feed is down every other number on
      // this page is reading low, and nobody can tell from the numbers alone.
      label: "Data feeds not reporting",
      count: brokenFeeds,
      href: `/admin/analytics?range=${range}&tab=channels`,
      tone: "red",
    });
  }

  if (overview.failedSyncs > 0) {
    items.push({
      key: "failed-syncs",
      label: "Leads stuck on a failed Close sync",
      count: overview.failedSyncs,
      href: "/admin/leads",
      tone: "red",
    });
  }

  if (overview.scheduledPublishFailed > 0) {
    items.push({
      key: "scheduled-publish-failed",
      label: "Scheduled publishes that failed",
      count: overview.scheduledPublishFailed,
      href: "/admin/pages",
      tone: "red",
    });
  }

  if (overview.scheduledPublishPending > 0) {
    items.push({
      key: "scheduled-publish-pending",
      label: "Pages waiting on a scheduled publish",
      count: overview.scheduledPublishPending,
      href: "/admin/pages",
      tone: "neutral",
    });
  }

  return items;
}

/**
 * What is live on the site, and the way into the rest of the studio. It used
 * to be the whole overview; it is real and it is worth a strip, but it is not
 * what the business runs on.
 */
export function StudioStrip({
  canEdit,
  overview,
  range,
}: {
  canEdit: boolean;
  overview: AdminOverview;
  range: string;
}) {
  const allLinks: ReadonlyArray<[string, string]> = [
    ["Pages", "/admin/pages"],
    ["Posts", "/admin/news"],
    ["Forms", "/admin/forms"],
    ["Chatbot", "/admin/chatbot"],
    ["Links", "/admin/links"],
    ["Media", "/admin/media"],
    ["Attribution health", "/admin/attribution"],
    ["KPI framework", `/admin/analytics?range=${range}&tab=kpi`],
    // The old overview's two primary buttons. Publishing is still real work,
    // it is just not what this screen is for any more.
    ["New page", "/admin/pages/new"],
    ["New post", "/admin/news/new"],
  ];

  // Unlike the metric tiles, these carry no number of their own — a label
  // with nothing behind it is just clutter, so a viewer gets the short list.
  const links = canEdit
    ? allLinks
    : allLinks.filter(([, href]) => isViewerReadableHref(href));

  return (
    <section className={adminCardClass} aria-label="Content and shortcuts">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <h2 className={adminEyebrowClass}>On the site</h2>
        <p className="text-ui-text-muted text-[0.8125rem]">
          <span className="text-ui-text font-semibold tabular-nums">
            {overview.pagesPublished}
          </span>{" "}
          pages and{" "}
          <span className="text-ui-text font-semibold tabular-nums">
            {overview.postsPublished}
          </span>{" "}
          posts published,{" "}
          <span className="text-ui-text font-semibold tabular-nums">
            {overview.pagesDraft + overview.postsDraft}
          </span>{" "}
          still in draft.
        </p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link
              href={href}
              className="text-ui-accent text-[0.8125rem] font-medium underline-offset-2 hover:underline"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Delta({
  current,
  prior,
}: {
  current: number | null;
  prior: number | null;
}) {
  if (current == null) return null;
  if (prior == null || prior === 0) {
    return <AdminDeltaChip tone="neutral">no prior</AdminDeltaChip>;
  }
  const pct = Math.round(((current - prior) / prior) * 100);
  const tone = pct > 0 ? "up" : pct < 0 ? "down" : "neutral";
  return (
    <AdminDeltaChip tone={tone}>
      {pct > 0 ? "+" : ""}
      {pct}%
    </AdminDeltaChip>
  );
}
