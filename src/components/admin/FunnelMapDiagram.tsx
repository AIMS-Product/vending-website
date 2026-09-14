import Link from "next/link";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import { adminEyebrowClass, adminLinkClass } from "@/components/admin/AdminUi";
import type {
  ChannelReport,
  FunnelStage,
  SyncHealthRow,
} from "@/lib/services/channel-report-rollup";

/**
 * The journey, top to bottom: what we send out, what happens to the person,
 * and where each number came from.
 *
 * This was a node-and-edge canvas once, and it read as a systems diagram —
 * which table writes to which — rather than as a journey. A journey is a
 * chain, not a graph, so it is laid out as aligned rows instead of plotted
 * coordinates. That deleted the routing, the crossings and the empty canvas
 * in one go: a chain cannot cross itself.
 *
 * Every number comes from the same rollup the Channels tab reads. A metric
 * nobody observed renders "—", never a zero.
 */

type SourceBox = {
  title: string;
  note: string;
  logos: string[];
  channels: string[];
};

/** What goes out, and what each one is. */
const GOING_OUT: SourceBox[] = [
  {
    title: "Webinars",
    note: "Ads and posts drive registration, GHL hosts the form",
    logos: ["webinar"],
    channels: ["Webinar"],
  },
  {
    title: "YouTube",
    note: "Link in the description and pinned comment",
    logos: ["youtube"],
    channels: ["YouTube"],
  },
  {
    title: "Organic social",
    note: "Brand and personal accounts, scheduled in Metricool",
    logos: ["instagram", "tiktok", "x", "linkedin"],
    channels: ["Instagram", "TikTok", "X", "LinkedIn", "Meta"],
  },
  {
    title: "Paid ads",
    note: "Spend lands on the row that spent it",
    logos: ["meta ads", "google ads"],
    channels: ["Meta Ads", "Google Ads"],
  },
  {
    title: "Email and SMS",
    note: "GoHighLevel workflows, plus the newsletter",
    logos: ["ghl"],
    channels: ["Email", "SMS", "Newsletter"],
  },
  {
    title: "VSL and low-ticket",
    note: "Their own opt-in pages, hosted in GHL",
    logos: ["vsl"],
    channels: ["VSL", "Low ticket funnel"],
  },
  {
    title: "Instagram DM setter",
    note: "Pearl sends a calendar link, skipping the site entirely",
    logos: ["manychat"],
    channels: ["Instagram DM"],
  },
];

/** What actually happens at each step, in the order a person meets them. */
const HOW: Record<string, { title: string; body: string; logos?: string[] }> = {
  impressions: {
    title: "We publish",
    body: "Posts, videos, ads, emails and DMs go out on the surfaces above.",
  },
  clicks: {
    title: "They click a tagged link",
    body: "Five UTMs on every link: source, medium, campaign, content, and term for the destination. An untagged link produces a lead nobody can credit.",
  },
  visits: {
    title: "They land on the site",
    body: "A landing or SEO page. GA4 records the session against the link's own tags.",
    logos: ["website"],
  },
  leads: {
    title: "They identify themselves",
    body: "The lead form, or the chatbot capturing mid-conversation. Stored with its origin and pushed to Close every 2 minutes.",
    logos: ["chatbot", "form"],
  },
  booked: {
    title: "They take a slot",
    body: "Calendly. A DM or chatbot link can book with no lead form behind it.",
    logos: ["calendly"],
  },
  showed: {
    title: "They turn up",
    body: "Close decides: showed, no-show or cancelled. There is no attended field, so it is derived.",
    logos: ["close"],
  },
  won: {
    title: "They buy",
    body: "The Close opportunity, reconciled back onto the lead with its value.",
    logos: ["close"],
  },
};

/** Connector id to the label, and the mark, a non-engineer can read. */
const CONNECTORS: Array<{ connector: string; label: string; logo: string }> = [
  { connector: "ga4-visits", label: "GA4 visits", logo: "ga4" },
  { connector: "leads", label: "Our lead forms", logo: "form" },
  { connector: "ghl-forms", label: "GHL forms", logo: "ghl" },
  { connector: "ghl-email", label: "GHL email", logo: "ghl" },
  { connector: "bitly-clicks", label: "Bitly clicks", logo: "bitly" },
  { connector: "metricool-posts", label: "Metricool posts", logo: "metricool" },
  { connector: "metricool-ads", label: "Metricool spend", logo: "metricool" },
  {
    connector: "youtube-analytics",
    label: "YouTube Analytics",
    logo: "youtube",
  },
  { connector: "webinar-ingest", label: "vp-webinars", logo: "webinar" },
  { connector: "manychat-ingest", label: "ManyChat", logo: "manychat" },
  { connector: "close-lead-funnel", label: "Close outcomes", logo: "close" },
];

