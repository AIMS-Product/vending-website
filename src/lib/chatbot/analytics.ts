import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hostNameFromPayload } from "@/lib/chatbot/calendly-host";
import {
  resolveBookingCredit,
  resolveFirstTouch,
  type FirstTouch,
} from "@/lib/chatbot/booking-credit";
import {
  askedAboutCost,
  calendarWasShown,
  deriveConversationOutcome,
} from "@/lib/chatbot/outcomes";
import { triageConversation } from "@/lib/chatbot/triage";
import type { Database, Json, Tables } from "@/types/database";

type ChatbotAnalyticsClient = Pick<SupabaseClient<Database>, "from">;
type ConversationRow = Pick<
  Tables<"chatbot_conversations">,
  | "id"
  | "created_at"
  | "message_count"
  | "captured_email"
  | "captured_phone"
  | "messages"
  | "prospect_profile"
  | "booked_event_uri"
  | "attribution_source"
> & {
  /** Absent until 20260821140000_chatbot_v2_conversion has been applied. */
  call_booked_at?: string | null;
  lead_submission_id?: string | null;
};

/**
 * Windowed count with a same-length prior comparison — the same
 * value/prior/deltaPct shape used on /admin/analytics, so the chatbot page
 * reads as the same product.
 */
export type ChatbotAnalyticsMetric = {
  value: number;
  prior: number;
  deltaPct: number | null;
};

export type ChatbotDailyTrendRow = {
  date: string;
  count: number;
  /** Conversations started that day that ended with a call on the calendar. */
  booked: number;
  /** Conversations started that day that left an email or phone. */
  captured: number;
};

/**
 * Where conversations end, by how many turns the visitor took. The admin
 * overview stacks these to show whether people leave after one message
 * (the greeting/first answer is the problem) or deep in (the close is).
 */
export type ChatbotDropOffBucket = {
  label: string;
  total: number;
  booked: number;
  calendarAbandoned: number;
  capturedNoBooking: number;
  leftNoContact: number;
  open: number;
};
export type ChatbotRankedRow = { label: string; count: number };

/** Raw counts for one stage of the funnel, for one slice (whole window or one attribution bucket). */
export type ChatbotFunnelStageCounts = {
  conversations: number;
  engaged: number;
  captured: number;
  booked: number;
};

export type ChatbotFunnelWindow = ChatbotFunnelStageCounts & {
  days: number;
  engagedRatePct: number;
  capturedRateOfEngagedPct: number;
  bookedRateOfCapturedPct: number;
  overallBookedRatePct: number;
  /**
   * `booked`, split by who got the person onto the calendar (last touch).
   * Every one of these chatted with the bot; `byFirstTouch` says whether the
   * chat was their first touch. The three counts always add up to `booked`.
   *
   * Resolved by lib/chatbot/booking-credit.ts, the same rule the conversation
   * page uses. `inChat` is only exact once `attributionSplitTrustworthy` is
   * true; before that it leans on the Calendly event URI heuristic.
   */
  bookedBy: {
    /** Calendly echoed the chat calendar's own utm back: the chatbot booked it. */
    inChat: number;
    /** A setter called/texted and booked them after the chat. */
    setter: number;
    /**
     * Of `setter`, how many name a setter Close did not state but the
     * reconciler inferred from the last call/SMS before the booking
     * (`setter_touch_name`). A guess, shown as one.
     */
    setterInferred: number;
    /**
     * Booked outside the chat with no setter recorded in Close. Never folded
     * into `inChat` -- that was the bug this split exists to fix.
     */
    unknown: number;
    /** `setter` broken down by setter name, most bookings first. */
    setters: ChatbotRankedRow[];
    /**
     * The same booked calls, first touch x last touch. `chatbot`: the chat
     * came first. `earlier`: already in Close (webinar, Typeform, a setter's
     * Instagram lead) before they ever chatted, so the chat was a middle
     * touch. `unlinked`: no lead behind the chat at all, so there is nothing
     * to check. `unknown`: a lead exists but Close's date is not mirrored onto
     * it yet. See resolveFirstTouch.
     */
    byFirstTouch: Record<FirstTouch["kind"], LastTouchCounts>;
    /** `byFirstTouch.earlier` broken down by that earlier source. */
    earlierSources: ChatbotRankedRow[];
  };
  /**
   * Chats in this window left out of every count above because they were never
   * a sales opportunity: existing-member support (triage.ts), and people whose
   * call was already booked before they chatted.
   */
  excluded: { support: number; bookedBeforeChat: number };
};

/** Booked calls by who got them onto the calendar. */
export type LastTouchCounts = {
  inChat: number;
  setter: number;
  unknown: number;
};

function emptyLastTouch(): LastTouchCounts {
  return { inChat: 0, setter: 0, unknown: 0 };
}

/**
 * What happened to the visitors we did not book, and what the cost question
 * specifically did to them. Cost is broken out because it is the single most
 * common opening message on this site and the one the bot answers with a
 * calendar instead of a number.
 */
export type ChatbotOutcomeWindow = {
  days: number;
  total: number;
  booked: number;
  calendarAbandoned: number;
  capturedNoBooking: number;
  leftNoContact: number;
  open: number;
  /** The cost-question cohort, tracked stage by stage through the same window. */
  costQuestion: {
    asked: number;
    sawCalendar: number;
    captured: number;
    booked: number;
  };
  /**
   * Widget quick-action clicks that stayed in the chat, counted per
   * conversation from the stored transcript (`data.via = "quick_action"`).
   * `bookedAfterCalendar` is the chats that opened the calendar that way and
   * then booked. Clicks on plain link actions go to PostHog only.
   */
  quickActions: {
    calendar: number;
    resource: number;
    bookedAfterCalendar: number;
  };
};

