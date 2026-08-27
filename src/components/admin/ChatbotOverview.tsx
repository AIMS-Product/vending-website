import Link from "next/link";
import {
  AdminBar,
  AdminDeltaChip,
  adminCardClass,
  adminEyebrowClass,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
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

      <KpiStrip
        funnel={funnel}
        range={range}
        metrics={{
          conversations: analytics.conversations30d,
          captured: analytics.leadsCaptured30d,
          booked: analytics.callsBooked30d,
        }}
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <FlowCard funnel={funnel} outcomes={outcomes} />
        </div>
        <div className="xl:col-span-5">
          <NeedsYouCard kpis={kpis} />
        </div>
        <div className="xl:col-span-6">
          <DropOffCard buckets={analytics.dropOff} />
        </div>
        <div className="xl:col-span-6">
          <AskCard analytics={analytics} outcomes={outcomes} />
        </div>
        <div className="xl:col-span-12">
          <TrendCard rows={analytics.dailyTrend} />
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
            {days}d
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

function KpiStrip({
  funnel,
  range,
  metrics,
}: {
  funnel: ChatbotFunnelWindow;
  range: AdminChatbotRange;
  metrics: {
    conversations: ChatbotAnalyticsMetric;
    captured: ChatbotAnalyticsMetric;
    booked: ChatbotAnalyticsMetric;
  };
}) {
  // Prior-window deltas only exist for the 30-day rollup; other ranges show
  // the number alone rather than a chip that would have to be invented.
  const delta = (metric: ChatbotAnalyticsMetric) =>
    range === 30 ? <Delta metric={metric} /> : null;
  const cells = [
    {
      label: "Conversations",
      value: funnel.conversations,
      caption: "started a chat",
      delta: delta(metrics.conversations),
    },
    {
      label: "Engaged",
      value: funnel.engaged,
      caption: `${funnel.engagedRatePct}% of conversations`,
    },
    {
      label: "Contact captured",
      value: funnel.captured,
      caption: `${funnel.capturedRateOfEngagedPct}% of engaged`,
      delta: delta(metrics.captured),
    },
    {
      label: "Calls booked",
      value: funnel.booked,
      caption: `${funnel.bookedRateOfCapturedPct}% of captured`,
      delta: delta(metrics.booked),
    },
    {
      label: "Book rate",
      value: `${funnel.overallBookedRatePct}%`,
      caption: "of all conversations end in a call",
    },
  ];
  return (
    <section className={adminPanelClass} aria-label="Chatbot summary">
      <div className="divide-ui-line grid divide-y sm:grid-cols-2 sm:divide-x lg:grid-cols-5 lg:divide-y-0">
        {cells.map((cell) => (
          <div key={cell.label} className="px-4 py-3.5">
            <p className={adminEyebrowClass}>{cell.label}</p>
            <p className="text-ui-text mt-2 text-2xl leading-none font-semibold tracking-[-0.02em] tabular-nums">
              {cell.value}
            </p>
            <p className="text-ui-text-muted mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              {cell.delta}
              {cell.caption}
            </p>
          </div>
        ))}
      </div>
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
      {up ? "+" : "−"}
      {Math.abs(metric.deltaPct)}%
    </AdminDeltaChip>
  );
}

/* --------------------------------------------------------------------- flow */

/**
 * Conversations -> engaged -> contact captured -> booked as proportional
 * bars, each stage carrying the leak that happened at that step. Wide-to-
 * narrow is the whole story; the leak chips name where the width went and
 * link straight to those transcripts.
 */
function FlowCard({
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
      leak: null,
    },
    {
      label: "Engaged",
      value: funnel.engaged,
      leak: {
        count: outcomes.leftNoContact,
        label: "left without a word",
        tone: "bad" as const,
        href: `${CONVERSATIONS}?outcome=left_no_contact`,
      },
    },
    {
      label: "Left contact details",
      value: funnel.captured,
      leak: {
        count: outcomes.calendarAbandoned,
        label: "saw the calendar, no booking",
        tone: "warn" as const,
        href: `${CONVERSATIONS}?outcome=calendar_abandoned`,
      },
    },
    {
      label: "Booked a call",
      value: funnel.booked,
      leak: {
        count: outcomes.capturedNoBooking,
        label: "gave details, still no call",
        tone: "accent" as const,
        href: `${CONVERSATIONS}?outcome=captured_no_booking`,
      },
    },
  ];

  return (
    <section
      className={`${adminCardClass} h-full`}
      aria-label="Conversation flow"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={adminSectionTitleClass}>Where conversations go</h2>
        <p className="text-ui-text-subtle text-xs tabular-nums">
          {outcomes.open} still in progress
        </p>
      </div>
      <ol className="mt-4 grid gap-3">
        {stages.map((stage, index) => {
          const share = stage.value / total;
          const prev = index === 0 ? stage.value : stages[index - 1].value;
          const stepPct = prev > 0 ? Math.round((stage.value / prev) * 100) : 0;
          return (
            <li key={stage.label} className="grid gap-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-ui-text font-medium">{stage.label}</span>
                <span className="text-ui-text-muted tabular-nums">
                  <span className="text-ui-text font-semibold">
                    {stage.value}
                  </span>
                  {index > 0 ? ` · ${stepPct}% of previous` : null}
                </span>
              </div>
              <div className="bg-ui-canvas h-6 w-full overflow-hidden rounded-[3px]">
                <div
                  className={`h-full ${index === stages.length - 1 ? "bg-ui-ok" : "bg-ui-accent"}`}
                  style={{
                    width: stage.value > 0 ? `max(3px, ${share * 100}%)` : 0,
                    opacity: index === stages.length - 1 ? 1 : 1 - index * 0.2,
                  }}
                  aria-hidden="true"
                />
              </div>
              {stage.leak && stage.leak.count > 0 ? (
                <Link
                  href={stage.leak.href}
                  className="text-ui-text-muted hover:text-ui-text inline-flex w-fit items-center gap-1.5 text-xs"
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block size-1.5 rounded-full ${toneDot(stage.leak.tone)}`}
                  />
                  <span className="tabular-nums">
                    <span className="text-ui-text font-semibold">
                      {stage.leak.count}
                    </span>{" "}
                    {stage.leak.label}
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
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
    <section
      className={`${adminCardClass} h-full`}
      aria-label="Where people stop"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={adminSectionTitleClass}>Where people stop</h2>
        <p className="text-ui-text-subtle text-xs">last 30 days</p>
      </div>
      <p className="text-ui-text-muted mt-1 text-xs">
        Visitor messages per chat, coloured by how it ended.{" "}
        {total > 0 ? (
          <>
            <span className="text-ui-text font-semibold tabular-nums">
              {Math.round((oneAndDone / total) * 100)}%
            </span>{" "}
            sent one message and left, so the first answer is the one to
            improve.
          </>
        ) : null}
      </p>
      <ol className="mt-4 grid gap-2.5">
        {buckets.map((bucket) => (
          <li
            key={bucket.label}
            className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3 text-xs"
          >
            <span className="text-ui-text-muted">{bucket.label}</span>
            <div
              className="flex h-5 overflow-hidden rounded-[3px]"
              style={{ width: `${(bucket.total / max) * 100}%` }}
              aria-hidden="true"
            >
              {OUTCOME_SERIES.map((series) =>
                bucket[series.key] > 0 ? (
                  <div
                    key={series.key}
                    className={series.fill}
                    style={{
                      width: `${(bucket[series.key] / bucket.total) * 100}%`,
                    }}
                    title={`${bucket[series.key]} ${series.label.toLowerCase()}`}
                  />
                ) : null,
              )}
            </div>
            <span className="text-ui-text text-right font-semibold tabular-nums">
              {bucket.total}
            </span>
          </li>
        ))}
      </ol>
      <div className="text-ui-text-muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem]">
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
  const questions = analytics.topOpeningQuestions.slice(0, 6);
  const maxCount = Math.max(1, ...questions.map((q) => q.count));
  const cost = outcomes.costQuestion;
  const costShare =
    outcomes.total > 0 ? Math.round((cost.asked / outcomes.total) * 100) : 0;
  const costBookRate =
    cost.asked > 0 ? Math.round((cost.booked / cost.asked) * 100) : 0;

  return (
    <section
      className={`${adminCardClass} h-full`}
      aria-label="What people ask"
    >
      <h2 className={adminSectionTitleClass}>What people ask first</h2>
      {questions.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-xs">
          No opening messages in this window yet.
        </p>
      ) : (
        <ol className="mt-3 grid gap-2">
          {questions.map((row) => (
            <li key={row.label} className="grid gap-1 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ui-text truncate">{row.label}</span>
                <span className="text-ui-text font-semibold tabular-nums">
                  {row.count}
                </span>
              </div>
              <AdminBar share={row.count / maxCount} />
            </li>
          ))}
        </ol>
      )}

      <div className="border-ui-line mt-4 border-t pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-ui-text text-xs font-semibold">
            The cost question
          </h3>
          <Link
            href={`${CONVERSATIONS}?outcome=asked_about_cost`}
            className="text-ui-accent text-xs hover:underline"
          >
            See those chats →
          </Link>
        </div>
        <p className="text-ui-text-muted mt-1 text-xs">
          <span className="text-ui-text font-semibold tabular-nums">
            {costShare}%
          </span>{" "}
          of visitors ask what it costs;{" "}
          <span className="text-ui-text font-semibold tabular-nums">
            {costBookRate}%
          </span>{" "}
          of them book.
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          {[
            ["Asked", cost.asked],
            ["Saw calendar", cost.sawCalendar],
            ["Left details", cost.captured],
            ["Booked", cost.booked],
          ].map(([label, value]) => (
            <div key={label} className="bg-ui-canvas rounded-[3px] px-2 py-1.5">
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

/* -------------------------------------------------------------------- trend */

function TrendCard({ rows }: { rows: ChatbotAnalytics["dailyTrend"] }) {
  const width = 600;
  const height = 120;
  const padX = 4;
  const padY = 6;
  const max = Math.max(1, ...rows.map((row) => row.count));
  const stepX = rows.length > 1 ? (width - padX * 2) / (rows.length - 1) : 0;
  const x = (i: number) => padX + i * stepX;
  const y = (v: number) => height - padY - (v / max) * (height - padY * 2);

  const line = rows.map((row, i) => `${x(i)},${y(row.count)}`).join(" ");
  const area =
    rows.length > 1
      ? `M${x(0)},${height - padY} L${line.split(" ").join(" L")} L${x(rows.length - 1)},${height - padY} Z`
      : "";
  const bookedLine = rows.map((row, i) => `${x(i)},${y(row.booked)}`).join(" ");
  const totals = rows.reduce(
    (acc, row) => ({
      count: acc.count + row.count,
      booked: acc.booked + row.booked,
    }),
    { count: 0, booked: 0 },
  );

  return (
    <section className={adminCardClass} aria-label="Daily trend">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={adminSectionTitleClass}>
          Conversations and bookings per day
        </h2>
        <div className="text-ui-text-muted flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="bg-ui-accent size-2 rounded-full"
            />
            {totals.count} conversations
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="bg-ui-ok size-2 rounded-full" />
            {totals.booked} booked
          </span>
        </div>
      </div>
      {rows.length < 2 ? (
        <p className="text-ui-text-subtle mt-3 text-xs">Not enough days yet.</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="mt-3 h-32 w-full"
            role="img"
            aria-label={`${totals.count} conversations and ${totals.booked} bookings over ${rows.length} days`}
            preserveAspectRatio="none"
          >
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={padX}
                x2={width - padX}
                y1={y(max * f)}
                y2={y(max * f)}
                stroke="var(--ui-line)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={area} fill="var(--ui-accent)" fillOpacity={0.12} />
            <polyline
              points={line}
              fill="none"
              stroke="var(--ui-accent)"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={bookedLine}
              fill="none"
              stroke="var(--ui-ok)"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {rows.map((row, i) =>
              row.booked > 0 ? (
                <circle
                  key={row.date}
                  cx={x(i)}
                  cy={y(row.booked)}
                  r={3}
                  fill="var(--ui-ok)"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null,
            )}
          </svg>
          <div className="text-ui-text-subtle mt-1 flex justify-between text-[10px] tabular-nums">
            {rows
              .filter(
                (_, i) =>
                  i % Math.ceil(rows.length / 6) === 0 || i === rows.length - 1,
              )
              .map((row) => (
                <span key={row.date}>{formatShortDate(row.date)}</span>
              ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- needs you */

function NeedsYouCard({ kpis }: { kpis: ChatbotInsightsKpis }) {
  const items = [
    {
      label: "Questions the bot couldn't answer",
      count: kpis.unansweredQuestionsCount,
      href: "/admin/chatbot/insights",
      tone:
        kpis.unansweredQuestionsCount > 0
          ? ("warn" as const)
          : ("idle" as const),
      hint: "Answer one and it goes into the knowledge base.",
    },
    {
      label: "Follow-ups due today",
      count: kpis.followUpTasksDueTodayCount,
      href: "/admin/chatbot/insights",
      tone:
        kpis.followUpTasksDueTodayCount > 0
          ? ("accent" as const)
          : ("idle" as const),
      hint: `${kpis.followUpTasksReadyCount} drafted, nothing sends on its own.`,
    },
    {
      label: "Chats flagged for prompt tuning",
      count: kpis.needsPromptTuningCount,
      href: `${CONVERSATIONS}?flag=needs_prompt_tuning`,
      tone:
        kpis.needsPromptTuningCount > 0 ? ("bad" as const) : ("idle" as const),
      hint: "Where Mia said something the team should read.",
    },
    {
      label: "Knowledge and site fixes suggested",
      count: kpis.knowledgeFixesCount + kpis.siteRecsCount,
      href: "/admin/chatbot/insights",
      tone: "idle" as const,
      hint: "From the learning pass.",
    },
  ];
  return (
    <section className={`${adminCardClass} h-full`} aria-label="Needs you">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={adminSectionTitleClass}>Needs you</h2>
        <p className="text-ui-text-subtle text-xs">
          {kpis.lastLearningRun
            ? `learning pass ${relativeTime(kpis.lastLearningRun.startedAt)}`
            : "no learning pass yet"}
        </p>
      </div>
      <ul className="divide-ui-line mt-2 divide-y">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="hover:bg-ui-canvas -mx-2 flex items-center gap-3 rounded-[3px] px-2 py-2.5"
            >
              <span
                className={`inline-flex min-w-[2rem] justify-center rounded-[3px] px-1.5 py-0.5 text-sm font-semibold tabular-nums ${toneChip(item.tone)}`}
              >
                {item.count}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-ui-text block text-sm">{item.label}</span>
                <span className="text-ui-text-subtle block text-xs">
                  {item.hint}
                </span>
              </span>
              <span aria-hidden="true" className="text-ui-text-subtle">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ helpers */

type Tone = "ok" | "warn" | "bad" | "accent" | "idle";

function toneDot(tone: Tone): string {
  return {
    ok: "bg-ui-ok",
    warn: "bg-ui-warn",
    bad: "bg-ui-bad",
    accent: "bg-ui-accent",
    idle: "bg-ui-idle",
  }[tone];
}

function toneChip(tone: Tone): string {
  return {
    ok: "bg-ui-ok-fill text-ui-ok-ink",
    warn: "bg-ui-warn-fill text-ui-warn-ink",
    bad: "bg-ui-bad-fill text-ui-bad-ink",
    accent: "bg-ui-accent-soft text-ui-accent",
    idle: "bg-ui-idle-fill text-ui-idle-ink",
  }[tone];
}

function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${month}/${day}`;
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
