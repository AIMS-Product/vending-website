import Link from "next/link";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import {
  adminCardClass,
  adminEyebrowClass,
  adminLinkClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { channelsHref } from "@/components/admin/ChannelsPanels";
import { FunnelJourney } from "@/components/admin/FunnelMapDiagram";
import {
  FunnelMapCanvas,
  type Conversion,
} from "@/components/admin/FunnelMapCanvas";
import { CONVERSION_PINS, NODES } from "@/components/admin/funnel-map-graph";
import type { AdminAnalyticsRangeKey } from "@/lib/services/admin-analytics-range";
import type { FunnelMapData, GhlSummary } from "@/lib/services/funnel-map";
import type { Cohort } from "@/lib/services/funnel-cohort";
import type {
  ChannelReport,
  ChannelReportRow,
} from "@/lib/services/channel-report-rollup";

/**
 * The Funnel map tab: one picture of how a stranger becomes a booked call,
 * for people who will never read the Channels table.
 *
 * The shape of the flow is written by hand in `funnel-map-graph` because it is
 * a decision, not a measurement. Every number in it comes from `getFunnelMap`,
 * which reads the same rollup the Channels tab reads, so the map cannot drift
 * from the table. A metric nobody observed renders "—", never a zero.
 */

export function funnelMapHref(
  range: AdminAnalyticsRangeKey,
  includeInternal: boolean,
) {
  const params = new URLSearchParams({ range, tab: "map" });
  if (includeInternal) params.set("internal", "1");
  return `/admin/analytics?${params.toString()}`;
}

export function FunnelMapTab({
  data,
  range,
  includeInternal,
}: {
  data: FunnelMapData;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
}) {
  const { channels, ghl, cohort, actuals, actualsBasis } = data;
  if (!channels.connected) {
    return (
      <div className={adminCardClass}>
        <p className="text-ui-text-muted text-sm">
          The channel spine is not connected yet, so the map has no numbers to
          show.
        </p>
      </div>
    );
  }

  const report = channels.report;
  const stageValue = (key: string) =>
    report.funnel.find((entry) => entry.key === key)?.value ?? null;

  // One line of live text per box on the map. Source boxes carry their
  // channels' totals; the spine boxes carry the stage they hold.
  const metrics: Record<string, string | undefined> = {};
  for (const node of NODES) {
    if (node.channels) {
      metrics[node.id] = sourceSummary(report, node.channels);
    } else if (node.stage) {
      metrics[node.id] =
        `${formatNumber(stageValue(node.stage))} ${node.stage === "visits" ? "visits" : node.stage}`;
    }
  }
  metrics.close = `${formatNumber(stageValue("leads"))} leads pushed`;
  // Cohort, not calendar: the same basis the rail below uses, so a number does
  // not change meaning between the picture and the strip.
  metrics.outcome = `${formatNumber(actuals.showed)} showed · ${formatNumber(actuals.won)} won`;

  // One pill per spine step: the share that survived, and the people who did
  // not. Both sides come from `actuals`, so a step whose stages are read from
  // different sources is still one population on each side of the divide.
  const measured = CONVERSION_PINS.map((pin) => {
    const above = actuals[pin.from];
    const below = actuals[pin.to];
    const observed = above != null && below != null && above > 0;
    return {
      id: pin.id,
      pct: observed ? (below! / above!) * 100 : null,
      lost: observed ? above! - below! : null,
    };
  });

  // Red on the step that loses the most people, green on the one that keeps
  // the highest share. Ranked against each other rather than against a made-up
  // benchmark: there is no honest fixed number for a good conversion rate, and
  // a colour that means nothing is worse than no colour.
  const observed = measured.filter((entry) => entry.pct != null);
  const worst = observed.reduce<(typeof observed)[number] | null>(
    (found, entry) => (!found || entry.lost! > found.lost! ? entry : found),
    null,
  );
  const best = observed.reduce<(typeof observed)[number] | null>(
    (found, entry) => (!found || entry.pct! > found.pct! ? entry : found),
    null,
  );

  const conversions: Record<string, Conversion | undefined> = {};
  for (const entry of measured) {
    conversions[entry.id] = {
      pct: entry.pct,
      lost: entry.lost,
      tone:
        // Only colour when there is something to compare against: one lonely
        // measured step is neither the best nor the worst of anything.
        observed.length < 2
          ? "neutral"
          : entry.id === worst?.id
            ? "bad"
            : entry.id === best?.id
              ? "good"
              : "neutral",
    };
  }

  const hrefs: Record<string, string | undefined> = {
    link: "/admin/links",
    dashboard: channelsHref(range, includeInternal),
  };
  for (const node of NODES) {
    if (node.channels?.length === 1) {
      hrefs[node.id] = channelsHref(range, includeInternal, node.channels[0]);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-ui-text-muted max-w-4xl text-sm leading-6">
        How a stranger becomes a booked call, end to end. Every number is{" "}
        {channels.range.label.toLowerCase()}, read from the same tables the
        Channels tab reads, so the two can never disagree. A dash means nobody
        measured it, not zero.
      </p>

      <FunnelMapCanvas
        metrics={metrics}
        conversions={conversions}
        runs={channels.syncHealth}
        hrefs={hrefs}
      />

      <div className="text-ui-text-muted max-w-4xl space-y-2 text-xs leading-5">
        <p>{actualsBasis}</p>
        {cohort ? <CohortNote cohort={cohort} /> : null}
      </div>

      <FunnelJourney
        report={report}
        health={channels.syncHealth}
        rangeLabel={channels.range.label}
        sourceSummary={(group) => sourceSummary(report, group)}
        channelHref={(channel) =>
          channelsHref(range, includeInternal, channel ?? null)
        }
      />

      <GhlSection ghl={ghl} rangeLabel={channels.range.label} />
    </div>
  );
}

/**
 * What the cohort could not see, printed rather than absorbed.
 *
 * A show rate computed over the calls somebody remembered to log is an upper
 * bound, not a measurement, and the only honest way to show one is next to the
 * share of the cohort it left out.
 */
function CohortNote({ cohort }: { cohort: Cohort }) {
  const { coverage, pendingShow, showUnlogged, booked } = cohort;
  if (!booked) return null;
  return (
    <p>
      Of {booked.toLocaleString()} calls booked in this range,{" "}
      {coverage.showUp.known.toLocaleString()} are old enough to judge and carry
      an answer
      {coverage.showUp.pct != null
        ? ` (${Math.round(coverage.showUp.pct)}% of the cohort)`
        : ""}
      .{" "}
      {pendingShow > 0
        ? `${pendingShow.toLocaleString()} are still too new to count. `
        : ""}
      {showUnlogged > 0
        ? `${showUnlogged.toLocaleString()} have had their call and nobody logged the outcome, so they are left out of the rate rather than counted as a no-show. `
        : ""}
      Every rate above is therefore an upper bound.
    </p>
  );
}

/** "3,774 leads · 332 booked · 1,005,504 seen", skipping what was not seen. */
function sourceSummary(report: ChannelReport, channels: string[]): string {
  const rows = channels
    .map((label) => findRow(report, label))
    .filter((row): row is ChannelReportRow => row !== null);
  const leads = sumObserved(rows.map((row) => row.metrics.leads));
  const booked = sumObserved(rows.map((row) => row.metrics.booked));
  const seen = sumObserved(rows.map((row) => row.metrics.impressions));
  return (
    [
      leads != null || booked != null
        ? `${formatNumber(leads)} leads · ${formatNumber(booked)} booked`
        : null,
      seen != null ? `${formatCompact(seen)} seen` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "—"
  );
}

function GhlSection({
  ghl,
  rangeLabel,
}: {
  ghl: GhlSummary;
  rangeLabel: string;
}) {
  if (!ghl.snapshotDay && ghl.forms.length === 0) {
    return (
      <section className={adminCardClass}>
        <p className={adminEyebrowClass}>GoHighLevel</p>
        <p className="text-ui-text-muted mt-2 text-sm">
          No GoHighLevel data yet. The ghl-email and ghl-forms connectors write
          nothing until <code>GHL_API_KEY</code> and{" "}
          <code>GHL_LOCATION_ID</code> are set.
        </p>
      </section>
    );
  }

  return (
    <section className={adminCardClass}>
      <p className={adminEyebrowClass}>Where the GoHighLevel data goes</p>
      <h3 className={`${adminSectionTitleClass} mt-1`}>GoHighLevel, in full</h3>
      <p className="text-ui-text-muted mt-2 max-w-3xl text-xs leading-5">
        GHL is the one source with no row of its own on the Channels tab, and
        that is deliberate. Its email sends carry no lead, so they show up as
        reach under Email. Its form submissions are credited to the channel that
        actually earned them, not to the tool that collected them. Both sides
        are below.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="text-ui-text text-[0.8125rem] font-semibold">
            Email workflows
          </h4>
          <p className="text-ui-text-subtle mt-0.5 text-xs leading-5">
            {ghl.workflowCount} active workflows, snapshot {ghl.snapshotDay}.
            GHL exposes lifetime totals only, so the {rangeLabel.toLowerCase()}{" "}
            column is a day-over-day difference and starts the day after the
            first snapshot.
          </p>
          <p className="text-ui-text-muted mt-2 text-xs">
            {rangeLabel}: {formatNumber(ghl.inRange.sent)} sent ·{" "}
            {formatNumber(ghl.inRange.clicked)} clicked. Lifetime:{" "}
            {formatNumber(ghl.lifetime.sent)} sent ·{" "}
            {formatNumber(ghl.lifetime.opened)} opened ·{" "}
            {formatNumber(ghl.lifetime.clicked)} clicked.
          </p>
          <div className="border-ui-line rounded-ui mt-2 overflow-x-auto border">
            <table className="w-full text-xs">
              <thead className="bg-ui-canvas text-ui-text-subtle">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">
                    Workflow
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium">Sent</th>
                  <th className="px-2 py-1.5 text-right font-medium">
                    Clicked
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium">
                    Sent, range
                  </th>
                </tr>
              </thead>
              <tbody className="divide-ui-line divide-y">
                {ghl.workflows.slice(0, 12).map((workflow) => (
                  <tr key={workflow.name}>
                    <td className="text-ui-text px-2 py-1.5">
                      {workflow.name}
                    </td>
                    <td className="text-ui-text-muted px-2 py-1.5 text-right tabular-nums">
                      {formatNumber(workflow.sent)}
                    </td>
                    <td className="text-ui-text-muted px-2 py-1.5 text-right tabular-nums">
                      {formatNumber(workflow.clicked)}
                    </td>
                    <td className="text-ui-text-muted px-2 py-1.5 text-right tabular-nums">
                      {formatNumber(workflow.sentInRange)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ghl.workflowCount > 12 ? (
            <p className="text-ui-text-subtle mt-1 text-xs">
              Top 12 of {ghl.workflowCount} by lifetime sends.
            </p>
          ) : null}
        </div>

        <div>
          <h4 className="text-ui-text text-[0.8125rem] font-semibold">
            Lander forms
          </h4>
          <p className="text-ui-text-subtle mt-0.5 text-xs leading-5">
            {formatNumber(ghl.inRange.formLeads)} leads in{" "}
            {rangeLabel.toLowerCase()}, each credited to the channel in the
            right-hand column. Webinar registration forms are skipped here
            because vp-webinars already counts them.
          </p>
          <div className="border-ui-line rounded-ui mt-2 overflow-x-auto border">
            <table className="w-full text-xs">
              <thead className="bg-ui-canvas text-ui-text-subtle">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Form</th>
                  <th className="px-2 py-1.5 text-right font-medium">Leads</th>
                  <th className="px-2 py-1.5 text-left font-medium">
                    Credited to
                  </th>
                </tr>
              </thead>
              <tbody className="divide-ui-line divide-y">
                {ghl.forms.slice(0, 12).map((form) => (
                  <tr key={`${form.source}-${form.campaign}`}>
                    <td className="text-ui-text px-2 py-1.5">
                      {form.campaign}
                    </td>
                    <td className="text-ui-text-muted px-2 py-1.5 text-right tabular-nums">
                      {formatNumber(form.leads)}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="text-ui-text-muted inline-flex items-center gap-1.5">
                        <ChannelLogo label={form.channel} />
                        {form.channel}
                      </span>
                    </td>
                  </tr>
                ))}
                {ghl.forms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="text-ui-text-subtle px-2 py-3 text-center"
                    >
                      No form submissions in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="text-ui-text-muted border-ui-line mt-4 border-t pt-3 text-xs leading-5">
        The gap worth knowing about: links inside GHL emails carry no UTMs, so a
        workflow that sends thousands of emails can only ever report sends and
        clicks here. Until those links are tagged to the standard in{" "}
        <Link href="/admin/links" className={adminLinkClass}>
          Links
        </Link>
        , email cannot be credited with a single lead.
      </p>
    </section>
  );
}

function findRow(
  report: ChannelReport,
  label: string,
): ChannelReportRow | null {
  return (
    report.rows.find((row) => row.label === label) ??
    report.tail.find((row) => row.label === label) ??
    null
  );
}

/** Sums the values that were observed; null when none were. */
function sumObserved(values: Array<number | null>): number | null {
  return values.reduce<number | null>(
    (total, value) => (value == null ? total : (total ?? 0) + value),
    null,
  );
}

function formatNumber(value: number | null): string {
  return value == null ? "—" : value.toLocaleString();
}

/**
 * Reach runs to eight digits and would wrap a box on its own. Rounded is the
 * honest form for it: nobody acts on the last three impressions.
 */
function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString();
}