export type ChatbotAnalytics = {
  conversations30d: ChatbotAnalyticsMetric;
  conversations7d: number;
  leadsCaptured30d: ChatbotAnalyticsMetric;
  /** The v2 headline: booked calls attributed to a chat conversation. */
  callsBooked30d: ChatbotAnalyticsMetric;
  captureRatePct: number;
  /**
   * The slide for the sales team: how many conversations became captured
   * leads, and how many of those became a call on the calendar.
   */
  funnel30d: {
    conversations: number;
    captured: number;
    booked: number;
    capturedRatePct: number;
    bookedRatePct: number;
  };
  avgMessagesPerConversation: number;
  dailyTrend: ChatbotDailyTrendRow[];
  /** The 30 days before `dailyTrend`, same shape, for the comparison line. */
  dailyTrendPrior: ChatbotDailyTrendRow[];
  topOpeningQuestions: ChatbotRankedRow[];
  keywordFrequency: ChatbotRankedRow[];
  /** Empty until conversations start carrying an extracted prospect_profile. */
  prospectDistributions: {
    capitalSignal: ChatbotRankedRow[];
    timeline: ChatbotRankedRow[];
    callIntent: ChatbotRankedRow[];
  };
  /**
   * The four-stage funnel (conversations -> engaged -> captured -> booked)
   * over three windows, with booked split by who got them on the calendar.
   * Additive alongside `funnel30d`, which other surfaces (insights, digest)
   * already read and which keeps its original 3-stage shape unchanged.
   */
  funnels: {
    d7: ChatbotFunnelWindow;
    d30: ChatbotFunnelWindow;
    d90: ChatbotFunnelWindow;
  };
  /**
   * False until the attribution_source column has been read successfully at
   * least once for this rollup. When false, `bookedBy.inChat` is a guess from
   * the Calendly event URI and the UI should say so rather than render a
   * confident split.
   */
  attributionSplitTrustworthy: boolean;
  /** Outcome breakdown for the last 7, 30 and 90 days. See ChatbotOutcomeWindow. */
  outcomes: {
    d7: ChatbotOutcomeWindow;
    d30: ChatbotOutcomeWindow;
    d90: ChatbotOutcomeWindow;
  };
  /** Last 30 days, bucketed by visitor turns. See ChatbotDropOffBucket. */
  dropOff: ChatbotDropOffBucket[];
};

const emptyOutcomeWindow = (days: number): ChatbotOutcomeWindow => ({
  days,
  total: 0,
  booked: 0,
  calendarAbandoned: 0,
  capturedNoBooking: 0,
  leftNoContact: 0,
  open: 0,
  costQuestion: { asked: 0, sawCalendar: 0, captured: 0, booked: 0 },
  quickActions: { calendar: 0, resource: 0, bookedAfterCalendar: 0 },
});

export const EMPTY_CHATBOT_ANALYTICS: ChatbotAnalytics = {
  conversations30d: { value: 0, prior: 0, deltaPct: null },
  conversations7d: 0,
  leadsCaptured30d: { value: 0, prior: 0, deltaPct: null },
  callsBooked30d: { value: 0, prior: 0, deltaPct: null },
  captureRatePct: 0,
  funnel30d: {
    conversations: 0,
    captured: 0,
    booked: 0,
    capturedRatePct: 0,
    bookedRatePct: 0,
  },
  avgMessagesPerConversation: 0,
  dailyTrend: [],
  dailyTrendPrior: [],
  topOpeningQuestions: [],
  keywordFrequency: [],
  prospectDistributions: { capitalSignal: [], timeline: [], callIntent: [] },
  funnels: {
    d7: emptyFunnelWindow(7),
    d30: emptyFunnelWindow(30),
    d90: emptyFunnelWindow(90),
  },
  attributionSplitTrustworthy: false,
  outcomes: {
    d7: emptyOutcomeWindow(7),
    d30: emptyOutcomeWindow(30),
    d90: emptyOutcomeWindow(90),
  },
  dropOff: [],
};

