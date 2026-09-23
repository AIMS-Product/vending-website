import Link from "next/link";
import { adminCardClass, adminEyebrowClass } from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import {
  JOURNEY_BANDS,
  type ChannelJourneysReport,
  type JourneyBand,
  type JourneyLane,
  type JourneyStepResult,
} from "@/lib/services/channel-journeys-report";
import type { AdminAnalyticsRangeKey } from "@/lib/services/admin-analytics-range";

/**
 * The Journeys tab: the Q4 channel map with live numbers on it.
 *
 * Every lane is laid out against one fixed stage axis so the lanes line up and
 * a leak is visible across channels at a glance. A lane that has no step for a
 * band leaves the cell empty rather than borrowing a neighbour's number.
 *
 * Selecting a lane is a link, not client state: the whole tab is a server
 * component and the detail table below is just a different render of data the
 * page already holds.
 */
export function ChannelJourneysTab({
  data,
  range,
  includeInternal,
  selected,
}: {
  data: ChannelJourneysReport;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
  selected: string | null;
}) {
  const lane =
    data.lanes.find((candidate) => candidate.key === selected) ?? null;

  return (
    <div className="space-y-5">
      <section className={adminCardClass} aria-label="Channel journeys">
        <h2 className={adminEyebrowClass}>Channel journeys</h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Each channel&rsquo;s path from first view to sale, {data.window.start}{" "}
          to {data.window.end}. The large number in each box is how many reached
          that stage; the small percentage above it is that number as a share of
          the last counted stage to its left. A dash means no data, which is
          different from zero.{" "}
          {data.visitsThrough ? (
            <>
              Visited runs only to {data.visitsThrough}, the last day GA4 has
              sent.
            </>
          ) : null}
        </p>
        <p className="text-ui-text-subtle mt-1 text-xs">
          A grey percentage divides numbers from two different systems (a
          platform&rsquo;s own view count against GA4 visits, for example). Use
          it to see where people drop off; do not quote it as a conversion rate.
        </p>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[72rem]">
            <BandHeader />
            <div className="mt-1 space-y-1">
              {data.lanes.map((row) => (
                <LaneRow
                  key={row.key}
                  lane={row}
                  range={range}
                  includeInternal={includeInternal}
                  active={row.key === lane?.key}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="text-ui-text-subtle mt-3 text-xs">
          Tap a channel for its step-by-step detail, the pages behind it, and
          the caveats on each number.
        </p>
      </section>

      {lane ? <LaneDetail lane={lane} /> : null}

      {data.unmappedChannels.length > 0 ? (
        <UnmappedChannels channels={data.unmappedChannels} />
      ) : null}
    </div>
  );
}

const GRID = "grid grid-cols-[9rem_repeat(9,minmax(0,1fr))] gap-1";

function BandHeader() {
  return (
    <div className={`${GRID} ${adminEyebrowClass}`}>
      <div className="py-1">Channel</div>
      {JOURNEY_BANDS.map((band) => (
        <div key={band} className="py-1 text-center">
          {band}
        </div>
      ))}
    </div>
  );
}

function LaneRow({
  lane,
  range,
  includeInternal,
  active,
}: {
  lane: JourneyLane;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
  active: boolean;
}) {
  const byBand = new Map<JourneyBand, JourneyStepResult>();
  for (const step of lane.steps) byBand.set(step.band, step);

  const params = new URLSearchParams({
    range,
    tab: "journeys",
    lane: lane.key,
  });
  if (includeInternal) params.set("internal", "1");

  return (
    <Link
      href={`?${params.toString()}`}
      aria-current={active ? "true" : undefined}
      className={`${GRID} border-ui-line hover:border-ui-accent items-stretch rounded border transition ${
        active ? "border-ui-accent bg-ui-accent-soft" : "bg-transparent"
      }`}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <ChannelLogo label={lane.channels[0] ?? lane.label} />
        <span className="text-ui-text text-[0.8125rem] font-medium">
          {lane.label}
        </span>
      </div>
      {JOURNEY_BANDS.map((band) => (
        <Cell key={band} step={byBand.get(band)} />
      ))}
    </Link>
  );
}

function Cell({ step }: { step: JourneyStepResult | undefined }) {
  if (!step) {
    // No step in this band for this lane. Empty, not zero — the website lane
    // has no impressions because nobody buys the website.
    return <div aria-hidden className="py-2" />;
  }
  return (
    <div
      className="border-ui-line flex flex-col items-center justify-center rounded border px-1 py-1.5"
      title={step.caveat ?? step.detail}
    >
      <span
        className={`text-[0.625rem] ${
          step.crossSystem ? "text-ui-text-subtle" : "text-ui-text-muted"
        }`}
      >
        {formatRate(step.rate)}
      </span>
      <span className="text-ui-text text-[0.8125rem] font-medium tabular-nums">
        {step.count === null ? "—" : step.count.toLocaleString("en-US")}
      </span>
    </div>
  );
}

function LaneDetail({ lane }: { lane: JourneyLane }) {
  return (
    <section className={adminCardClass} aria-label={`${lane.label} detail`}>
      <h2 className={adminEyebrowClass}>{lane.label} — step detail</h2>
      {lane.note ? (
        <p className="text-ui-text-subtle mt-1 text-xs">{lane.note}</p>
      ) : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-[0.8125rem]">
          <thead>
            <tr
              className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
            >
              <th className="py-2 pr-4 font-semibold">Step</th>
              <th className="py-2 pr-3 text-right font-semibold">Count</th>
              <th className="py-2 pr-3 text-right font-semibold">From above</th>
              <th className="py-2 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {lane.steps.map((step) => (
              <tr key={step.key}>
                <td className="py-2.5 pr-4 align-top">
                  <span className="text-ui-text font-medium">{step.label}</span>
                  {step.detail ? (
                    <span className="text-ui-text-subtle block text-xs">
                      {step.detail}
                    </span>
                  ) : null}
                </td>
                <td className="py-2.5 pr-3 text-right align-top tabular-nums">
                  {step.count === null
                    ? "—"
                    : step.count.toLocaleString("en-US")}
                </td>
                <td
                  className={`py-2.5 pr-3 text-right align-top tabular-nums ${
                    step.crossSystem ? "text-ui-text-subtle" : ""
                  }`}
                >
                  {formatRate(step.rate)}
                </td>
                <td className="text-ui-text-subtle py-2.5 align-top text-xs">
                  {[
                    step.crossSystem
                      ? "Compares numbers from two different systems: read it as where people drop off, not as a conversion rate."
                      : null,
                    step.caveat ?? null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lane.leadsOffMap > 0 ? (
        <div className="border-ui-line mt-3 rounded border p-3">
          <p className="text-ui-text text-xs font-medium">
            {lane.leadsOffMap} more {lane.label} lead
            {lane.leadsOffMap === 1 ? "" : "s"} signed up on a page this
            channel&rsquo;s map does not list.
          </p>
          <p className="text-ui-text-subtle mt-1 text-xs">
            They are left out of every number above, so each step counts the
            same people. It means the map is out of date: an engineer adds the
            page to this channel in{" "}
            <code className="text-ui-text">
              src/lib/content/channel-journeys.ts
            </code>{" "}
            and they join the counts.
          </p>
          <ul className="text-ui-text-subtle mt-2 space-y-0.5 text-xs">
            {lane.offMapPaths.map((entry) => (
              <li key={entry.path} className="tabular-nums">
                {entry.path} — {entry.leads}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Channels producing leads that no lane claims. The map is hand-written, so
 * the only way it stays true is by saying out loud what it has missed.
 */
function UnmappedChannels({
  channels,
}: {
  channels: Array<{ channel: string; leads: number }>;
}) {
  return (
    <section className={adminCardClass} aria-label="Channels with no journey">
      <h2 className={adminEyebrowClass}>Not on the map yet</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        These channels brought in leads in this range but have no row on the map
        yet. An engineer adds them in{" "}
        <code className="text-ui-text">channel-journeys.ts</code> and they
        appear above.
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {channels.map((entry) => (
          <li
            key={entry.channel}
            className="text-ui-text-subtle text-xs tabular-nums"
          >
            {entry.channel} — {entry.leads}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatRate(value: number | null): string {
  if (value === null) return "—";
  return value >= 100 ? `${value.toFixed(0)}%` : `${value.toFixed(1)}%`;
}
