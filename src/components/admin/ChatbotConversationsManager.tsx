import Link from "next/link";
import {
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminPanelClass,
} from "@/components/admin/AdminUi";
import { CHATBOT_FLAGS, type ChatbotFlag } from "@/lib/chatbot/flags";
import type {
  AdminChatbotConversationListItem,
  AdminChatbotConversationsResult,
  AdminChatbotSort,
  ChatbotConversationOutcome,
} from "@/lib/services/chatbot-admin";

const FLAG_LABELS: Record<ChatbotFlag, string> = {
  quality_good: "Good quality",
  quality_bad: "Bad quality",
  needs_prompt_tuning: "Needs prompt tuning",
  lead_high_intent: "High intent",
  lead_low_intent: "Low intent",
  followup_needed: "Follow-up needed",
  handoff_missed: "Missed handoff",
};

/**
 * The outcome filter, ordered by what the team should work first: people who
 * saw a calendar and did not book, then people we can still reach, then the
 * ones we lost outright. "Asked about cost" is not an outcome — it is the
 * cohort cut, kept alongside because it is the site's most common question.
 */
const OUTCOME_CHIPS: { value: string; label: string }[] = [
  { value: "calendar_abandoned", label: "Saw calendar, no booking" },
  { value: "captured_no_booking", label: "Reachable, no booking" },
  { value: "left_no_contact", label: "Left with nothing" },
  { value: "booked", label: "Booked" },
  { value: "open", label: "In progress" },
  { value: "asked_about_cost", label: "Asked about cost" },
];

const OUTCOME_BADGES: Record<
  ChatbotConversationOutcome,
  { label: string; tone: string } | null
> = {
  booked: null,
  calendar_abandoned: {
    label: "Saw calendar, no booking",
    tone: "bg-ui-warn-fill text-ui-warn-ink",
  },
  captured_no_booking: {
    label: "No booking yet",
    tone: "bg-ui-line text-ui-text-muted",
  },
  left_no_contact: {
    label: "Nothing captured",
    tone: "bg-ui-line text-ui-text-muted",
  },
  open: null,
};

const SORT_OPTIONS: { value: AdminChatbotSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_messages", label: "Most messages" },
];

