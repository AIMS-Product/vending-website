import Link from "next/link";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import {
  AdminStatusBadge,
  adminCardClass,
  adminEyebrowClass,
  adminLinkClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { channelsHref } from "@/components/admin/ChannelsPanels";
import type { AdminAnalyticsRangeKey } from "@/lib/services/admin-analytics-range";
import type { FunnelMapData, GhlSummary } from "@/lib/services/funnel-map";
import type {
  ChannelReport,
  ChannelReportRow,
  SyncHealthRow,
} from "@/lib/services/channel-report-rollup";

/**
 * The Funnel map tab: one picture of how a stranger becomes a booked call,
 * for people who will never read the Channels table.
 *
 * The shape of the flow is written here by hand because it is a decision, not
 * a measurement. Every number inside it comes from `getFunnelMap`, which reads
 * the same rollup the Channels tab reads, so the map cannot drift from the
 * table. A metric nobody observed renders "—", never a zero.
 */

export function funnelMapHref(
  range: AdminAnalyticsRangeKey,
  includeInternal: boolean,
) {
  const params = new URLSearchParams({ range, tab: "map" });
  if (includeInternal) params.set("internal", "1");
  return `/admin/analytics?${params.toString()}`;
}

/** The channels that feed each box, by their label on the Channels tab. */
const GOING_OUT: ReadonlyArray<{
  title: string;
  note: string;
  channels: string[];
}> = [
  {
    title: "Webinars",
    note: "Meta ads and organic posts drive registration; GoHighLevel hosts the form and the reminder sequence.",
    channels: ["Webinar"],
  },
  {
    title: "YouTube",
    note: "Long-form video with the link in the description and pinned comment.",
    channels: ["YouTube"],
  },
  {
    title: "Organic social",
    note: "Posts from the brand and from Mike and Anthony personally, scheduled in Metricool.",
    channels: ["Instagram", "X", "LinkedIn", "TikTok", "Meta"],
  },
  {
    title: "Paid ads",
    note: "Meta and Google buy the click. Spend lands on the row that spent it, so cost per lead is real.",
    channels: ["Meta Ads", "Google Ads"],
  },
  {
    title: "Email and SMS",
    note: "GoHighLevel workflows to everyone already in the list. Newsletter sends sit here too.",
    channels: ["Email", "SMS", "Newsletter"],
  },
  {
    title: "DM setter",
    note: "Pearl answers Instagram DMs in ManyChat and sends the booking link.",
    channels: ["Instagram DM"],
  },
  {
    title: "Funnels",
    note: "The video sales letter and the low-ticket funnel, each with its own opt-in.",
    channels: ["VSL", "Low ticket funnel"],
  },
];

export function FunnelMapTab({
  data,
  range,
  includeInternal,
}: {
  data: FunnelMapData;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
}) {
  const { channels, ghl } = data;
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
  const stage = (key: string) =>
    report.funnel.find((entry) => entry.key === key)?.value ?? null;

  return (
    <div className="space-y-6">
      <p className="text-ui-text-muted max-w-3xl text-sm leading-6">
        How a stranger becomes a booked call, end to end. Every number is{" "}
        {channels.range.label.toLowerCase()}, read from the same tables the
        Channels tab reads, so the two can never disagree. A dash means nobody
        measured it, not zero.
      </p>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <Stage
          eyebrow="1. Going out"
          title="Where we show up"
          caption="Seven surfaces. Each one has to carry a tagged link or the person arrives anonymous."
        >
          <div className="space-y-1.5">
            {GOING_OUT.map((box) => (
              <SourceBox
                key={box.title}
                box={box}
                report={report}
                range={range}
                includeInternal={includeInternal}
              />
            ))}
          </div>
        </Stage>

        <Arrow />

        <Stage
          eyebrow="2. The link"
          title="One tagging standard"
          caption="The link is the whole attribution system. Untagged link, unattributable lead."
        >
          <dl className="border-ui-line bg-ui-canvas rounded-ui space-y-1.5 border p-3 text-[0.8125rem]">
            {[
              ["utm_source", "who sent them (youtube, mike-ig, meta_ads)"],
              ["utm_medium", "how (organic, paid, email, dm)"],
              ["utm_campaign", "the push it belongs to"],
              ["utm_content", "which post or creative"],
              ["utm_term", "the destination — never inferred"],
            ].map(([key, meaning]) => (
              <div key={key}>
                <dt className="text-ui-text font-mono text-xs">{key}</dt>
                <dd className="text-ui-text-muted">{meaning}</dd>
              </div>
            ))}
          </dl>
          <p className="text-ui-text-subtle mt-2 text-xs leading-5">
            Built and stored in{" "}
            <Link href="/admin/links" className={adminLinkClass}>
              Links
            </Link>
            , optionally shortened through Bitly so clicks are counted before
            the visit.
          </p>
        </Stage>

        <Arrow />

        <Stage
          eyebrow="3. On the site"
          title="vendingpreneurs.com"
          caption="A landing or SEO page, the AI chatbot as a setter, then the form."
          metric={{ label: "Visited", value: stage("visits") }}
        >
          <Node title="Landing / SEO page / popup">
            GA4 records the session against the link&apos;s tags.
          </Node>
          <Node title="AI chatbot setter">
            Answers questions and can book the call itself; its bookings are
            tagged to the Chatbot channel.
          </Node>
          <Node title="Lead form and qualification">
            The scoring questions that decide who gets a call.
          </Node>
        </Stage>

        <Arrow />

        <Stage
          eyebrow="4. Captured"
          title="Lead, with its origin"
          caption="The submission stores the UTMs, the paid click ids and the session, so the origin survives."
          metric={{ label: "Lead", value: stage("leads") }}
        >
          <Node title="lead_submissions">
            The system of record for a lead and where it came from.
          </Node>
          <Node title="Close CRM, every 2 minutes">
            Pushed as a lead with the origin written to custom fields, so the
            closer sees it on the call.
          </Node>
        </Stage>

        <Arrow />

        <Stage
          eyebrow="5. The call"
          title="Booked, showed, won"
          caption="Calendly books it, Close decides what happened, and the outcome is written back onto the lead."
          metric={{ label: "Booked", value: stage("booked") }}
        >
          <Node title="Calendly booking">
            Some bookings never had a lead form — a DM link straight to the
            calendar. Those are counted as direct.
          </Node>
          <Node title="Outcome from Close">
            Showed, no-show, cancelled, won, and the deal value.
          </Node>
          <Node title="Reconciled back">
            The outcome returns to the lead, which is what makes a
            channel&apos;s win rate possible.
          </Node>
          <div className="text-ui-text-subtle mt-2 flex gap-4 text-xs">
            <span>Showed {formatNumber(stage("showed"))}</span>
            <span>Won {formatNumber(stage("won"))}</span>
          </div>
        </Stage>
      </div>

      <ConnectorBand
        runs={channels.syncHealth}
        range={range}
        includeInternal={includeInternal}
      />

      <GhlSection ghl={ghl} rangeLabel={channels.range.label} />
    </div>
  );
}

function Stage({
  eyebrow,
  title,
  caption,
  metric,
  children,
}: {
  eyebrow: string;
  title: string;
  caption: string;
  metric?: { label: string; value: number | null };
  children: React.ReactNode;
}) {
  return (
    <section className={`${adminCardClass} flex-1 lg:min-w-0`}>
      <p className={adminEyebrowClass}>{eyebrow}</p>
      <h3 className={`${adminSectionTitleClass} mt-1`}>{title}</h3>
      {metric ? (
        <p className="text-ui-text mt-2 text-[1.375rem] leading-7 font-semibold tracking-[-0.01em]">
          {formatNumber(metric.value)}{" "}
          <span className="text-ui-text-subtle text-xs font-medium">
            {metric.label}
          </span>
        </p>
      ) : null}
      <p className="text-ui-text-muted mt-2 mb-3 text-xs leading-5">
        {caption}
      </p>
      {children}
    </section>
  );
}

function Node({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-ui-line bg-ui-canvas rounded-ui mb-1.5 border p-2.5">
      <p className="text-ui-text text-[0.8125rem] font-medium">{title}</p>
      <p className="text-ui-text-muted mt-0.5 text-xs leading-5">{children}</p>
    </div>
  );
}

function SourceBox({
  box,
  report,
  range,
  includeInternal,
}: {
  box: (typeof GOING_OUT)[number];
  report: ChannelReport;
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
}) {
  const rows = box.channels
    .map((label) => findRow(report, label))
    .filter((row): row is ChannelReportRow => row !== null);
  const leads = sumObserved(rows.map((row) => row.metrics.leads));
  const booked = sumObserved(rows.map((row) => row.metrics.booked));
  const sent = sumObserved(rows.map((row) => row.metrics.impressions));
  // A surface can reach people without ever being credited a lead — GHL email
  // is the whole reason this tab exists — so reach is shown alongside, never
  // instead of, the funnel. A box with neither reads as one dash, not two.
  const summary =
    [
      leads != null || booked != null
        ? `${formatNumber(leads)} leads · ${formatNumber(booked)} booked`
        : null,
      sent != null ? `${formatNumber(sent)} seen` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "—";

  return (
    <details className="border-ui-line bg-ui-canvas rounded-ui group border p-2.5">
      <summary className="flex cursor-pointer items-center justify-between gap-2">
        <span className="text-ui-text text-[0.8125rem] font-medium">
          {box.title}
        </span>
        <span className="text-ui-text-muted shrink-0 text-xs tabular-nums">
          {summary}
        </span>
      </summary>
      <p className="text-ui-text-muted mt-1.5 text-xs leading-5">{box.note}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {box.channels.map((label) => {
          const row = findRow(report, label);
          return (
            <Link
              key={label}
              href={channelsHref(range, includeInternal, label)}
              className="border-ui-line-strong bg-ui-surface rounded-ui text-ui-text-muted hover:text-ui-text inline-flex items-center gap-1.5 border px-1.5 py-0.5 text-xs"
            >
              <ChannelLogo label={label} />
              {label}
              <span className="text-ui-text-subtle tabular-nums">
                {formatNumber(row?.metrics.leads ?? null)}
              </span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}

/** Points right when the stages sit side by side, down when they stack. */
function Arrow() {
  return (
    <div
      aria-hidden
      className="text-ui-text-subtle flex items-center justify-center lg:w-4"
    >
      <svg viewBox="0 0 16 16" className="size-4 rotate-90 lg:rotate-0">
        <path
          d="M2 8h11M9 4l4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** What the connector names mean to someone who does not work on the code. */
const CONNECTOR_LABELS: Record<string, string> = {
  "ga4-visits": "GA4 — visits by link",
  leads: "Our own lead forms",
  "ghl-email": "GoHighLevel — email workflows",
  "ghl-forms": "GoHighLevel — lander forms",
  "bitly-clicks": "Bitly — short link clicks",
  "metricool-posts": "Metricool — posts and reach",
  "metricool-ads": "Metricool — ad spend",
  "youtube-analytics": "YouTube Analytics",
  "webinar-ingest": "vp-webinars — registrations",
  "manychat-ingest": "ManyChat — DM setter stages",
  "close-lead-funnel": "Close CRM — call outcomes",
};

function ConnectorBand({
  runs,
  range,
  includeInternal,
}: {
  runs: SyncHealthRow[];
  range: AdminAnalyticsRangeKey;
  includeInternal: boolean;
}) {
  return (
    <section className={adminCardClass}>
      <p className={adminEyebrowClass}>6. Reconciled back</p>
      <h3 className={`${adminSectionTitleClass} mt-1`}>
        Every platform reports on its own surface, once a day
      </h3>
      <p className="text-ui-text-muted mt-2 mb-3 max-w-3xl text-xs leading-5">
        Each connector writes one row per day per link into{" "}
        <code className="text-ui-text">channel_daily</code>, the single table
        this dashboard reads. A connector that fails leaves its stage unobserved
        rather than writing a zero, which is why a dash here matters.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {runs.map((run) => (
          <div
            key={run.connector}
            className="border-ui-line bg-ui-canvas rounded-ui border p-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-ui-text text-[0.8125rem] font-medium">
                {CONNECTOR_LABELS[run.connector] ?? run.connector}
              </p>
              <AdminStatusBadge
                status={run.status}
                tone={toneFor(run.status)}
              />
            </div>
            <p className="text-ui-text-subtle mt-1 text-xs tabular-nums">
              {run.finishedAt
                ? `${formatNumber(run.rowsWritten)} rows · ${formatWhen(run.finishedAt)}`
                : "never run"}
            </p>
            {run.note ? (
              <p className="text-ui-text-muted mt-1 text-xs leading-5">
                {run.note}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <p className="text-ui-text-subtle mt-3 text-xs">
        Numbers land on the{" "}
        <Link
          href={channelsHref(range, includeInternal)}
          className={adminLinkClass}
        >
          Channels tab
        </Link>
        .
      </p>
    </section>
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
        clicks here. Until those links are tagged to the standard above, email
        cannot be credited with a single lead.
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

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toneFor(status: string): "ok" | "warn" | "bad" | "idle" {
  if (status === "ok") return "ok";
  if (status === "failed") return "bad";
  if (status === "stale") return "warn";
  return "idle";
}
