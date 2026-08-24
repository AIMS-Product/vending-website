import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
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

export type ChatbotDailyTrendRow = { date: string; count: number };
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
  capturedRatePct: number;
  bookedRatePct: number;
  overallBookedRatePct: number;
  /**
   * Same four counts, split by where the booking happened. Only trustworthy
   * once `attributionSplitTrustworthy` is true — see resolveAttributionSource.
   */
  bySource: {
    inChat: ChatbotFunnelStageCounts;
    assisted: ChatbotFunnelStageCounts;
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
};

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
    capturedRatePct: 0,
    bookedRatePct: 0,
    overallBookedRatePct: 0,
    bySource: { inChat: { ...emptyStage }, assisted: { ...emptyStage } },
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

function isMissingColumnError(message: string): boolean {
  return (
    message.includes("call_booked_at") ||
    message.includes("attribution_source") ||
    message.includes("42703")
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

    const bookedLeadIds = await fetchBookedLeadIds(client, rows);
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
async function fetchBookedLeadIds(
  client: ChatbotAnalyticsClient,
  rows: ConversationRow[],
): Promise<ReadonlySet<string>> {
  const leadIds = Array.from(
    new Set(
      rows
        .map((row) => row.lead_submission_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (leadIds.length === 0) return new Set();

  const { data, error } = await client
    .from("lead_submissions")
    .select("id")
    .in("id", leadIds)
    .not("call_booked_at", "is", null);
  if (error) {
    console.warn("chatbot analytics: Close-reconciled booking lookup failed", {
      error: error.message,
    });
    return new Set();
  }
  return new Set((data ?? []).map((row) => row.id));
}

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
    dailyTrend: buildDailyTrend(current, start, now),
    topOpeningQuestions: topOpeningQuestions(current),
    keywordFrequency: keywordFrequency(current),
    prospectDistributions: buildProspectDistributions(current),
    funnels: {
      d7: buildFunnelWindow(7, rows, now, bookedLeadIds),
      d30: buildFunnelWindow(30, rows, now, bookedLeadIds),
      d90: buildFunnelWindow(90, rows, now, bookedLeadIds),
    },
    attributionSplitTrustworthy,
  };
}

function isCaptured(row: ConversationRow): boolean {
  return Boolean(row.captured_email?.trim() || row.captured_phone?.trim());
}

function isEngaged(row: ConversationRow): boolean {
  return (row.message_count ?? 0) >= 3;
}

function buildFunnelStageCounts(
  rows: ConversationRow[],
  bookedLeadIds: ReadonlySet<string>,
): ChatbotFunnelStageCounts {
  return {
    conversations: rows.length,
    engaged: rows.filter(isEngaged).length,
    captured: rows.filter(isCaptured).length,
    booked: rows.filter((row) => isBooked(row, bookedLeadIds)).length,
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
  for (const row of windowRows) {
    const source = resolveAttributionSource(row, bookedLeadIds);
    if (source === "in_chat") inChatRows.push(row);
    else if (source === "assisted") assistedRows.push(row);
  }

  const stage = buildFunnelStageCounts(windowRows, bookedLeadIds);
  return {
    days,
    ...stage,
    engagedRatePct: ratePct(stage.engaged, stage.conversations),
    capturedRatePct: ratePct(stage.captured, stage.engaged),
    bookedRatePct: ratePct(stage.booked, stage.captured),
    overallBookedRatePct: ratePct(stage.booked, stage.conversations),
    bySource: {
      inChat: buildFunnelStageCounts(inChatRows, bookedLeadIds),
      assisted: buildFunnelStageCounts(assistedRows, bookedLeadIds),
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
): ChatbotDailyTrendRow[] {
  const buckets = new Map<string, number>();
  for (
    let cursor = new Date(start);
    cursor < end;
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    buckets.set(dateKey(cursor), 0);
  }
  for (const row of rows) {
    const key = dateKey(new Date(row.created_at));
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({
    date,
    count,
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