export function ChatbotConversationsManager({
  result,
  q,
  sort,
  flag,
  outcome,
}: {
  result: AdminChatbotConversationsResult;
  q: string;
  sort: AdminChatbotSort;
  flag: string;
  outcome: string;
}) {
  return (
    <div className="grid gap-5">
      <AdminMetricStrip>
        <AdminMetricPanel
          label="Total"
          value={result.totalCount}
          caption="conversations"
        />
        {result.outcomesTrustworthy ? (
          <>
            <AdminMetricPanel
              label="Booked"
              value={result.outcomeCounts.booked}
              caption="calls on the calendar"
            />
            <AdminMetricPanel
              label="Saw calendar, no booking"
              value={result.outcomeCounts.calendar_abandoned}
              caption="the leak"
            />
            <AdminMetricPanel
              label="Left with nothing"
              value={result.outcomeCounts.left_no_contact}
              caption="no contact captured"
            />
            <AdminMetricPanel
              label="Asked about cost"
              value={result.costQuestionCount}
              caption="of all conversations"
            />
          </>
        ) : (
          // Pre-migration fallback: the outcome split is unknowable, so the
          // strip keeps the flag metrics that still work rather than leaving
          // a single lonely Total tile.
          <>
            <AdminMetricPanel
              label="High intent"
              value={result.highIntentCount}
              caption="flagged"
            />
            <AdminMetricPanel
              label="Missed handoffs"
              value={result.missedHandoffCount}
              caption="flagged"
            />
            <AdminMetricPanel
              label="Bad quality"
              value={result.badQualityCount}
              caption="flagged"
            />
          </>
        )}
      </AdminMetricStrip>

      <section className={adminPanelClass}>
        <div className="border-ui-line grid gap-3 border-b p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SearchForm q={q} sort={sort} flag={flag} outcome={outcome} />
            <SortNav active={sort} q={q} flag={flag} outcome={outcome} />
          </div>
          {result.outcomesTrustworthy ? (
            <OutcomeChips
              active={outcome}
              q={q}
              sort={sort}
              flag={flag}
              counts={result.outcomeCounts}
              costQuestionCount={result.costQuestionCount}
              total={result.totalCount}
            />
          ) : null}
          <FlagChips
            active={flag}
            q={q}
            sort={sort}
            outcome={outcome}
            counts={result.flagCounts}
            total={result.totalCount}
          />
        </div>

        {result.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-ui-line bg-ui-canvas text-ui-text-subtle border-b text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2">
                    Visitor
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Opening message
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Messages
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Last activity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-ui-line divide-y">
                {result.items.map((item) => (
                  <ConversationRow
                    key={item.id}
                    item={item}
                    showOutcome={result.outcomesTrustworthy}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <h2 className="text-ui-text text-lg font-semibold">
              No conversations match
            </h2>
            <p className="text-ui-text-muted mt-2 text-sm">
              Change the search or filters, or check back once visitors start
              chatting.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ConversationRow({
  item,
  showOutcome,
}: {
  item: AdminChatbotConversationListItem;
  showOutcome: boolean;
}) {
  return (
    <tr className="hover:bg-ui-canvas">
      <td className="px-4 py-3">
        <Link
          href={`/admin/chatbot/conversations/${item.id}`}
          className="text-ui-text hover:text-ui-accent font-medium"
        >
          {item.capturedEmail || item.capturedName || "Anonymous visitor"}
        </Link>
        {item.flags.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.flags.map((flagValue) => (
              <span
                key={flagValue}
                className="bg-ui-line text-ui-text-muted rounded-full px-1.5 py-0.5 text-[0.6875rem] font-medium"
              >
                {FLAG_LABELS[flagValue]}
              </span>
            ))}
          </div>
        ) : null}
      </td>
      <td
        className="text-ui-text-muted max-w-[360px] truncate px-3 py-3"
        title={item.firstUserMessage ?? undefined}
      >
        {item.firstUserMessage ?? "—"}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <AdminStatusBadge status={item.status} />
          {item.callBookedAt ? (
            <span className="rounded-ui bg-ui-ok-fill text-ui-ok-ink inline-flex items-center px-1.5 py-0.5 text-[0.6875rem] font-medium">
              Booked
            </span>
          ) : null}
          {showOutcome ? <OutcomeBadge outcome={item.outcome} /> : null}
          {item.askedAboutCost ? (
            <span className="rounded-ui bg-ui-line text-ui-text-muted inline-flex items-center px-1.5 py-0.5 text-[0.6875rem] font-medium">
              Asked cost
            </span>
          ) : null}
        </div>
      </td>
      <td className="text-ui-text px-3 py-3 tabular-nums">
        {item.messageCount}
      </td>
      <td className="text-ui-text-subtle px-4 py-3 text-right text-xs tabular-nums">
        {relativeTime(item.lastMessageAt)}
      </td>
    </tr>
  );
}

function SearchForm({
  q,
  sort,
  flag,
  outcome,
}: {
  q: string;
  sort: AdminChatbotSort;
  flag: string;
  outcome: string;
}) {
  return (
    <form method="GET" className="flex items-center gap-2">
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="outcome" value={outcome} />
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Search name, email, or opening message"
        className="border-ui-line-strong bg-ui-surface text-ui-text focus:border-ui-accent focus:ring-ui-accent/15 rounded-ui w-72 border px-2.5 py-1.5 text-sm outline-none focus:ring-2"
      />
      <button
        type="submit"
        className="rounded-ui border-ui-line-strong bg-ui-surface text-ui-text shadow-ui hover:bg-ui-canvas h-9 border px-3 text-sm font-medium"
      >
        Search
      </button>
    </form>
  );
}

function SortNav({
  active,
  q,
  flag,
  outcome,
}: {
  active: AdminChatbotSort;
  q: string;
  flag: string;
  outcome: string;
}) {
  return (
    <nav
      className="rounded-ui border-ui-line bg-ui-canvas inline-flex flex-wrap items-center gap-0.5 border p-0.5"
      aria-label="Sort conversations"
    >
      {SORT_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={conversationsHref({ q, flag, outcome, sort: option.value })}
          aria-current={active === option.value ? "page" : undefined}
          className={`rounded-[4px] px-2.5 py-1 text-[0.8125rem] transition ${
            active === option.value
              ? "bg-ui-surface text-ui-text shadow-ui font-medium"
              : "text-ui-text-muted hover:text-ui-text"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

function FlagChips({
  active,
  q,
  sort,
  outcome,
  counts,
  total,
}: {
  active: string;
  q: string;
  sort: AdminChatbotSort;
  outcome: string;
  counts: Record<ChatbotFlag, number>;
  total: number;
}) {
  return (
    <nav
      className="rounded-ui border-ui-line bg-ui-canvas inline-flex flex-wrap items-center gap-0.5 border p-0.5"
      aria-label="Flag filters"
    >
      <Link
        href={conversationsHref({ q, sort, flag: "all", outcome })}
        aria-current={active === "all" ? "page" : undefined}
        className={`rounded-[4px] px-2.5 py-1 text-[0.8125rem] transition ${
          active === "all"
            ? "bg-ui-surface text-ui-text shadow-ui font-medium"
            : "text-ui-text-muted hover:text-ui-text"
        }`}
      >
        All {total}
      </Link>
      {CHATBOT_FLAGS.map((flagValue) => (
        <Link
          key={flagValue}
          href={conversationsHref({ q, sort, flag: flagValue, outcome })}
          aria-current={active === flagValue ? "page" : undefined}
          className={`rounded-[4px] px-2.5 py-1 text-[0.8125rem] transition ${
            active === flagValue
              ? "bg-ui-surface text-ui-text shadow-ui font-medium"
              : "text-ui-text-muted hover:text-ui-text"
          }`}
        >
          {FLAG_LABELS[flagValue]} {counts[flagValue]}
        </Link>
      ))}
    </nav>
  );
}

function conversationsHref(params: {
  q: string;
  sort: AdminChatbotSort;
  flag: string;
  outcome: string;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.sort !== "newest") search.set("sort", params.sort);
  if (params.flag !== "all") search.set("flag", params.flag);
  if (params.outcome !== "all") search.set("outcome", params.outcome);
  const qs = search.toString();
  return qs
    ? `/admin/chatbot/conversations?${qs}`
    : "/admin/chatbot/conversations";
}

function OutcomeBadge({ outcome }: { outcome: ChatbotConversationOutcome }) {
  const badge = OUTCOME_BADGES[outcome];
  if (!badge) return null;
  return (
    <span
      className={`rounded-ui inline-flex items-center px-1.5 py-0.5 text-[0.6875rem] font-medium ${badge.tone}`}
    >
      {badge.label}
    </span>
  );
}

function OutcomeChips({
  active,
  q,
  sort,
  flag,
  counts,
  costQuestionCount,
  total,
}: {
  active: string;
  q: string;
  sort: AdminChatbotSort;
  flag: string;
  counts: Record<ChatbotConversationOutcome, number>;
  costQuestionCount: number;
  total: number;
}) {
  const countFor = (value: string) =>
    value === "asked_about_cost"
      ? costQuestionCount
      : (counts[value as ChatbotConversationOutcome] ?? 0);

  return (
    <nav
      className="rounded-ui border-ui-line bg-ui-canvas inline-flex flex-wrap items-center gap-0.5 border p-0.5"
      aria-label="Outcome filters"
    >
      <Link
        href={conversationsHref({ q, sort, flag, outcome: "all" })}
        aria-current={active === "all" ? "page" : undefined}
        className={`rounded-[4px] px-2.5 py-1 text-[0.8125rem] transition ${
          active === "all"
            ? "bg-ui-surface text-ui-text shadow-ui font-medium"
            : "text-ui-text-muted hover:text-ui-text"
        }`}
      >
        Every outcome {total}
      </Link>
      {OUTCOME_CHIPS.map((chip) => (
        <Link
          key={chip.value}
          href={conversationsHref({ q, sort, flag, outcome: chip.value })}
          aria-current={active === chip.value ? "page" : undefined}
          className={`rounded-[4px] px-2.5 py-1 text-[0.8125rem] transition ${
            active === chip.value
              ? "bg-ui-surface text-ui-text shadow-ui font-medium"
              : "text-ui-text-muted hover:text-ui-text"
          }`}
        >
          {chip.label} {countFor(chip.value)}
        </Link>
      ))}
    </nav>
  );
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