export function FunnelJourney({
  report,
  health,
  rangeLabel,
  sourceSummary,
  channelHref,
}: {
  report: ChannelReport;
  health: SyncHealthRow[];
  rangeLabel: string;
  /** "3,774 leads · 332 booked · 1.0M seen" for a group of channels. */
  sourceSummary: (channels: string[]) => string;
  channelHref: (channel?: string) => string;
}) {
  // Reach is what a platform reported about its own surface; the funnel is
  // what happened on ours. One chain, but the join is not a strict subset,
  // which is why the first gaps carry no percentage.
  const stages = [...report.reach, ...report.funnel];
  const directBooked = sumObserved(report.rows.map((row) => row.directBooked));
  const byConnector = new Map(health.map((run) => [run.connector, run]));

  return (
    <div className="space-y-3">
      <Band
        eyebrow="1. What goes out"
        title="Seven surfaces, one tagging standard"
        caption={
          <>
            Everything starts here. Each surface carries a link built in{" "}
            <Link href="/admin/links" className={adminLinkClass}>
              Links
            </Link>
            , and a link that is not tagged produces a lead nobody can credit.
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {GOING_OUT.map((source) => (
            <Link
              key={source.title}
              href={channelHref(
                source.channels.length === 1 ? source.channels[0] : undefined,
              )}
              className="border-ui-line bg-ui-surface rounded-ui hover:border-ui-accent block border p-2.5 transition"
            >
              <div className="flex items-center gap-1">
                {source.logos.map((logo) => (
                  <ChannelLogo key={logo} label={logo} />
                ))}
              </div>
              <p className="text-ui-text mt-1.5 text-xs leading-4 font-semibold">
                {source.title}
              </p>
              <p className="text-ui-text mt-1 text-[0.8125rem] leading-4 font-semibold tabular-nums">
                {sourceSummary(source.channels)}
              </p>
              <p className="text-ui-text-muted mt-1 text-[0.6875rem] leading-4">
                {source.note}
              </p>
            </Link>
          ))}
        </div>
      </Band>

      <DownArrow label="every tagged link leads here" />

      <Band
        eyebrow="2. The journey"
        title={`One person, left to right, ${rangeLabel.toLowerCase()}`}
        caption="Each step shows the count that reached it and the share carried over from the step before. A share is measured only where both steps were seen on the same link, so the two sides are one population."
        emphasis
      >
        <div className="overflow-x-auto pb-1">
          <ol className="flex min-w-[62rem] items-stretch">
            {stages.map((stage, index) => (
              <li key={stage.key} className="flex flex-1 items-stretch">
                {index > 0 ? <StepGap stage={stage} /> : null}
                <StageCard stage={stage} />
              </li>
            ))}
          </ol>
        </div>
      </Band>

      <Band
        eyebrow="3. What happens at each step"
        title="The same seven steps, in plain English"
        caption="Where a number is softer than it looks, it says so here rather than on the chart."
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {stages.map((stage) => {
            const how = HOW[stage.key];
            if (!how) return null;
            return (
              <div
                key={stage.key}
                className="border-ui-line bg-ui-canvas rounded-ui border p-2.5"
              >
                <div className="flex items-center gap-1.5">
                  {how.logos?.map((logo) => (
                    <ChannelLogo key={logo} label={logo} />
                  ))}
                  <p className={adminEyebrowClass}>{stage.label}</p>
                </div>
                <p className="text-ui-text mt-1 text-xs leading-4 font-semibold">
                  {how.title}
                </p>
                <p className="text-ui-text-muted mt-1 text-[0.6875rem] leading-4">
                  {how.body}
                </p>
                {stage.key === "booked" && directBooked != null ? (
                  <Caveat>
                    {directBooked.toLocaleString()} of these booked straight
                    from a link, with no lead form behind them.
                  </Caveat>
                ) : null}
                {stage.key === "showed" ? (
                  <Caveat>
                    An upper bound. A booked call counts as shown unless Close
                    says no-show or cancelled, and many never get an outcome.
                  </Caveat>
                ) : null}
              </div>
            );
          })}
        </div>
      </Band>

      <Band
        eyebrow="4. Where the numbers come from"
        title="Each platform reports on its own surface, once a day"
        caption={
          <>
            Every connector writes one row per day per link into{" "}
            <code className="text-ui-text">channel_daily</code>, the single
            table this page reads. A connector that fails leaves its step
            unobserved rather than writing a zero, which is why a dash above
            matters.
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          {CONNECTORS.map((entry) => {
            const run = byConnector.get(entry.connector);
            const status = run?.status ?? "never";
            return (
              <div
                key={entry.connector}
                className="border-ui-line bg-ui-surface rounded-ui flex items-center gap-2 border px-2.5 py-1.5"
              >
                <ChannelLogo label={entry.logo} />
                <div>
                  <p className="text-ui-text text-[0.6875rem] leading-4 font-medium">
                    {entry.label}
                  </p>
                  <p className="text-ui-text-subtle text-[0.625rem] leading-4 tabular-nums">
                    {run?.finishedAt
                      ? `${run.rowsWritten.toLocaleString()} rows`
                      : "never run"}
                  </p>
                </div>
                <StatusDot status={status} />
              </div>
            );
          })}
        </div>
      </Band>
    </div>
  );
}

function StageCard({ stage }: { stage: FunnelStage }) {
  return (
    <div className="border-ui-line bg-ui-surface rounded-ui flex-1 border p-3">
      <p className={adminEyebrowClass}>{stage.label}</p>
      <p className="text-ui-text mt-1 text-[1.375rem] leading-7 font-semibold tracking-[-0.01em] tabular-nums">
        {stage.value == null ? "—" : stage.value.toLocaleString()}
      </p>
      {stage.deltaPct != null ? (
        <p className="text-ui-text-subtle mt-0.5 text-[0.6875rem] leading-4 tabular-nums">
          {stage.deltaPct >= 0 ? "+" : ""}
          {Math.round(stage.deltaPct)}% vs prior
        </p>
      ) : null}
    </div>
  );
}

/** The gap between two steps is where the story is: what fell out. */
function StepGap({ stage }: { stage: FunnelStage }) {
  return (
    <div
      className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 px-1"
      title={
        stage.ofPreviousLabel
          ? `of ${stage.ofPreviousLabel.toLowerCase()}`
          : undefined
      }
    >
      <span className="text-ui-text-muted text-[0.6875rem] leading-4 font-semibold tabular-nums">
        {stage.ofPreviousPct == null ? "" : `${stage.ofPreviousPct}%`}
      </span>
      <svg viewBox="0 0 32 8" className="text-ui-text-subtle w-8" aria-hidden>
        <path
          d="M0 4h26M22 1l4 3-4 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Band({
  eyebrow,
  title,
  caption,
  emphasis,
  children,
}: {
  eyebrow: string;
  title: string;
  caption?: React.ReactNode;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-ui-lg shadow-ui border p-4 ${
        emphasis
          ? "border-ui-accent/30 bg-ui-accent-soft"
          : "border-ui-line bg-ui-surface"
      }`}
    >
      <p className={adminEyebrowClass}>{eyebrow}</p>
      <h3 className="text-ui-text mt-1 text-sm font-semibold">{title}</h3>
      {caption ? (
        <p className="text-ui-text-muted mt-1.5 mb-3 max-w-4xl text-xs leading-5">
          {caption}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function DownArrow({ label }: { label: string }) {
  return (
    <div className="text-ui-text-subtle flex items-center justify-center gap-2 text-[0.6875rem]">
      <svg viewBox="0 0 8 24" className="h-5" aria-hidden>
        <path
          d="M4 0v18M1 15l3 3 3-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </div>
  );
}

function Caveat({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-ui-warn border-ui-line mt-2 border-t pt-2 text-[0.6875rem] leading-4">
      {children}
    </p>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "ok"
      ? "bg-ui-ok"
      : status === "failed"
        ? "bg-ui-bad"
        : status === "stale"
          ? "bg-ui-warn"
          : "bg-ui-line-strong";
  return (
    <span
      className={`ml-1 size-1.5 shrink-0 rounded-full ${tone}`}
      title={status}
    />
  );
}

function sumObserved(values: Array<number | null>): number | null {
  return values.reduce<number | null>(
    (total, value) => (value == null ? total : (total ?? 0) + value),
    null,
  );
}
