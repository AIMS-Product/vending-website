import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  askedAboutCost,
  calendarWasShown,
  deriveConversationOutcome,
} from "@/lib/chatbot/outcomes";
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
   * Same four counts, split by where the booking happened. Only trustworthy
   * once `attributionSplitTrustworthy` is true — see resolveAttributionSource.
   */
  bySource: {
    inChat: ChatbotFunnelStageCounts;
    assisted: ChatbotFunnelStageCounts;
    /**
     * Booked, but with no recorded attribution source.
     *
     * Most bookings reach us through Close's reconciler rather than the
     * Calendly webhook (which cannot verify its signature in production), and
     * those rows carry neither attribution_source nor booked_event_uri. Without
     * this bucket inChat + assisted silently fails to add up to booked, and the
     * split reads as if most calls simply did not happen.
     */
    unrecorded: ChatbotFunnelStageCounts;
  };
};

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
   * over three windows, each also split by where the booking happened.
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
   * least once for this rollup. When false, every bySource count is a
   * heuristic-only guess (or all zero) and the UI should say so rather than
   * render a confident split.
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
    bySource: {
      inChat: { ...emptyStage },
      assisted: { ...emptyStage },
      unrecorded: { ...emptyStage },
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

    const { ids: bookedLeadIds } = await fetchBookedLeadIds(
      client,
      rows.map((row) => row.lead_submission_id),
    );
    return buildAnalytics(
      rows,
      now,
      bookedLeadIds,
      attributionSplitTrustworthy,
    );
  } catch (error) {
    console.warn("chatbot analytics load failed, returning empty rollup", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return EMPTY_CHATBOT_ANALYTICS;
  }
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
): Promise<{ ids: ReadonlySet<string>; complete: boolean }> {
  const leadIds = Array.from(
    new Set(candidateLeadIds.filter((id): id is string => Boolean(id))),
  );
  if (leadIds.length === 0) return { ids: new Set(), complete: true };

  // Chunked because these ids ride in the query string: a full page of
  // conversations is up to 500 UUIDs, roughly 20KB, past what proxies in front
  // of PostgREST will accept on a GET.
  const ids = new Set<string>();
  for (let start = 0; start < leadIds.length; start += LEAD_LOOKUP_CHUNK) {
    const chunk = leadIds.slice(start, start + LEAD_LOOKUP_CHUNK);
    const { data, error } = await client
      .from("lead_submissions")
      .select("id")
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
      return { ids, complete: false };
    }
    for (const row of data ?? []) ids.add(row.id);
  }
  return { ids, complete: true };
}

const LEAD_LOOKUP_CHUNK = 100;

function buildAnalytics(
  rows: ConversationRow[],
  now: Date,
  bookedLeadIds: ReadonlySet<string> = new Set(),
  attributionSplitTrustworthy = false,
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
    topOpeningQuestions: topOpeningQuestions(current),
    keywordFrequency: keywordFrequency(current),
    prospectDistributions: buildProspectDistributions(current),
    funnels: {
      d7: buildFunnelWindow(7, rows, now, bookedLeadIds),
      d30: buildFunnelWindow(30, rows, now, bookedLeadIds),
      d90: buildFunnelWindow(90, rows, now, bookedLeadIds),
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
 * Which side of the funnel a conversation's booking belongs to. The
 * attribution_source column (in_chat / email_match) wins when present; when
 * it is absent or unset on this row — pre-migration deploy, or a
 * conversation that predates the column — a booked call that still carries
 * a Calendly event URI was booked in-chat before the label existed, so it
 * counts there. Everything else can't be honestly classified and is left
 * out of the split entirely (neither bucket).
 */
function resolveAttributionSource(
  row: ConversationRow,
  bookedLeadIds: ReadonlySet<string>,
): "in_chat" | "assisted" | null {
  if (row.attribution_source === "in_chat") return "in_chat";
  if (row.attribution_source === "email_match") return "assisted";
  if (isBooked(row, bookedLeadIds) && row.booked_event_uri) return "in_chat";
  return null;
}

function buildFunnelWindow(
  days: number,
  rows: ConversationRow[],
  now: Date,
  bookedLeadIds: ReadonlySet<string>,
): ChatbotFunnelWindow {
  const start = new Date(now.getTime() - days * DAY_MS);
  const windowRows = rows.filter((row) => inWindow(row.created_at, start, now));

  const inChatRows: ConversationRow[] = [];
  const assistedRows: ConversationRow[] = [];
  const unrecordedRows: ConversationRow[] = [];
  for (const row of windowRows) {
    const source = resolveAttributionSource(row, bookedLeadIds);
    if (source === "in_chat") inChatRows.push(row);
    else if (source === "assisted") assistedRows.push(row);
    else if (isBooked(row, bookedLeadIds)) unrecordedRows.push(row);
  }

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
    bySource: {
      inChat: buildFunnelStageCounts(inChatRows, bookedLeadIds),
      assisted: buildFunnelStageCounts(assistedRows, bookedLeadIds),
      unrecorded: buildFunnelStageCounts(unrecordedRows, bookedLeadIds),
    },
  };
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
  const buckets = new Map<string, { count: number; booked: number }>();
  for (
    let cursor = new Date(start);
    cursor < end;
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    buckets.set(dateKey(cursor), { count: 0, booked: 0 });
  }
  for (const row of rows) {
    const key = dateKey(new Date(row.created_at));
    const prev = buckets.get(key) ?? { count: 0, booked: 0 };
    buckets.set(key, {
      count: prev.count + 1,
      booked: prev.booked + (isBooked(row, bookedLeadIds) ? 1 : 0),
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
