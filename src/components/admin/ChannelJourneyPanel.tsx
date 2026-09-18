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
          {data.window.start} to {data.window.end}. Each cell is the count at
          that stage; the figure above it is the share of the stage to its left.
          A dash is not observed, never zero.{" "}
          {data.visitsThrough ? (
            <>Visited stops at {data.visitsThrough}, where GA4 stops.</>
          ) : null}
        </p>
        <p className="text-ui-text-subtle mt-1 text-xs">
          A rate in grey divides two different instruments — a platform&rsquo;s
          own impressions against GA4 sessions, say. It is the shape of the
          drop-off, not a conversion rate, and it should not be quoted as one.
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
          Pick a lane for its step-by-step detail, the pages behind it, and what
          each number cannot tell you.
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
                      ? "Divides two different measurement systems — read it as shape, not as a rate."
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
            {lane.leadsOffMap === 1 ? "" : "s"} converted on a page this lane
            does not list.
          </p>
          <p className="text-ui-text-subtle mt-1 text-xs">
            They are excluded from every number above, so the lane stays one
            population. This is how the map tells you it is out of date — add
            the page to the lane in{" "}
            <code className="text-ui-text">
              src/lib/content/channel-journeys.ts
            </code>{" "}
            and it joins the funnel.
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
        These channels produced leads in this window and no lane claims them.
        Add one to <code className="text-ui-text">channel-journeys.ts</code> and
        it appears above.
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
