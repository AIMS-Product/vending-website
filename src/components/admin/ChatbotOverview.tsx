import Link from "next/link";
import {
  AdminDeltaChip,
  AdminIcon,
  type AdminIconName,
  adminCardClass,
  adminEyebrowClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import {
  ChatbotTrendChart,
  Sparkline,
} from "@/components/admin/ChatbotTrendChart";
import type {
  ChatbotAnalytics,
  ChatbotAnalyticsMetric,
  ChatbotDropOffBucket,
  ChatbotFunnelWindow,
  ChatbotOutcomeWindow,
} from "@/lib/chatbot/analytics";
import type {
  AdminChatbotRange,
  ChatbotInsightsKpis,
} from "@/lib/services/chatbot-insights";

/**
 * One screen that answers the four questions the team actually asks: how are
 * chats going, where do people stop, what do they ask, what needs a human.
 * Every chart is inline SVG/CSS on the admin `--ui-*` tokens; the outcome
 * colours match the chips on the Conversations list so a bar here and a tag
 * there mean the same thing.
 */
const RANGES: AdminChatbotRange[] = [7, 30, 90];
const CONVERSATIONS = "/admin/chatbot/conversations";

export function ChatbotOverview({
  analytics,
  kpis,
  range,
  enabled,
  latestActivity,
}: {
  analytics: ChatbotAnalytics;
  kpis: ChatbotInsightsKpis;
  range: AdminChatbotRange;
  enabled: boolean;
  latestActivity: string | null;
}) {
  const funnel = analytics.funnels[`d${range}`];
  const outcomes = analytics.outcomes[`d${range}`];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusChip enabled={enabled} latestActivity={latestActivity} />
        <RangeTabs range={range} />
      </div>

      <KpiCards analytics={analytics} funnel={funnel} range={range} />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="grid gap-4 xl:col-span-8">
          <TrendCard analytics={analytics} />
          <JourneyCard funnel={funnel} outcomes={outcomes} />
        </div>
        <div className="grid gap-4 xl:col-span-4">
          <NeedsYouCard kpis={kpis} />
          <AskCard analytics={analytics} outcomes={outcomes} />
        </div>
        <div className="xl:col-span-12">
          <DropOffCard buckets={analytics.dropOff} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ header */

function RangeTabs({ range }: { range: AdminChatbotRange }) {
  return (
    <nav
      className="rounded-ui border-ui-line bg-ui-surface shadow-ui inline-flex overflow-hidden border text-xs"
      aria-label="Time range"
    >
      {RANGES.map((days) => {
        const active = days === range;
        return (
          <Link
            key={days}
            href={
              days === 30 ? "/admin/chatbot" : `/admin/chatbot?range=${days}`
            }
            aria-current={active ? "page" : undefined}
            className={`px-3 py-1.5 font-medium tabular-nums ${
              active
                ? "bg-ui-accent text-white"
                : "text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text"
            }`}
          >
            {days} days
          </Link>
        );
      })}
    </nav>
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

/* --------------------------------------------------------------------- KPIs */

function KpiCards({
  analytics,
  funnel,
  range,
}: {
  analytics: ChatbotAnalytics;
  funnel: ChatbotFunnelWindow;
  range: AdminChatbotRange;
}) {
  // Prior-window deltas and sparklines come from the 30-day rollup; other
  // ranges show the number alone rather than a chip that would be invented.
  const thirty = range === 30;
  const trend = analytics.dailyTrend;
  const cards: Array<{
    icon: AdminIconName;
    label: string;
    value: number | string;
    caption: string;
    metric?: ChatbotAnalyticsMetric;
    spark?: number[];
    tone?: "accent" | "ok";
  }> = [
    {
      icon: "message-square",
      label: `Conversations · ${range}d`,
      value: funnel.conversations,
      caption: `${funnel.engaged} engaged (${funnel.engagedRatePct}%)`,
      metric: thirty ? analytics.conversations30d : undefined,
      spark: thirty ? trend.map((r) => r.count) : undefined,
    },
    {
      icon: "mail",
      label: `Contact captured · ${range}d`,
      value: funnel.captured,
      caption: `${funnel.capturedRateOfEngagedPct}% of engaged left details`,
      metric: thirty ? analytics.leadsCaptured30d : undefined,
      spark: thirty ? trend.map((r) => r.captured) : undefined,
    },
    {
      icon: "check",
      label: `Calls booked · ${range}d`,
      value: funnel.booked,
      caption: `${funnel.bookedRateOfCapturedPct}% of captured booked`,
      metric: thirty ? analytics.callsBooked30d : undefined,
      spark: thirty ? trend.map((r) => r.booked) : undefined,
      tone: "ok",
    },
    {
      icon: "target",
      label: `Book rate · ${range}d`,
      value: `${funnel.overallBookedRatePct}%`,
      caption: "of all conversations end in a call",
    },
  ];
  return (
    <section
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Chatbot summary"
    >
      {cards.map((card) => (
        <div key={card.label} className={adminCardClass}>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="bg-ui-accent-soft text-ui-accent inline-flex size-7 items-center justify-center rounded-[6px]"
            >
              <AdminIcon icon={card.icon} />
            </span>
            <p className={adminEyebrowClass}>{card.label}</p>
          </div>
          <div className="mt-3 flex items-start justify-between gap-3">
            <p className="text-ui-text text-[1.75rem] leading-none font-semibold tracking-[-0.02em] tabular-nums">
              {card.value}
            </p>
            {card.metric ? <Delta metric={card.metric} /> : null}
          </div>
          <p className="text-ui-text-muted mt-2 text-xs">{card.caption}</p>
          {card.spark ? (
            <Sparkline values={card.spark} tone={card.tone} />
          ) : (
            <div className="mt-3 h-10" aria-hidden="true" />
          )}
        </div>
      ))}
    </section>
  );
}

function Delta({ metric }: { metric: ChatbotAnalyticsMetric }) {
  if (metric.deltaPct === null) {
    return metric.value === 0 && metric.prior === 0 ? null : (
      <AdminDeltaChip tone="neutral">
        {metric.prior === 0 ? "new" : "no baseline"}
      </AdminDeltaChip>
    );
  }
  if (metric.deltaPct === 0)
    return <AdminDeltaChip tone="neutral">flat</AdminDeltaChip>;
  const up = metric.deltaPct > 0;
  return (
    <AdminDeltaChip tone={up ? "up" : "down"}>
      {up ? "↗ +" : "↘ −"}
      {Math.abs(metric.deltaPct)}%
    </AdminDeltaChip>
  );
}

/* -------------------------------------------------------------------- trend */

function TrendCard({ analytics }: { analytics: ChatbotAnalytics }) {
  const rows = analytics.dailyTrend;
  const total = rows.reduce((s, r) => s + r.count, 0);
  const priorTotal = analytics.dailyTrendPrior.reduce((s, r) => s + r.count, 0);
  return (
    <section className={adminCardClass} aria-label="Conversations over time">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={adminSectionTitleClass}>Conversations over time</h2>
          <p className="text-ui-text-muted mt-0.5 text-xs">
            Chats started per day, last 30 days against the prior 30 (dashed).
            Hover any day for the exact counts.
          </p>
        </div>
        <div className="text-ui-text-muted flex items-center gap-4 text-xs tabular-nums">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="bg-ui-accent inline-block h-0.5 w-4 rounded-full"
            />
            {total} this period
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="border-ui-line-strong inline-block w-4 border-t border-dashed"
            />
            {priorTotal} prior
          </span>
        </div>
      </div>
      <ChatbotTrendChart rows={rows} prior={analytics.dailyTrendPrior} />
    </section>
  );
}

/* ------------------------------------------------------------------ journey */

/**
 * Conversations -> engaged -> left details -> booked as full-width blue bars.
 * Width is share of everyone who started; the arrow figure is the step rate
 * from the row above. Beneath, the three leaks, linked to those transcripts.
 */
function JourneyCard({
  funnel,
  outcomes,
}: {
  funnel: ChatbotFunnelWindow;
  outcomes: ChatbotOutcomeWindow;
}) {
  const total = Math.max(1, funnel.conversations);
  const stages = [
    {
      label: "Started a chat",
      value: funnel.conversations,
      shade: "bg-ui-accent",
    },
    { label: "Engaged", value: funnel.engaged, shade: "bg-ui-accent/85" },
    { label: "Left details", value: funnel.captured, shade: "bg-ui-accent/70" },
    { label: "Booked a call", value: funnel.booked, shade: "bg-ui-accent/55" },
  ];
  const leaks = [
    {
      count: outcomes.leftNoContact,
      label: "Left without a word",
      hint: "no details, never came back",
      tone: "bad" as const,
      href: `${CONVERSATIONS}?outcome=left_no_contact`,
    },
    {
      count: outcomes.calendarAbandoned,
      label: "Saw the calendar, did not book",
      hint: "the leak worth fixing first",
      tone: "warn" as const,
      href: `${CONVERSATIONS}?outcome=calendar_abandoned`,
    },
    {
      count: outcomes.capturedNoBooking,
      label: "Gave details, still no call",
      hint: "a human can recover these",
      tone: "accent" as const,
      href: `${CONVERSATIONS}?outcome=captured_no_booking`,
    },
  ];

  return (
    <section className={adminCardClass} aria-label="Conversation journey">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className={adminSectionTitleClass}>Conversation journey</h2>
          <p className="text-ui-text-muted mt-0.5 text-xs">
            Everyone who started a chat in this window, followed through to a
            booked call.
          </p>
        </div>
        <Link
          href={CONVERSATIONS}
          className="text-ui-accent text-xs font-medium whitespace-nowrap hover:underline"
        >
          Open conversations →
        </Link>
      </div>

      <ol className="mt-4 grid gap-3.5">
        {stages.map((stage, index) => {
          const prev = index === 0 ? stage.value : stages[index - 1].value;
          const step = prev > 0 ? Math.round((stage.value / prev) * 100) : 0;
          return (
            <li key={stage.label} className="grid gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className={adminEyebrowClass}>{stage.label}</span>
                <span className="text-ui-text text-sm font-semibold tabular-nums">
                  {stage.value}
                  {index > 0 ? (
                    <span className="text-ui-text-subtle ml-1.5 text-xs font-normal">
                      → {step}%
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="bg-ui-canvas h-2 w-full overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${stage.shade}`}
                  style={{
                    width:
                      stage.value > 0
                        ? `max(4px, ${(stage.value / total) * 100}%)`
                        : 0,
                  }}
                  aria-hidden="true"
                />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-ui-line mt-5 grid gap-2 border-t pt-4 sm:grid-cols-3">
        {leaks.map((leak) => (
          <Link
            key={leak.label}
            href={leak.href}
            className="hover:bg-ui-canvas rounded-ui -m-1 flex items-start gap-2.5 p-2"
          >
            <span
              className={`mt-0.5 inline-flex min-w-[2.25rem] justify-center rounded-[4px] px-1.5 py-0.5 text-sm font-semibold tabular-nums ${toneChip(leak.tone)}`}
            >
              {leak.count}
            </span>
            <span className="min-w-0">
              <span className="text-ui-text block text-xs font-medium">
                {leak.label}
              </span>
              <span className="text-ui-text-subtle block text-[0.6875rem]">
                {leak.hint}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- drop-off */

const OUTCOME_SERIES = [
  { key: "booked", label: "Booked", fill: "bg-ui-ok" },
  { key: "capturedNoBooking", label: "Details, no call", fill: "bg-ui-accent" },
  {
    key: "calendarAbandoned",
    label: "Calendar, no booking",
    fill: "bg-ui-warn",
  },
  { key: "leftNoContact", label: "Left", fill: "bg-ui-bad" },
  { key: "open", label: "In progress", fill: "bg-ui-idle" },
] as const;

function DropOffCard({ buckets }: { buckets: ChatbotDropOffBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const total = buckets.reduce((sum, b) => sum + b.total, 0);
  const oneAndDone = buckets[0]?.total ?? 0;
  return (
    <section className={adminCardClass} aria-label="Where people stop">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={adminSectionTitleClass}>Where people stop</h2>
          <p className="text-ui-text-muted mt-0.5 text-xs">
            How many messages a visitor sent before the chat ended, coloured by
            how it ended. Last 30 days.
            {total > 0 ? (
              <>
                {" "}
                <span className="text-ui-text font-semibold tabular-nums">
                  {Math.round((oneAndDone / total) * 100)}%
                </span>{" "}
                sent one message and left, so the first answer is the one to
                improve.
              </>
            ) : null}
          </p>
        </div>
        <div className="text-ui-text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem]">
          {OUTCOME_SERIES.map((series) => (
            <span key={series.key} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${series.fill}`}
              />
              {series.label}
            </span>
          ))}
        </div>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-5">
        {buckets.map((bucket) => (
          <li key={bucket.label} className="grid gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className={adminEyebrowClass}>{bucket.label}</span>
              <span className="text-ui-text text-sm font-semibold tabular-nums">
                {bucket.total}
              </span>
            </div>
            <div className="bg-ui-canvas flex h-2.5 w-full overflow-hidden rounded-full">
              {OUTCOME_SERIES.map((series) =>
                bucket[series.key] > 0 ? (
                  <div
                    key={series.key}
                    className={series.fill}
                    style={{
                      width: `${(bucket[series.key] / max) * 100}%`,
                    }}
                    title={`${bucket[series.key]} ${series.label.toLowerCase()}`}
                  />
                ) : null,
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------------------------------------------------------------------- ask */

function AskCard({
  analytics,
  outcomes,
}: {
  analytics: ChatbotAnalytics;
  outcomes: ChatbotOutcomeWindow;
}) {
  const questions = analytics.topOpeningQuestions.slice(0, 5);
  const sum = Math.max(
    1,
    analytics.topOpeningQuestions.reduce((s, q) => s + q.count, 0),
  );
  const cost = outcomes.costQuestion;
  const costShare =
    outcomes.total > 0 ? Math.round((cost.asked / outcomes.total) * 100) : 0;
  const costBookRate =
    cost.asked > 0 ? Math.round((cost.booked / cost.asked) * 100) : 0;

  return (
    <section className={adminCardClass} aria-label="What people ask">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className={adminSectionTitleClass}>What people ask first</h2>
          <p className="text-ui-text-muted mt-0.5 text-xs">
            Opening messages, grouped.
          </p>
        </div>
        <Link
          href={`${CONVERSATIONS}?outcome=asked_about_cost`}
          className="text-ui-accent text-xs font-medium whitespace-nowrap hover:underline"
        >
          Cost chats →
        </Link>
      </div>
      {questions.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-xs">
          No opening messages in this window yet.
        </p>
      ) : (
        <ol className="mt-3 grid gap-2.5">
          {questions.map((row) => (
            <li key={row.label} className="grid gap-1 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ui-text truncate">{row.label}</span>
                <span className="text-ui-text font-semibold whitespace-nowrap tabular-nums">
                  {row.count}
                  <span className="text-ui-text-subtle ml-1.5 font-normal">
                    {Math.round((row.count / sum) * 100)}%
                  </span>
                </span>
              </div>
              <div className="bg-ui-canvas h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-ui-accent h-full rounded-full"
                  style={{ width: `max(3px, ${(row.count / sum) * 100}%)` }}
                  aria-hidden="true"
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="border-ui-line mt-4 border-t pt-3">
        <p className="text-ui-text-muted text-xs">
          <span className="text-ui-text font-semibold tabular-nums">
            {costShare}%
          </span>{" "}
          ask what it costs;{" "}
          <span className="text-ui-text font-semibold tabular-nums">
            {costBookRate}%
          </span>{" "}
          of them book a call.
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
          {[
            ["Asked", cost.asked],
            ["Calendar", cost.sawCalendar],
            ["Details", cost.captured],
            ["Booked", cost.booked],
          ].map(([label, value]) => (
            <div
              key={label}
              className="bg-ui-accent-soft rounded-[4px] px-1 py-1.5"
            >
              <p className="text-ui-text text-sm font-semibold tabular-nums">
                {value}
              </p>
              <p className="text-ui-text-subtle text-[0.6875rem]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- needs you */

function NeedsYouCard({ kpis }: { kpis: ChatbotInsightsKpis }) {
  const items = [
    {
      chip: "Question",
      tone: "warn" as const,
      count: kpis.unansweredQuestionsCount,
      label: "the bot could not answer",
      action: "Answer",
      href: "/admin/chatbot/insights",
    },
    {
      chip: "Follow-up",
      tone: "accent" as const,
      count: kpis.followUpTasksDueTodayCount,
      label: "due today, drafted and waiting",
      action: "Review",
      href: "/admin/chatbot/insights",
    },
    {
      chip: "Flagged",
      tone: "bad" as const,
      count: kpis.needsPromptTuningCount,
      label: "chats need prompt tuning",
      action: "Read",
      href: `${CONVERSATIONS}?flag=needs_prompt_tuning`,
    },
    {
      chip: "Insight",
      tone: "ok" as const,
      count: kpis.knowledgeFixesCount + kpis.siteRecsCount,
      label: "knowledge and site fixes suggested",
      action: "Open",
      href: "/admin/chatbot/insights",
    },
  ];
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <section className={adminCardClass} aria-label="Needs your attention">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={adminSectionTitleClass}>Needs your attention</h2>
        <span className="text-ui-text-subtle text-xs tabular-nums">
          {total}
        </span>
      </div>
      <ul className="divide-ui-line mt-2 divide-y">
        {items.map((item) => (
          <li
            key={item.chip}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[0.6875rem] font-medium ${toneChip(item.tone)}`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-1.5 rounded-full bg-current"
                  />
                  {item.chip}
                </span>
                <span className="text-ui-text-subtle text-xs tabular-nums">
                  {item.count}
                </span>
              </span>
              <span className="text-ui-text mt-1 block text-sm">
                <span className="font-semibold tabular-nums">{item.count}</span>{" "}
                {item.label}
              </span>
            </span>
            <Link
              href={item.href}
              className="text-ui-accent text-xs font-medium whitespace-nowrap hover:underline"
            >
              {item.action} →
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-ui-text-subtle mt-3 text-xs">
        {kpis.lastLearningRun
          ? `Learning pass ran ${relativeTime(kpis.lastLearningRun.startedAt)}.`
          : "No learning pass has run yet."}{" "}
        Nothing sends without a human.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ helpers */

type Tone = "ok" | "warn" | "bad" | "accent" | "idle";

function toneChip(tone: Tone): string {
  return {
    ok: "bg-ui-ok-fill text-ui-ok-ink",
    warn: "bg-ui-warn-fill text-ui-warn-ink",
    bad: "bg-ui-bad-fill text-ui-bad-ink",
    accent: "bg-ui-accent-soft text-ui-accent",
    idle: "bg-ui-idle-fill text-ui-idle-ink",
  }[tone];
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
