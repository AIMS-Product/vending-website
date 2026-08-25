import Link from "next/link";
import {
  AdminMetricPanel,
  AdminMetricStrip,
  adminCardClass,
  adminEyebrowClass,
} from "@/components/admin/AdminUi";
import { AnalyticsBreakdown } from "@/components/admin/AnalyticsPanels";
import type { ChatbotAnalytics } from "@/lib/chatbot/analytics";
import type { ChatbotConfig } from "@/lib/chatbot/config";

const TABS = [
  { key: "outcomes", label: "Who did not book" },
  { key: "volume", label: "Volume" },
  { key: "questions", label: "Questions" },
  { key: "prospects", label: "Prospects" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function parseTab(value: string | undefined): TabKey {
  return TABS.find((tab) => tab.key === value)?.key ?? "volume";
}

export function ChatbotPerformancePanel({
  analytics,
  config,
  latestActivity,
  activeTab,
}: {
  analytics: ChatbotAnalytics;
  config: ChatbotConfig;
  latestActivity: string | null;
  activeTab: string | undefined;
}) {
  const tab = parseTab(activeTab);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusChip enabled={config.enabled} latestActivity={latestActivity} />
      </div>

      <AdminMetricStrip>
        {/* Calls booked leads the strip on purpose: it is the number the
            chatbot is actually accountable for. */}
        <AdminMetricPanel
          label="Calls booked (30d)"
          value={analytics.callsBooked30d.value}
          caption="booked from a chat"
          delta={<DeltaChip metric={analytics.callsBooked30d} />}
        />
        <AdminMetricPanel
          label="Conversations (30d)"
          value={analytics.conversations30d.value}
          caption={`${analytics.conversations7d} in the last 7 days`}
          delta={<DeltaChip metric={analytics.conversations30d} />}
        />
        <AdminMetricPanel
          label="Leads captured (30d)"
          value={analytics.leadsCaptured30d.value}
          caption="email or phone captured"
          delta={<DeltaChip metric={analytics.leadsCaptured30d} />}
        />
        <AdminMetricPanel
          label="Capture rate"
          value={`${analytics.captureRatePct}%`}
          caption={`avg ${analytics.avgMessagesPerConversation} messages / conversation`}
        />
      </AdminMetricStrip>

      <FunnelStrip
        funnels={analytics.funnels}
        attributionSplitTrustworthy={analytics.attributionSplitTrustworthy}
      />

      <nav
        className="border-ui-line flex flex-wrap gap-1 border-b"
        aria-label="Chatbot performance sections"
      >
        {TABS.map((entry) => {
          const isActive = entry.key === tab;
          return (
            <Link
              key={entry.key}
              href={
                entry.key === "volume"
                  ? "/admin/chatbot"
                  : `/admin/chatbot?tab=${entry.key}`
              }
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-[0.8125rem] font-medium transition ${
                isActive
                  ? "text-ui-text border-ui-accent"
                  : "text-ui-text-subtle hover:text-ui-text border-transparent"
              }`}
            >
              {entry.label}
            </Link>
          );
        })}
      </nav>

      {tab === "outcomes" ? <OutcomesTab analytics={analytics} /> : null}
      {tab === "volume" ? <VolumeTab analytics={analytics} /> : null}
      {tab === "questions" ? <QuestionsTab analytics={analytics} /> : null}
      {tab === "prospects" ? <ProspectsTab analytics={analytics} /> : null}
    </section>
  );
}

const FUNNEL_WINDOW_OPTIONS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

/**
 * Conversations -> engaged -> contact captured -> booked, over a selectable
 * 7/30/90 day window, plus how each booking happened (straight in the chat,
 * or after chatting first). A pure CSS radio/label toggle, not a client
 * component: `ChatbotPerformancePanel` is a server component fed by a single
 * server-rendered `analytics` prop, and all three windows are already
 * computed server-side, so there is nothing here that needs JS state.
 */
function FunnelStrip({
  funnels,
  attributionSplitTrustworthy,
}: {
  funnels: ChatbotAnalytics["funnels"];
  attributionSplitTrustworthy: boolean;
}) {
  return (
    <section className={adminCardClass} aria-label="Chatbot conversion funnel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={adminEyebrowClass}>Conversion funnel</h2>
        <div
          role="radiogroup"
          aria-label="Funnel window"
          className="border-ui-line rounded-ui inline-flex border p-0.5 text-[0.8125rem]"
        >
          {FUNNEL_WINDOW_OPTIONS.map((option) => (
            <label
              key={option.days}
              htmlFor={`chatbot-funnel-window-${option.days}`}
              // The radio itself is sr-only, so without a has-focus-visible
              // ring a keyboard user tabbing through this control sees nothing
              // move at all.
              className="text-ui-text-subtle has-checked:bg-ui-accent has-focus-visible:ring-ui-accent rounded-[calc(var(--radius-ui)-2px)] px-2.5 py-1 font-medium transition has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-offset-1"
            >
              <input
                type="radio"
                id={`chatbot-funnel-window-${option.days}`}
                name="chatbot-funnel-window"
                defaultChecked={option.days === 30}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {/* The visibility variant is passed as a LITERAL string, never built by
          interpolation. Tailwind generates CSS by scanning source text for
          whole class names: a template like `[:has(#${id}:checked)_&]:block`
          produces no rule at all, so every panel keeps `hidden` and the funnel
          renders blank. That shipped once; these three strings are the fix. */}
      <FunnelWindowPanel
        funnelWindow={funnels.d7}
        visibleClass="[:has(#chatbot-funnel-window-7:checked)_&]:block"
        attributionSplitTrustworthy={attributionSplitTrustworthy}
      />
      <FunnelWindowPanel
        funnelWindow={funnels.d30}
        visibleClass="[:has(#chatbot-funnel-window-30:checked)_&]:block"
        attributionSplitTrustworthy={attributionSplitTrustworthy}
      />
      <FunnelWindowPanel
        funnelWindow={funnels.d90}
        visibleClass="[:has(#chatbot-funnel-window-90:checked)_&]:block"
        attributionSplitTrustworthy={attributionSplitTrustworthy}
      />
    </section>
  );
}

/**
 * Shown only while `radioId`'s radio is checked. Scoped with `:has()` on an
 * ancestor rather than a sibling combinator, so panel order in the DOM
 * doesn't matter. No JS: the browser recomputes `:has()` on every input
 * change for free.
 */
function FunnelWindowPanel({
  funnelWindow,
  visibleClass,
  attributionSplitTrustworthy,
}: {
  funnelWindow: ChatbotAnalytics["funnels"]["d30"];
  /** A literal Tailwind variant class, not an interpolated one. See the call site. */
  visibleClass: string;
  attributionSplitTrustworthy: boolean;
}) {
  const stages = [
    {
      key: "conversations",
      label: "Conversations",
      value: funnelWindow.conversations,
      rate: null,
    },
    {
      key: "engaged",
      label: "Engaged (3+ messages or shared contact)",
      value: funnelWindow.engaged,
      rate: `${funnelWindow.engagedRatePct}% of conversations`,
    },
    {
      key: "captured",
      label: "Contact captured",
      value: funnelWindow.captured,
      rate: `${funnelWindow.capturedRateOfEngagedPct}% of engaged`,
    },
    {
      key: "booked",
      label: "Calls booked",
      value: funnelWindow.booked,
      rate: `${funnelWindow.bookedRateOfCapturedPct}% of captured`,
    },
  ];

  return (
    <div className={`mt-3 hidden ${visibleClass}`}>
      {funnelWindow.conversations === 0 ? (
        <p className="text-ui-text-subtle text-sm">
          No data yet for this time range.
        </p>
      ) : (
        <>
          <ol className="flex items-stretch gap-2 overflow-x-auto pb-1">
            {stages.map((stage, index) => (
              <li key={stage.key} className="flex shrink-0 items-center gap-2">
                {index > 0 ? (
                  <span
                    aria-hidden="true"
                    className="text-ui-text-subtle self-center text-base"
                  >
                    &rarr;
                  </span>
                ) : null}
                <div className="rounded-ui border-ui-line min-w-[8rem] border p-3">
                  <p className="text-ui-text-subtle text-[0.6875rem] font-medium tracking-wide uppercase">
                    {stage.label}
                  </p>
                  <p className="text-ui-text mt-1 text-2xl font-semibold tabular-nums">
                    {stage.value}
                  </p>
                  <p className="text-ui-text-subtle mt-0.5 text-xs tabular-nums">
                    {stage.rate ?? "starting point"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-ui-text-muted mt-2 text-xs">
            {funnelWindow.overallBookedRatePct}% of all conversations in this
            window end with a booked call.
          </p>

          <div className="border-ui-line mt-3 border-t pt-3">
            {attributionSplitTrustworthy ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <FunnelSplitStat
                  label="Booked in chat"
                  value={funnelWindow.bySource.inChat.booked}
                />
                <FunnelSplitStat
                  label="Chatted first, booked later"
                  value={funnelWindow.bySource.assisted.booked}
                />
                {/* Shown only when it is not zero, so the two columns above
                    always add up to the booked count. Most bookings reach us
                    through Close rather than the Calendly webhook, and those
                    carry no source, so hiding this would make the split look
                    like calls went missing. */}
                {funnelWindow.bySource.unrecorded.booked > 0 ? (
                  <FunnelSplitStat
                    label="Booked, source not recorded"
                    value={funnelWindow.bySource.unrecorded.booked}
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-ui-text-subtle text-xs">
                Not enough data yet to split booked calls by whether they
                happened in the chat or afterward.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FunnelSplitStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-ui border-ui-line border p-2.5">
      <p className="text-ui-text-subtle text-xs">{label}</p>
      <p className="text-ui-text mt-0.5 text-lg font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

/**
 * The daily accountability view: of everyone who chatted, who is on a
 * calendar, who is reachable, and who left holding nothing. The cost-question
 * row is broken out because it is the most common opening message on the site
 * and the one the bot answers with a calendar rather than a number, so it is
 * where a change in the script shows up first.
 */
function OutcomesTab({ analytics }: { analytics: ChatbotAnalytics }) {
  const windows = [analytics.outcomes.d7, analytics.outcomes.d30];
  return (
    <div className="grid gap-5">
      {windows.map((period) => {
        const unreachable = period.calendarAbandoned + period.leftNoContact;
        return (
          <section
            key={period.days}
            className={adminCardClass}
            aria-label={`Conversation outcomes, last ${period.days} days`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={adminEyebrowClass}>
                Last {period.days} days &middot; {period.total} conversations
              </h2>
              <p className="text-ui-text-subtle text-xs tabular-nums">
                {unreachable} we cannot contact
              </p>
            </div>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <FunnelSplitStat label="Booked a call" value={period.booked} />
              <FunnelSplitStat
                label="Saw the calendar, did not book"
                value={period.calendarAbandoned}
              />
              <FunnelSplitStat
                label="Gave details, no booking"
                value={period.capturedNoBooking}
              />
              <FunnelSplitStat
                label="Left with nothing"
                value={period.leftNoContact}
              />
              <FunnelSplitStat label="Still in progress" value={period.open} />
            </div>

            <h3 className="text-ui-text mt-5 text-sm font-semibold">
              Visitors who asked what it costs
            </h3>
            <p className="text-ui-text-subtle mt-1 text-xs">
              The bot never states a price. It opens the calendar instead, so
              this cohort is the clearest read on whether that is working. These
              four are counted independently, not as stages: someone can book
              through Calendly without ever leaving contact details in the chat,
              so Booked can exceed the count above it.
            </p>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <FunnelSplitStat
                label="Asked about cost"
                value={period.costQuestion.asked}
              />
              <FunnelSplitStat
                label="Were shown a calendar"
                value={period.costQuestion.sawCalendar}
              />
              <FunnelSplitStat
                label="Left contact details"
                value={period.costQuestion.captured}
              />
              <FunnelSplitStat
                label="Booked"
                value={period.costQuestion.booked}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function VolumeTab({ analytics }: { analytics: ChatbotAnalytics }) {
  const maxValue = Math.max(1, ...analytics.dailyTrend.map((row) => row.count));
  return (
    <section className={adminCardClass} aria-label="Daily conversation volume">
      <h2 className={adminEyebrowClass}>Conversations per day</h2>
      {analytics.dailyTrend.length ? (
        <div className="mt-3 flex items-end gap-1.5 overflow-x-auto pb-1">
          {analytics.dailyTrend.map((row) => (
            <div
              key={row.date}
              className="flex min-w-[1.25rem] flex-1 flex-col items-center gap-1.5"
            >
              <div className="flex h-24 w-full items-end justify-center">
                <div
                  className={`w-2.5 rounded-t-[2px] ${row.count > 0 ? "bg-ui-accent" : "bg-ui-line"}`}
                  style={{
                    height: `${Math.max(2, (row.count / maxValue) * 100)}%`,
                  }}
                  title={`${row.count} on ${row.date}`}
                />
              </div>
              <span className="text-ui-text-subtle text-[10px] tabular-nums">
                {formatShortDate(row.date)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No conversations yet. This fills in once visitors start chatting.
        </p>
      )}
    </section>
  );
}

function QuestionsTab({ analytics }: { analytics: ChatbotAnalytics }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <AnalyticsBreakdown
        title="Top opening questions"
        rows={analytics.topOpeningQuestions}
        emptyLabel="No opening messages captured yet."
      />
      <AnalyticsBreakdown
        title="Keyword frequency"
        rows={analytics.keywordFrequency}
        emptyLabel="No conversations to mine for keywords yet."
      />
    </div>
  );
}

function ProspectsTab({ analytics }: { analytics: ChatbotAnalytics }) {
  const { prospectDistributions } = analytics;
  const hasAny =
    prospectDistributions.capitalSignal.length ||
    prospectDistributions.timeline.length ||
    prospectDistributions.callIntent.length;

  if (!hasAny) {
    return (
      <section className={adminCardClass}>
        <p className="text-ui-text-muted text-sm">
          No prospect profiles extracted yet. This tab fills in once the
          learning loop&apos;s profile extraction runs against real
          conversations.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <AnalyticsBreakdown
        title="Capital signal"
        rows={prospectDistributions.capitalSignal}
      />
      <AnalyticsBreakdown
        title="Timeline"
        rows={prospectDistributions.timeline}
      />
      <AnalyticsBreakdown
        title="Call intent"
        rows={prospectDistributions.callIntent}
      />
    </div>
  );
}

function StatusChip({
  enabled,
  latestActivity,
}: {
  enabled: boolean;
  latestActivity: string | null;
}) {
  return (
    <div
      className="rounded-ui border-ui-line bg-ui-surface shadow-ui inline-flex items-center gap-2 border px-3 py-1.5 text-sm"
      role="status"
    >
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${enabled ? "bg-ui-ok" : "bg-ui-idle"}`}
      />
      <span className="text-ui-text font-medium">
        {enabled ? "Live for visitors" : "Off"}
      </span>
      <span className="text-ui-text-subtle">
        {latestActivity
          ? `· last activity ${relativeTime(latestActivity)}`
          : "· no activity yet"}
      </span>
    </div>
  );
}

function DeltaChip({
  metric,
}: {
  metric: ChatbotAnalytics["conversations30d"];
}) {
  if (metric.value === 0 && metric.prior === 0) {
    return (
      <span className="rounded-ui bg-ui-idle-fill text-ui-idle-ink inline-flex w-fit items-center px-1.5 py-0.5 text-[0.6875rem] font-medium">
        no activity
      </span>
    );
  }
  if (metric.deltaPct === null) {
    return (
      <span className="rounded-ui bg-ui-ok-fill text-ui-ok-ink inline-flex w-fit items-center px-1.5 py-0.5 text-[0.6875rem] font-medium">
        {metric.prior === 0 ? "new" : "no baseline"}
      </span>
    );
  }
  const rising = metric.deltaPct > 0;
  const toneClass = rising
    ? "bg-ui-ok-fill text-ui-ok-ink"
    : metric.deltaPct === 0
      ? "bg-ui-idle-fill text-ui-idle-ink"
      : "bg-ui-bad-fill text-ui-bad-ink";
  return (
    <span
      className={`rounded-ui inline-flex w-fit items-center px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums ${toneClass}`}
    >
      {metric.deltaPct === 0
        ? "flat"
        : `${rising ? "+" : "−"}${Math.abs(metric.deltaPct)}%`}
    </span>
  );
}

function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${month}/${day}`;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