function emptyFunnelWindow(days: number): ChatbotFunnelWindow {
  const emptyStage: ChatbotFunnelStageCounts = {
    conversations: 0,
    engaged: 0,
    captured: 0,
    booked: 0,
  };
  return {
    days,
    ...emptyStage,
    engagedRatePct: 0,
    capturedRateOfEngagedPct: 0,
    bookedRateOfCapturedPct: 0,
    overallBookedRatePct: 0,
    excluded: { support: 0, bookedBeforeChat: 0 },
    bookedBy: {
      ...emptyLastTouch(),
      setterInferred: 0,
      setters: [],
      byFirstTouch: {
        chatbot: emptyLastTouch(),
        earlier: emptyLastTouch(),
        unlinked: emptyLastTouch(),
        unknown: emptyLastTouch(),
      },
      earlierSources: [],
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const FETCH_WINDOW_DAYS = 90;
// ponytail: caps the rollup at the most recent 4000 rows instead of a real
// aggregate query. Fine at chatbot launch volume — move to SQL-side
// aggregation (date_trunc + count) once conversation volume makes an
// in-memory scan slow. At >~44 conversations/day sustained, 90 days of rows
// exceeds this cap and the 90d funnel silently undercounts — watch
// funnels.d90.conversations against that ceiling as volume grows.
const FETCH_CAP = 4000;
const TOP_N = 12;

const ROW_FIELDS =
  "id, created_at, message_count, captured_email, captured_phone, messages, prospect_profile, lead_submission_id, call_booked_at, booked_event_uri, attribution_source" as const;

// One column back from ROW_FIELDS: call_booked_at + booked_event_uri already
// applied, but the (hand-applied) attribution_source migration is not.
const ROW_FIELDS_NO_ATTRIBUTION =
  "id, created_at, message_count, captured_email, captured_phone, messages, prospect_profile, lead_submission_id, call_booked_at, booked_event_uri" as const;

// Pre-v2-migration column list — same tolerant-fallback pattern as
// chatbot/config.ts. Without it, a deploy that lands before the v2 migration
// is applied would blank the entire /admin/chatbot page rather than just the
// one metric that has no data yet.
const LEGACY_ROW_FIELDS =
  "id, created_at, message_count, captured_email, captured_phone, messages, prospect_profile, lead_submission_id" as const;

/**
 * Requires BOTH one of our column names and an undefined-column signal. A bare
 * name match alone let any unrelated error that happened to mention the column
 * fall back to a narrower select, which quietly dropped a metric instead of
 * surfacing the real failure.
 */
function isMissingColumnError(message: string): boolean {
  const namesAColumn =
    message.includes("call_booked_at") ||
    message.includes("booked_event_uri") ||
    message.includes("attribution_source");
  if (!namesAColumn) return false;
  return (
    message.includes("42703") ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

type ServiceDeps = { client?: ChatbotAnalyticsClient; now?: () => Date };

/**
 * Zero-LLM heuristic rollup for /admin/chatbot. Never throws — the table may
 * not exist yet (migration ships ahead of being run) or the query may fail
 * transiently, and either way the admin page should render an honest empty
 * state instead of a 500.
 */
export async function getChatbotAnalytics(
  deps: ServiceDeps = {},
): Promise<ChatbotAnalytics> {
  try {
    const client = deps.client ?? createAdminClient();
    const now = deps.now ? deps.now() : new Date();
    // Prior-window comparisons (conversations30d etc.) need 2x WINDOW_DAYS of
    // history; the widest funnel window needs FETCH_WINDOW_DAYS. Fetch back
    // far enough for both in one query.
    const fetchStart = new Date(
      now.getTime() - Math.max(2 * WINDOW_DAYS, FETCH_WINDOW_DAYS) * DAY_MS,
    );

    const { rows, attributionSplitTrustworthy } = await fetchConversationRows(
      client,
      fetchStart,
    );

    const { ids: bookedLeadIds, bookedOn } = await fetchBookedLeadIds(
      client,
      rows.map((row) => row.lead_submission_id),
    );
    const excluded: ExcludedChat[] = [];
    // A quick-action click with no visitor message creates a row but is not a
    // conversation: it stays off every funnel denominator (and off the
    // left-out caption), and is counted on the Quick actions card instead. A
    // booking made from that calendar still counts, same rule as the triage:
    // the chat's own calendar stamp always counts. So does a pre-chat-gate
    // capture, which also has no visitor message yet.
    const conversationRows = rows.filter(
      (row) =>
        userTurns(row.messages) > 0 ||
        Boolean(row.call_booked_at) ||
        isCaptured(row),
    );
    const quickActionRows = rows.filter(
      (row) => triageConversation(row.messages) !== "support",
    );
    const salesRows = conversationRows.filter((row) => {
      const reason = exclusionReason(row, bookedOn);
      if (reason) excluded.push({ createdAt: row.created_at, reason });
      return reason === null;
    });
    const bookedRows = salesRows.filter((row) => isBooked(row, bookedLeadIds));
    const bookedEventLinks = await fetchBookedEventLinks(client, bookedRows);
    const creditByLead = await fetchLeadCredit(
      client,
      bookedRows.map((row) => effectiveLeadId(row, bookedEventLinks)),
    );
    return withQuickActions(
      buildAnalytics(
        salesRows,
        now,
        bookedLeadIds,
        attributionSplitTrustworthy,
        creditByLead,
        bookedEventLinks,
        excluded,
      ),
      quickActionRows,
      now,
      bookedLeadIds,
    );
  } catch (error) {
    console.warn("chatbot analytics load failed, returning empty rollup", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return EMPTY_CHATBOT_ANALYTICS;
  }
}

type ExcludedChat = {
  createdAt: string;
  reason: keyof ChatbotFunnelWindow["excluded"];
};

const PACIFIC_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
});

/**
 * Why a chat is not a sales opportunity, or null when it is.
 *
 * `bookedBeforeChat`: the lead's Close "First Sales Call Booked Date" is a
 * DATE, so the test is day-grained and deliberately one-sided. The chat's day
 * is taken in Pacific time, the latest US zone, so a booking made after the
 * chat can never read as earlier. A booking made earlier on the SAME day as
 * the chat still counts as after it.
 * ponytail: same-day pre-chat bookings stay credited; exact order needs the
 * booking's timestamp from calendly_bookings.
 */
function exclusionReason(
  row: ConversationRow,
  bookedOn: ReadonlyMap<string, string | null>,
): ExcludedChat["reason"] | null {
  // The chat's own calendar stamped this booking, so it came from the chat and
  // always counts, whatever the visitor asked first.
  if (row.call_booked_at) return null;
  if (triageConversation(row.messages) === "support") return "support";
  if (!row.lead_submission_id) return null;
  const booked = bookedOn.get(row.lead_submission_id)?.slice(0, 10);
  if (!booked) return null;
  const chatDay = PACIFIC_DATE.format(new Date(row.created_at));
  return booked < chatDay ? "bookedBeforeChat" : null;
}

/**
 * Cascading tolerant fetch: try the full row shape, then drop
 * attribution_source (the newest, hand-applied migration), then drop
 * call_booked_at/booked_event_uri too (the v2 migration). Whichever tier
 * succeeds wins — a deploy ahead of any one migration degrades that one
 * signal instead of blanking the whole admin page. Each tier is inlined
 * (rather than sharing one `.select(fields)` helper) because Supabase infers
 * the returned row shape from the literal string passed to `.select()` —
 * widening that to a `string` parameter breaks the inference entirely.
 */
async function fetchConversationRows(
  client: ChatbotAnalyticsClient,
  fetchStart: Date,
): Promise<{ rows: ConversationRow[]; attributionSplitTrustworthy: boolean }> {
  const full = await client
    .from("chatbot_conversations")
    .select(ROW_FIELDS)
    .gte("created_at", fetchStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(FETCH_CAP);
  if (!full.error) {
    return {
      rows: (full.data ?? []) as ConversationRow[],
      attributionSplitTrustworthy: true,
    };
  }
  if (!isMissingColumnError(full.error.message)) {
    throw new Error(full.error.message);
  }

  const noAttribution = await client
    .from("chatbot_conversations")
    .select(ROW_FIELDS_NO_ATTRIBUTION)
    .gte("created_at", fetchStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(FETCH_CAP);
  if (!noAttribution.error) {
    return {
      rows: (noAttribution.data ?? []) as ConversationRow[],
      attributionSplitTrustworthy: false,
    };
  }
  if (!isMissingColumnError(noAttribution.error.message)) {
    throw new Error(noAttribution.error.message);
  }

  const legacy = await client
    .from("chatbot_conversations")
    .select(LEGACY_ROW_FIELDS)
    .gte("created_at", fetchStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(FETCH_CAP);
  if (legacy.error) throw new Error(legacy.error.message);
  return {
    rows: (legacy.data ?? []) as ConversationRow[],
    attributionSplitTrustworthy: false,
  };
}

/**
 * Lead ids whose call is booked according to Close.
 *
 * This is the signal that actually works today. The Calendly webhook has
 * never had a signing key in production, so conversation.call_booked_at is
 * empty there; the Close reconciliation
 * (.claude/specs/2026-08-20-booking-attribution.md) already marks
 * lead_submissions.call_booked_at for every synced lead, and every captured
 * chatbot conversation carries a lead_submission_id. Counting both means the
 * booked-call KPI reports real numbers with no Calendly work at all, and
 * upgrades itself for free the day the webhook is fixed.
 */
/**
 * Shared with /admin/chatbot/conversations: most bookings on this site reach
 * us through the Close reconciler rather than the Calendly webhook, and those
 * land on the LEAD row, not the conversation row. Any surface that decides
 * "did this conversation book?" from `call_booked_at` alone reports people who
 * are on a rep's calendar as abandoned.
 */
export async function fetchBookedLeadIds(
  client: ChatbotAnalyticsClient,
  candidateLeadIds: readonly (string | null | undefined)[],
): Promise<{
  ids: ReadonlySet<string>;
  /** Lead id -> Close's booked DATE (YYYY-MM-DD), for pre-chat checks. */
  bookedOn: ReadonlyMap<string, string | null>;
  complete: boolean;
}> {
  const leadIds = Array.from(
    new Set(candidateLeadIds.filter((id): id is string => Boolean(id))),
  );
  const bookedOn = new Map<string, string | null>();
  if (leadIds.length === 0) {
    return { ids: new Set(), bookedOn, complete: true };
  }

  // Chunked because these ids ride in the query string: a full page of
  // conversations is up to 500 UUIDs, roughly 20KB, past what proxies in front
  // of PostgREST will accept on a GET.
  const ids = new Set<string>();
  for (let start = 0; start < leadIds.length; start += LEAD_LOOKUP_CHUNK) {
    const chunk = leadIds.slice(start, start + LEAD_LOOKUP_CHUNK);
    const { data, error } = await client
      .from("lead_submissions")
      .select("id, call_booked_at")
      .in("id", chunk)
      .not("call_booked_at", "is", null);
    if (error) {
      console.warn(
        "chatbot analytics: Close-reconciled booking lookup failed",
        {
          error: error.message,
        },
      );
      // Partial results would understate bookings and overstate the leak, so
      // the caller is told the answer is incomplete rather than handed a set
      // that looks authoritative.
      return { ids, bookedOn, complete: false };
    }
    for (const row of data ?? []) {
      ids.add(row.id);
      bookedOn.set(row.id, row.call_booked_at ?? null);
    }
  }
  return { ids, bookedOn, complete: true };
}

const LEAD_LOOKUP_CHUNK = 100;

/** What the booking reconciler mirrored from Close for one lead. */
export type LeadCredit = {
  /** Close "Reactivation - Setter Name": a human stated it. */
  setter: string | null;
  /** setter_touch_name: inferred from the last Close call/SMS before booking. */
  touchSetter: string | null;
  resourceTag: string | null;
  closeCreatedAt: string | null;
};

/** The setter credited with a booking: stated first, inferred second. */
export function creditedSetter(lead: LeadCredit | undefined): string | null {
  return lead?.setter ?? lead?.touchSetter ?? null;
}

/**
 * Close's credit fields per booked lead, as mirrored by the booking
 * reconciler: who booked them, their Resource Tag, and when Close created them.
 *
 * Tolerant: a failed read, or a deploy ahead of the credit migrations, returns
 * what it has. A lead with nothing mirrored resolves to "booked elsewhere" and
 * first touch "not checked yet" -- never to the chatbot.
 */
export async function fetchLeadCredit(
  client: ChatbotAnalyticsClient,
  candidateLeadIds: readonly (string | null | undefined)[],
): Promise<ReadonlyMap<string, LeadCredit>> {
  const leadIds = Array.from(
    new Set(candidateLeadIds.filter((id): id is string => Boolean(id))),
  );
  const credit = new Map<string, LeadCredit>();
  for (let start = 0; start < leadIds.length; start += LEAD_LOOKUP_CHUNK) {
    const { rows, error } = await readCreditChunk(
      client,
      leadIds.slice(start, start + LEAD_LOOKUP_CHUNK),
    );
    if (error) {
      console.warn("chatbot analytics: lead credit lookup failed", { error });
      return credit;
    }
    for (const row of rows) {
      credit.set(row.id, {
        setter: row.booked_by_setter?.trim() || null,
        touchSetter: row.setter_touch_name?.trim() || null,
        resourceTag: row.entry_resource_tag,
        closeCreatedAt: row.close_lead_created_at,
      });
    }
  }
  return credit;
}

type CreditRow = {
  id: string;
  booked_by_setter: string | null;
  setter_touch_name?: string | null;
  entry_resource_tag: string | null;
  close_lead_created_at: string | null;
};

/**
 * setter_touch_name ships in its own hand-applied migration. Without it, read
 * the stated setter alone rather than lose every credit on the page.
 */
async function readCreditChunk(
  client: ChatbotAnalyticsClient,
  chunk: string[],
): Promise<{ rows: CreditRow[]; error: string | null }> {
  const full = await client
    .from("lead_submissions")
    .select(
      "id, booked_by_setter, setter_touch_name, entry_resource_tag, close_lead_created_at",
    )
    .in("id", chunk);
  // Cast: the generated types predate 20260912130000_setter_touch.sql.
  if (!full.error) {
    return { rows: (full.data ?? []) as unknown as CreditRow[], error: null };
  }
  if (!full.error.message.includes("setter_touch_name")) {
    return { rows: [], error: full.error.message };
  }
  const stated = await client
    .from("lead_submissions")
    .select("id, booked_by_setter, entry_resource_tag, close_lead_created_at")
    .in("id", chunk);
  return stated.error
    ? { rows: [], error: stated.error.message }
    : { rows: stated.data ?? [], error: null };
}

/**
 * What the Calendly booking behind each booked chat knows: the lead it is
 * linked to, and (when asked) who Calendly assigned the call to.
 *
 * A visitor who books straight from the in-chat calendar without giving the
 * bot their details leaves `chatbot_conversations.lead_submission_id` null:
 * applyChatbotBookingAttribution stamps the booking onto the conversation but
 * never the lead, while recordCalendlyBooking separately links the
 * `calendly_bookings` row to a lead by invitee email. The booking is the join
 * between them, and `booked_event_uri` matches it exactly -- better than
 * utm_content, which an email_match booking never carries.
 *
 * Read-only recovery on purpose: it fixes rows already written as well as new
 * ones, where stamping the column at booking time would only ever fix new
 * ones. Anything unreadable returns nothing, which leaves the chat resolving
 * to "No lead linked" rather than to a guess.
 *
 * ponytail: `includeHost` pulls whole `raw_payload` blobs (~2.4KB each) to
 * read one name out of them, because that is the only place the host is
 * stored. Fine while a window holds tens of booked chats; the upgrade is a
 * host_name column on calendly_bookings written by recordCalendlyBooking.
 */
export type BookedEventLink = {
  leadId: string | null;
  hostName: string | null;
};

export async function fetchBookedEventLinks(
  client: ChatbotAnalyticsClient,
  rows: ReadonlyArray<{ id: string; booked_event_uri?: string | null }>,
  options: { includeHost?: boolean } = {},
): Promise<ReadonlyMap<string, BookedEventLink>> {
  const byEventUri = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.booked_event_uri) continue;
    const ids = byEventUri.get(row.booked_event_uri);
    if (ids) ids.push(row.id);
    else byEventUri.set(row.booked_event_uri, [row.id]);
  }

  const links = new Map<string, BookedEventLink>();
  const uris = Array.from(byEventUri.keys());
  // Wrapped, not just error-checked: this is the rollup's only read of
  // calendly_bookings, and a table that is absent or unreadable in an
  // environment must cost the first-touch labels, not the whole dashboard.
  try {
    for (let start = 0; start < uris.length; start += LEAD_LOOKUP_CHUNK) {
      const chunk = uris.slice(start, start + LEAD_LOOKUP_CHUNK);
      const { data, error } = options.includeHost
        ? await client
            .from("calendly_bookings")
            .select("scheduled_event_uri, lead_submission_id, raw_payload")
            .in("scheduled_event_uri", chunk)
        : await client
            .from("calendly_bookings")
            .select("scheduled_event_uri, lead_submission_id")
            .in("scheduled_event_uri", chunk);
      if (error) {
        console.warn("chatbot analytics: booked-event lookup failed", {
          error: error.message,
        });
        return links;
      }
      for (const row of data ?? []) {
        if (!row.scheduled_event_uri) continue;
        const link: BookedEventLink = {
          leadId: row.lead_submission_id ?? null,
          hostName:
            "raw_payload" in row ? hostNameFromPayload(row.raw_payload) : null,
        };
        for (const conversationId of byEventUri.get(row.scheduled_event_uri) ??
          []) {
          links.set(conversationId, link);
        }
      }
    }
  } catch (error) {
    console.warn("chatbot analytics: booked-event lookup threw", {
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
  return links;
}

/**
 * The lead a booked chat resolves to: its own, or the one on the Calendly
 * booking it produced. Null when there is no lead anywhere.
 */
export function effectiveLeadId(
  row: { id: string; lead_submission_id?: string | null },
  links: ReadonlyMap<string, BookedEventLink>,
): string | null {
  return row.lead_submission_id ?? links.get(row.id)?.leadId ?? null;
}

function buildAnalytics(
  rows: ConversationRow[],
  now: Date,
  bookedLeadIds: ReadonlySet<string> = new Set(),
  attributionSplitTrustworthy = false,
  creditByLead: ReadonlyMap<string, LeadCredit> = new Map(),
  bookedEventLinks: ReadonlyMap<string, BookedEventLink> = new Map(),
  excluded: readonly ExcludedChat[] = [],
): ChatbotAnalytics {
  const start = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const priorStart = new Date(start.getTime() - WINDOW_DAYS * DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

  const current = rows.filter((row) => inWindow(row.created_at, start, now));
  const prior = rows.filter((row) =>
    inWindow(row.created_at, priorStart, start),
  );
  const conversations7d = current.filter((row) =>
    inWindow(row.created_at, sevenDaysAgo, now),
  ).length;

  const currentCaptured = current.filter(isCaptured);
  const priorCaptured = prior.filter(isCaptured);
  const booked = (row: ConversationRow) => isBooked(row, bookedLeadIds);
  const currentBooked = current.filter(booked);
  const priorBooked = prior.filter(booked);

  const totalMessages = current.reduce(
    (sum, row) => sum + (row.message_count ?? 0),
    0,
  );

  return {
    conversations30d: buildMetric(current.length, prior.length),
    conversations7d,
    leadsCaptured30d: buildMetric(currentCaptured.length, priorCaptured.length),
    callsBooked30d: buildMetric(currentBooked.length, priorBooked.length),
    captureRatePct: ratePct(currentCaptured.length, current.length),
    funnel30d: {
      conversations: current.length,
      captured: currentCaptured.length,
      booked: currentBooked.length,
      capturedRatePct: ratePct(currentCaptured.length, current.length),
      // Deliberately measured against captured, not against all
      // conversations: it answers "of the people who engaged enough to leave
      // details, how many got on the calendar", which is the number the sales
      // team can actually act on.
      bookedRatePct: ratePct(currentBooked.length, currentCaptured.length),
    },
    avgMessagesPerConversation: current.length
      ? Math.round((totalMessages / current.length) * 10) / 10
      : 0,
    dailyTrend: buildDailyTrend(current, start, now, bookedLeadIds),
    dailyTrendPrior: buildDailyTrend(prior, priorStart, start, bookedLeadIds),
    topOpeningQuestions: topOpeningQuestions(current),
    keywordFrequency: keywordFrequency(current),
    prospectDistributions: buildProspectDistributions(current),
    funnels: {
      d7: buildFunnelWindow(
        7,
        rows,
        now,
        bookedLeadIds,
        creditByLead,
        bookedEventLinks,
        excluded,
      ),
      d30: buildFunnelWindow(
        30,
        rows,
        now,
        bookedLeadIds,
        creditByLead,
        bookedEventLinks,
        excluded,
      ),
      d90: buildFunnelWindow(
        90,
        rows,
        now,
        bookedLeadIds,
        creditByLead,
        bookedEventLinks,
        excluded,
      ),
    },
    attributionSplitTrustworthy,
    outcomes: {
      d7: buildOutcomeWindow(7, rows, now, bookedLeadIds),
      d30: buildOutcomeWindow(WINDOW_DAYS, rows, now, bookedLeadIds),
      d90: buildOutcomeWindow(90, rows, now, bookedLeadIds),
    },
    dropOff: buildDropOff(current, now, bookedLeadIds),
  };
}

const DROP_OFF_BUCKETS: ReadonlyArray<{ label: string; max: number }> = [
  { label: "1 message", max: 1 },
  { label: "2", max: 2 },
  { label: "3-4", max: 4 },
  { label: "5-9", max: 9 },
  { label: "10+", max: Infinity },
];

function outcomeOf(
  row: ConversationRow,
  now: Date,
  bookedLeadIds: ReadonlySet<string>,
) {
  const booked = isBooked(row, bookedLeadIds);
  return deriveConversationOutcome(
    {
      messages: row.messages,
      capturedEmail: row.captured_email,
      capturedPhone: row.captured_phone,
      callBookedAt: booked ? (row.call_booked_at ?? row.created_at) : null,
      lastMessageAt: null,
      createdAt: row.created_at,
    },
    now,
  );
}

function userTurns(messages: Json): number {
  if (!Array.isArray(messages)) return 0;
  return messages.filter(
    (m) =>
      typeof m === "object" &&
      m !== null &&
      (m as { role?: unknown }).role === "user",
  ).length;
}

function buildDropOff(
  rows: ConversationRow[],
  now: Date,
  bookedLeadIds: ReadonlySet<string>,
): ChatbotDropOffBucket[] {
  const buckets = DROP_OFF_BUCKETS.map((b) => ({
    label: b.label,
    total: 0,
    booked: 0,
    calendarAbandoned: 0,
    capturedNoBooking: 0,
    leftNoContact: 0,
    open: 0,
  }));
  for (const row of rows) {
    const turns = userTurns(row.messages);
    if (turns === 0) continue;
    const index = DROP_OFF_BUCKETS.findIndex((b) => turns <= b.max);
    const bucket = buckets[index];
    bucket.total += 1;
    const outcome = outcomeOf(row, now, bookedLeadIds);
    if (outcome === "booked") bucket.booked += 1;
    else if (outcome === "calendar_abandoned") bucket.calendarAbandoned += 1;
    else if (outcome === "captured_no_booking") bucket.capturedNoBooking += 1;
    else if (outcome === "left_no_contact") bucket.leftNoContact += 1;
    else bucket.open += 1;
  }
  return buckets;
}

/**
 * Outcome rollup for one window. `isBooked` (not just call_booked_at) decides
 * the booked case so a call reconciled through the lead row counts the same as
 * one the Calendly webhook caught — otherwise the dashboard would show people
 * as abandoned who are on a rep's calendar.
 */
function buildOutcomeWindow(
  days: number,
  rows: ConversationRow[],
  now: Date,
  bookedLeadIds: ReadonlySet<string>,
): ChatbotOutcomeWindow {
  const start = new Date(now.getTime() - days * DAY_MS);
  const windowRows = rows.filter((row) => inWindow(row.created_at, start, now));

  const result = emptyOutcomeWindow(days);
  result.total = windowRows.length;

  for (const row of windowRows) {
    const booked = isBooked(row, bookedLeadIds);
    const outcome = outcomeOf(row, now, bookedLeadIds);

    if (outcome === "booked") result.booked += 1;
    else if (outcome === "calendar_abandoned") result.calendarAbandoned += 1;
    else if (outcome === "captured_no_booking") result.capturedNoBooking += 1;
    else if (outcome === "left_no_contact") result.leftNoContact += 1;
    else result.open += 1;

    if (askedAboutCost(row.messages)) {
      result.costQuestion.asked += 1;
      if (calendarWasShown(row.messages)) result.costQuestion.sawCalendar += 1;
      if (isCaptured(row)) result.costQuestion.captured += 1;
      if (booked) result.costQuestion.booked += 1;
    }
  }

  return result;
}

/**
 * Quick-action counts per window, over every non-support chat INCLUDING the
 * ones with no visitor message (someone who only clicked "Book a call"), which
 * the funnel leaves out. Returns a new analytics object.
 */
function withQuickActions(
  analytics: ChatbotAnalytics,
  rows: readonly ConversationRow[],
  now: Date,
  bookedLeadIds: ReadonlySet<string>,
): ChatbotAnalytics {
  const counts = (days: number) => {
    const start = new Date(now.getTime() - days * DAY_MS);
    const result = { calendar: 0, resource: 0, bookedAfterCalendar: 0 };
    for (const row of rows) {
      if (!inWindow(row.created_at, start, now)) continue;
      if (hasQuickAction(row.messages, "calendar")) {
        result.calendar += 1;
        if (isBooked(row, bookedLeadIds)) result.bookedAfterCalendar += 1;
      }
      if (hasQuickAction(row.messages, "shared_resource")) result.resource += 1;
    }
    return result;
  };
  const { d7, d30, d90 } = analytics.outcomes;
  return {
    ...analytics,
    outcomes: {
      d7: { ...d7, quickActions: counts(7) },
      d30: { ...d30, quickActions: counts(WINDOW_DAYS) },
      d90: { ...d90, quickActions: counts(90) },
    },
  };
}

function hasQuickAction(messages: Json, kind: string): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some((m) => {
    if (!m || typeof m !== "object" || Array.isArray(m)) return false;
    const data = m.data;
    return (
      m.kind === kind &&
      !!data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      data.via === "quick_action"
    );
  });
}

function isCaptured(row: ConversationRow): boolean {
  return Boolean(row.captured_email?.trim() || row.captured_phone?.trim());
}

function isEngaged(row: ConversationRow): boolean {
  return (row.message_count ?? 0) >= 3;
}

/**
 * The four stages, as genuinely NESTED sets.
 *
 * The raw predicates are independent, and that made the panel lie: someone who
 * hands over an email on message two is captured but not "engaged" by a
 * 3-message rule, so captured could exceed engaged and the strip could render
 * a conversion rate above 100%. Sharing contact details IS engagement, and a
 * booked call implies both, so each stage absorbs the ones below it. Rates
 * between consecutive stages are then always meaningful.
 */
function buildFunnelStageCounts(
  rows: ConversationRow[],
  bookedLeadIds: ReadonlySet<string>,
): ChatbotFunnelStageCounts {
  const booked = rows.filter((row) => isBooked(row, bookedLeadIds));
  const captured = rows.filter(
    (row) => isCaptured(row) || isBooked(row, bookedLeadIds),
  );
  const engaged = rows.filter(
    (row) => isEngaged(row) || isCaptured(row) || isBooked(row, bookedLeadIds),
  );
  return {
    conversations: rows.length,
    engaged: engaged.length,
    captured: captured.length,
    booked: booked.length,
  };
}

/**
 * The attribution stamp resolveBookingCredit reads. When the column is absent
 * or unset on this row (pre-migration deploy, or a conversation that predates
 * it), a booking that still carries a Calendly event URI was made in-chat
 * before the label existed, so it counts there.
 */
export function attributionSourceOf(
  row: Pick<ConversationRow, "attribution_source" | "booked_event_uri">,
): "in_chat" | "email_match" | null {
  if (row.attribution_source === "in_chat") return "in_chat";
  if (row.attribution_source === "email_match") return "email_match";
  return row.booked_event_uri ? "in_chat" : null;
}

/**
 * Booked calls in `rows`, by last touch, and by first touch x last touch. Same
 * two rules the conversation page uses, so the grid and a row's note agree.
 */
function buildBookedBy(
  rows: ConversationRow[],
  bookedLeadIds: ReadonlySet<string>,
  creditByLead: ReadonlyMap<string, LeadCredit>,
  bookedEventLinks: ReadonlyMap<string, BookedEventLink>,
): ChatbotFunnelWindow["bookedBy"] {
  const counts = emptyLastTouch();
  const byFirstTouch = {
    chatbot: emptyLastTouch(),
    earlier: emptyLastTouch(),
    unlinked: emptyLastTouch(),
    unknown: emptyLastTouch(),
  };
  const bySetter = new Map<string, number>();
  const bySource = new Map<string, number>();
  let setterInferred = 0;
  for (const row of rows) {
    if (!isBooked(row, bookedLeadIds)) continue;
    const leadId = effectiveLeadId(row, bookedEventLinks);
    const lead = leadId ? creditByLead.get(leadId) : undefined;
    const credit = resolveBookingCredit({
      attributionSource: attributionSourceOf(row),
      bookedBySetter: creditedSetter(lead),
    });
    if (credit.kind === "setter" && !lead?.setter) setterInferred += 1;
    const first = resolveFirstTouch({
      conversationCreatedAt: row.created_at,
      leadLinked: Boolean(leadId),
      closeLeadCreatedAt: lead?.closeCreatedAt ?? null,
      entryResourceTag: lead?.resourceTag ?? null,
    });
    const last: keyof LastTouchCounts =
      credit.kind === "in_chat" ? "inChat" : credit.kind;
    counts[last] += 1;
    byFirstTouch[first.kind][last] += 1;
    if (credit.kind === "setter") {
      bySetter.set(credit.setter, (bySetter.get(credit.setter) ?? 0) + 1);
    }
    if (first.kind === "earlier") {
      bySource.set(first.label, (bySource.get(first.label) ?? 0) + 1);
    }
  }
  return {
    ...counts,
    setterInferred,
    setters: rankTop(bySetter, TOP_N),
    byFirstTouch,
    earlierSources: rankTop(bySource, TOP_N),
  };
}

function buildFunnelWindow(
  days: number,
  rows: ConversationRow[],
  now: Date,
  bookedLeadIds: ReadonlySet<string>,
  creditByLead: ReadonlyMap<string, LeadCredit>,
  bookedEventLinks: ReadonlyMap<string, BookedEventLink>,
  excluded: readonly ExcludedChat[],
): ChatbotFunnelWindow {
  const start = new Date(now.getTime() - days * DAY_MS);
  const windowRows = rows.filter((row) => inWindow(row.created_at, start, now));

  const stage = buildFunnelStageCounts(windowRows, bookedLeadIds);
  return {
    days,
    ...stage,
    engagedRatePct: ratePct(stage.engaged, stage.conversations),
    // Named for their denominators on purpose: the older funnel30d block below
    // also has a `capturedRatePct`, measured against conversations rather than
    // engaged. Two different numbers under one name in one payload is how a
    // dashboard and a digest end up quoting different figures for the same
    // thing.
    capturedRateOfEngagedPct: ratePct(stage.captured, stage.engaged),
    bookedRateOfCapturedPct: ratePct(stage.booked, stage.captured),
    overallBookedRatePct: ratePct(stage.booked, stage.conversations),
    bookedBy: buildBookedBy(
      windowRows,
      bookedLeadIds,
      creditByLead,
      bookedEventLinks,
    ),
    excluded: {
      support: countExcluded(excluded, "support", start, now),
      bookedBeforeChat: countExcluded(excluded, "bookedBeforeChat", start, now),
    },
  };
}

function countExcluded(
  excluded: readonly ExcludedChat[],
  reason: ExcludedChat["reason"],
  start: Date,
  end: Date,
): number {
  return excluded.filter(
    (chat) => chat.reason === reason && inWindow(chat.createdAt, start, end),
  ).length;
}

/**
 * A live booked call, from either signal: the Calendly webhook's stamp on the
 * conversation, or Close's reconciled booking on the lead this conversation
 * created. Both are cleared/absent once a call is cancelled, so this counts
 * calls still on the calendar.
 */
function isBooked(
  row: ConversationRow,
  bookedLeadIds: ReadonlySet<string>,
): boolean {
  if (row.call_booked_at) return true;
  return Boolean(
    row.lead_submission_id && bookedLeadIds.has(row.lead_submission_id),
  );
}

function inWindow(createdAt: string, start: Date, end: Date): boolean {
  const time = new Date(createdAt).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function buildMetric(value: number, prior: number): ChatbotAnalyticsMetric {
  return { value, prior, deltaPct: percentChange(value, prior) };
}

function percentChange(value: number, prior: number): number | null {
  if (prior < 3) return null;
  return Math.round(((value - prior) / prior) * 1000) / 10;
}

function ratePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function buildDailyTrend(
  rows: ConversationRow[],
  start: Date,
  end: Date,
  bookedLeadIds: ReadonlySet<string>,
): ChatbotDailyTrendRow[] {
  type Cell = { count: number; booked: number; captured: number };
  const empty: Cell = { count: 0, booked: 0, captured: 0 };
  const buckets = new Map<string, Cell>();
  for (
    let cursor = new Date(start);
    cursor < end;
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    buckets.set(dateKey(cursor), empty);
  }
  for (const row of rows) {
    const key = dateKey(new Date(row.created_at));
    const prev = buckets.get(key) ?? empty;
    buckets.set(key, {
      count: prev.count + 1,
      booked: prev.booked + (isBooked(row, bookedLeadIds) ? 1 : 0),
      captured: prev.captured + (isCaptured(row) ? 1 : 0),
    });
  }
  return Array.from(buckets.entries()).map(([date, value]) => ({
    date,
    ...value,
  }));
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** First user turn per conversation, normalized so near-duplicate phrasing collapses into one bucket. */
function topOpeningQuestions(rows: ConversationRow[]): ChatbotRankedRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const firstUserMessage = firstMessageByRole(row.messages, "user");
    if (!firstUserMessage) continue;
    const normalized = normalizeQuestion(firstUserMessage);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return rankTop(counts, TOP_N);
}

function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s?]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "at",
  "by",
  "from",
  "about",
  "as",
  "into",
  "like",
  "through",
  "after",
  "over",
  "between",
  "out",
  "against",
  "during",
  "without",
  "before",
  "under",
  "around",
  "among",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
  "this",
  "that",
  "these",
  "those",
  "what",
  "which",
  "who",
  "whom",
  "if",
  "do",
  "does",
  "did",
  "so",
  "just",
  "not",
  "no",
  "yes",
  "can",
  "could",
  "would",
  "should",
  "will",
  "shall",
  "may",
  "might",
  "must",
  "have",
  "has",
  "had",
  "am",
  "im",
  "how",
  "when",
  "where",
  "why",
  "up",
  "down",
  "get",
  "got",
]);

/** Tokens counted once per conversation (not once per message) so one chatty
 *  visitor cannot swamp a topic ranking meant to show breadth of interest. */
function keywordFrequency(rows: ConversationRow[]): ChatbotRankedRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const userText = allMessagesByRole(row.messages, "user").join(" ");
    const seen = new Set<string>();
    for (const token of tokenize(userText)) {
      if (STOPWORDS.has(token) || token.length < 3) continue;
      seen.add(token);
    }
    for (const token of seen) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return rankTop(counts, 20);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function rankTop(
  counts: Map<string, number>,
  limit: number,
): ChatbotRankedRow[] {
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildProspectDistributions(rows: ConversationRow[]) {
  const capitalSignal = new Map<string, number>();
  const timeline = new Map<string, number>();
  const callIntent = new Map<string, number>();

  for (const row of rows) {
    const profile = row.prospect_profile;
    if (!profile || typeof profile !== "object" || Array.isArray(profile))
      continue;
    const record = profile as Record<string, Json>;

    const capital = stringField(record, "capital_signal");
    if (capital)
      capitalSignal.set(capital, (capitalSignal.get(capital) ?? 0) + 1);

    const timelineValue = stringField(record, "timeline");
    if (timelineValue)
      timeline.set(timelineValue, (timeline.get(timelineValue) ?? 0) + 1);

    if (typeof record.call_intent === "boolean") {
      const label = record.call_intent ? "Wants a call" : "Not yet";
      callIntent.set(label, (callIntent.get(label) ?? 0) + 1);
    }
  }

  return {
    capitalSignal: rankTop(capitalSignal, TOP_N),
    timeline: rankTop(timeline, TOP_N),
    callIntent: rankTop(callIntent, 2),
  };
}

function stringField(record: Record<string, Json>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type StoredMessage = { role?: string; content?: string; ts?: string };

function firstMessageByRole(messages: Json, role: string): string | null {
  const list = asMessageList(messages);
  const match = list.find((message) => message.role === role);
  return match?.content?.trim() || null;
}

function allMessagesByRole(messages: Json, role: string): string[] {
  return asMessageList(messages)
    .filter((message) => message.role === role)
    .map((message) => message.content ?? "")
    .filter(Boolean);
}

function asMessageList(messages: Json): StoredMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter(
    (entry): entry is StoredMessage =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
}
