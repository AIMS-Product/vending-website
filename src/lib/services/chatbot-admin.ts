import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { prospectSummaryFrom } from "@/lib/chatbot/conversation-store";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/types/database";

type ChatbotAdminClient = Pick<SupabaseClient<Database>, "from">;
type ServiceDeps = { client?: ChatbotAdminClient; now?: () => Date };

export class ChatbotAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatbotAdminError";
  }
}

import { fetchBookedLeadIds } from "@/lib/chatbot/analytics";
import {
  askedAboutCost,
  deriveConversationOutcome,
  type ChatbotConversationOutcome,
} from "@/lib/chatbot/outcomes";

export type { ChatbotConversationOutcome };
export { CHATBOT_FLAGS, isChatbotFlag } from "@/lib/chatbot/flags";
export type { ChatbotFlag } from "@/lib/chatbot/flags";
import {
  CHATBOT_FLAGS,
  isChatbotFlag,
  type ChatbotFlag,
} from "@/lib/chatbot/flags";

// ponytail: the whole list/detail surface caps at the most recent N rows and
// filters/sorts in memory rather than pushing search into SQL. Fine at
// chatbot launch volume (a jsonb ILIKE + text index is the upgrade once the
// table is large enough for this scan to show up in page load time).
const LIST_CAP = 500;

type ConversationRow = Tables<"chatbot_conversations">;
type FlagRow = Pick<
  Tables<"chatbot_conversation_flags">,
  "id" | "conversation_id" | "flag" | "note" | "created_at"
>;

type StoredMessage = { role?: string; content?: string; ts?: string };

export type AdminChatbotConversationListItem = {
  id: string;
  sessionId: string;
  status: string;
  capturedName: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  firstUserMessage: string | null;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  /**
   * Truthy when this conversation led to a booked call. NOT a reliable
   * timestamp: when the booking was reconciled onto the lead rather than the
   * conversation we have no booking time of our own and this carries the
   * conversation's last-activity stamp instead. Render it as a yes/no, never
   * as a date. Null once cancelled.
   */
  callBookedAt: string | null;
  /** Derived from the transcript, not stored. See lib/chatbot/outcomes.ts. */
  outcome: ChatbotConversationOutcome;
  /** True when the visitor asked what it costs — the site's most common question. */
  askedAboutCost: boolean;
  flags: ChatbotFlag[];
};

export type AdminChatbotSort = "newest" | "oldest" | "most_messages";

export type AdminListConversationsInput = {
  q?: string | null;
  sort?: AdminChatbotSort;
  flag?: string | null;
  /** One ChatbotConversationOutcome, or "all". */
  outcome?: string | null;
};

export type AdminChatbotConversationsResult = {
  items: AdminChatbotConversationListItem[];
  totalCount: number;
  highIntentCount: number;
  missedHandoffCount: number;
  badQualityCount: number;
  flagCounts: Record<ChatbotFlag, number>;
  outcomeCounts: Record<ChatbotConversationOutcome, number>;
  /** Of every conversation in the window, how many asked what it costs. */
  costQuestionCount: number;
  /**
   * False when the booking column could not be read, which makes every outcome
   * a guess. The UI hides the outcome filters and tiles rather than show them.
   */
  outcomesTrustworthy: boolean;
};

const LIST_FIELDS =
  "id, session_id, status, captured_name, captured_email, captured_phone, messages, message_count, last_message_at, created_at, call_booked_at, lead_submission_id" as const;

// Pre-migration shape, same tolerant fallback as chatbot/config.ts — a deploy
// ahead of the v2 migration loses the Booked badge, not the whole list.
const LEGACY_LIST_FIELDS =
  "id, session_id, status, captured_name, captured_email, captured_phone, messages, message_count, last_message_at, created_at" as const;

function isMissingColumnError(message: string): boolean {
  return message.includes("call_booked_at") || message.includes("42703");
}

export async function adminListConversations(
  input: AdminListConversationsInput = {},
  deps: ServiceDeps = {},
): Promise<AdminChatbotConversationsResult> {
  const client = deps.client ?? createAdminClient();

  const loaded = await client
    .from("chatbot_conversations")
    .select(LIST_FIELDS)
    .order("last_message_at", { ascending: false })
    .limit(LIST_CAP);

  type ListRow = Pick<
    ConversationRow,
    | "id"
    | "session_id"
    | "status"
    | "captured_name"
    | "captured_email"
    | "captured_phone"
    | "messages"
    | "message_count"
    | "last_message_at"
    | "created_at"
  > & { call_booked_at?: string | null; lead_submission_id?: string | null };

  let data = loaded.data as ListRow[] | null;
  if (loaded.error) {
    if (!isMissingColumnError(loaded.error.message)) {
      throw new ChatbotAdminError("Could not load conversations.");
    }
    const legacy = await client
      .from("chatbot_conversations")
      .select(LEGACY_LIST_FIELDS)
      .order("last_message_at", { ascending: false })
      .limit(LIST_CAP);
    if (legacy.error) {
      throw new ChatbotAdminError("Could not load conversations.");
    }
    data = legacy.data as ListRow[] | null;
  }

  const rows = data ?? [];
  // False on the pre-migration fallback above, where call_booked_at is not
  // selected at all: without it every booked conversation would derive as
  // "saw the calendar, did not book". A wrong number is worse than none, so
  // the surfaces hide the outcome split rather than print it.
  const outcomesTrustworthy = !loaded.error;

  const ids = rows.map((row) => row.id);
  const [flagsByConversation, booked] = await Promise.all([
    fetchFlagsFor(client, ids),
    outcomesTrustworthy
      ? fetchBookedLeadIds(
          client,
          rows.map((row) => row.lead_submission_id),
        )
      : Promise.resolve({
          ids: new Set<string>() as ReadonlySet<string>,
          complete: false,
        }),
  ]);
  const bookedLeadIds = booked.ids;
  // An incomplete booking lookup would render reconciled bookings as
  // abandoned, which is the one number this whole surface exists to get right.
  const outcomesReportable = outcomesTrustworthy && booked.complete;

  let items: AdminChatbotConversationListItem[] = rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    status: row.status,
    capturedName: row.captured_name,
    capturedEmail: row.captured_email,
    capturedPhone: row.captured_phone,
    firstUserMessage: firstMessageByRole(row.messages, "user"),
    messageCount: row.message_count ?? 0,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    callBookedAt: bookedCallAt(row, bookedLeadIds),
    outcome: deriveConversationOutcome({
      messages: row.messages,
      capturedEmail: row.captured_email,
      capturedPhone: row.captured_phone,
      callBookedAt: bookedCallAt(row, bookedLeadIds),
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
    }),
    askedAboutCost: askedAboutCost(row.messages),
    flags: flagsByConversation.get(row.id) ?? [],
  }));

  const flagCounts = emptyFlagCounts();
  for (const item of items) {
    for (const flag of item.flags) flagCounts[flag] += 1;
  }
  const highIntentCount = flagCounts.lead_high_intent;
  const missedHandoffCount = flagCounts.handoff_missed;
  const badQualityCount = flagCounts.quality_bad;
  const totalCount = items.length;

  const outcomeCounts = emptyOutcomeCounts();
  let costQuestionCount = 0;
  for (const item of items) {
    outcomeCounts[item.outcome] += 1;
    if (item.askedAboutCost) costQuestionCount += 1;
  }

  const q = input.q?.trim().toLowerCase();
  if (q) {
    items = items.filter((item) => matchesSearch(item, q));
  }

  const flagFilter = input.flag?.trim();
  if (flagFilter && flagFilter !== "all" && isChatbotFlag(flagFilter)) {
    items = items.filter((item) => item.flags.includes(flagFilter));
  }

  // Not applied when the outcomes are not reportable: the chips and badges are
  // hidden in that state, so a filter surviving in the URL would silently
  // shrink the list with no visible control to clear it.
  const outcomeFilter = outcomesReportable ? input.outcome?.trim() : null;
  if (outcomeFilter && outcomeFilter !== "all") {
    if (outcomeFilter === "asked_about_cost") {
      items = items.filter((item) => item.askedAboutCost);
    } else if (isConversationOutcome(outcomeFilter)) {
      items = items.filter((item) => item.outcome === outcomeFilter);
    }
  }

  items = sortConversations(items, input.sort ?? "newest");

  return {
    items,
    totalCount,
    highIntentCount,
    missedHandoffCount,
    badQualityCount,
    flagCounts,
    outcomeCounts,
    costQuestionCount,
    outcomesTrustworthy: outcomesReportable,
  };
}

/**
 * When the booking is recorded on the lead rather than the conversation, we
 * have no booking timestamp of our own. The conversation's own last-activity
 * stamp stands in: the outcome only needs "yes, booked", and the badge reads
 * off the same value the list already sorts by.
 */
function bookedCallAt(
  row: {
    call_booked_at?: string | null;
    lead_submission_id?: string | null;
    last_message_at: string;
  },
  bookedLeadIds: ReadonlySet<string>,
): string | null {
  if (row.call_booked_at) return row.call_booked_at;
  if (row.lead_submission_id && bookedLeadIds.has(row.lead_submission_id)) {
    return row.last_message_at;
  }
  return null;
}

function emptyOutcomeCounts(): Record<ChatbotConversationOutcome, number> {
  return {
    booked: 0,
    calendar_abandoned: 0,
    captured_no_booking: 0,
    left_no_contact: 0,
    open: 0,
  };
}

function isConversationOutcome(
  value: string,
): value is ChatbotConversationOutcome {
  return value in emptyOutcomeCounts();
}

function matchesSearch(
  item: AdminChatbotConversationListItem,
  q: string,
): boolean {
  return [
    item.capturedName,
    item.capturedEmail,
    item.capturedPhone,
    item.firstUserMessage,
  ]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(q));
}

function sortConversations(
  items: AdminChatbotConversationListItem[],
  sort: AdminChatbotSort,
): AdminChatbotConversationListItem[] {
  const sorted = [...items];
  if (sort === "oldest") {
    sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } else if (sort === "most_messages") {
    sorted.sort((a, b) => b.messageCount - a.messageCount);
  } else {
    sorted.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }
  return sorted;
}

export type AdminChatbotMessage = {
  role: string;
  content: string;
  ts: string | null;
};

export type AdminChatbotFlagRow = {
  id: string;
  flag: ChatbotFlag;
  note: string | null;
  createdAt: string;
};

export type AdminChatbotLinkedLead = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  closeSyncStatus: string | null;
} | null;

/** The call this chat produced, for the stamp at the foot of the transcript. */
export type AdminChatbotBooking = {
  /** When the booking was made (Calendly's record, or Close's reconcile). */
  bookedAt: string;
  /** When the call itself happens. */
  eventStartAt: string | null;
  eventName: string | null;
  /** The consultant Calendly assigned. Null when the record never said. */
  hostName: string | null;
  source: "calendly" | "close";
};

export type AdminChatbotConversationDetail = {
  id: string;
  sessionId: string;
  status: string;
  pageUrl: string | null;
  userAgent: string | null;
  capturedName: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  messageCount: number;
  createdAt: string;
  lastMessageAt: string;
  handedOffAt: string | null;
  handoffReason: string | null;
  messages: AdminChatbotMessage[];
  flags: AdminChatbotFlagRow[];
  prospectProfileSummary: string | null;
  linkedLead: AdminChatbotLinkedLead;
  booking: AdminChatbotBooking | null;
};

export async function adminGetConversationDetail(
  conversationId: string,
  deps: ServiceDeps = {},
): Promise<AdminChatbotConversationDetail | null> {
  const client = deps.client ?? createAdminClient();

  const { data: conversation, error } = await client
    .from("chatbot_conversations")
    .select(
      "id, session_id, status, page_url, user_agent, captured_name, captured_email, captured_phone, messages, message_count, created_at, last_message_at, handed_off_at, handoff_reason, prospect_profile, lead_submission_id, call_booked_at",
    )
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new ChatbotAdminError("Could not load this conversation.");
  if (!conversation) return null;

  const { data: flagRows, error: flagsError } = await client
    .from("chatbot_conversation_flags")
    .select("id, conversation_id, flag, note, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (flagsError) {
    throw new ChatbotAdminError("Could not load this conversation's flags.");
  }

  const [linkedLead, booking] = await Promise.all([
    fetchLinkedLead(client, conversation.lead_submission_id),
    fetchConversationBooking(client, {
      conversationId: conversation.id,
      leadSubmissionId: conversation.lead_submission_id,
      callBookedAt: conversation.call_booked_at ?? null,
    }),
  ]);

  return {
    id: conversation.id,
    sessionId: conversation.session_id,
    status: conversation.status,
    pageUrl: conversation.page_url,
    userAgent: conversation.user_agent,
    capturedName: conversation.captured_name,
    capturedEmail: conversation.captured_email,
    capturedPhone: conversation.captured_phone,
    messageCount: conversation.message_count ?? 0,
    createdAt: conversation.created_at,
    lastMessageAt: conversation.last_message_at,
    handedOffAt: conversation.handed_off_at,
    handoffReason: conversation.handoff_reason,
    messages: normalizeMessages(conversation.messages),
    flags: ((flagRows ?? []) as FlagRow[])
      .filter((row): row is FlagRow & { flag: ChatbotFlag } =>
        isChatbotFlag(row.flag),
      )
      .map((row) => ({
        id: row.id,
        flag: row.flag,
        note: row.note,
        createdAt: row.created_at,
      })),
    prospectProfileSummary: summarizeProspectProfile(
      conversation.prospect_profile,
    ),
    linkedLead,
    booking,
  };
}

/**
 * The Calendly booking behind this chat: matched by the conversation id the
 * embed URL put in utm_content, or by the lead the chat created. A call that
 * only Close knows about (reconciled onto the lead) still gets a stamp from
 * call_booked_at, just without the host.
 */
async function fetchConversationBooking(
  client: ChatbotAdminClient,
  input: {
    conversationId: string;
    leadSubmissionId: string | null | undefined;
    callBookedAt: string | null;
  },
): Promise<AdminChatbotBooking | null> {
  const match = [
    `utm_content.eq.${input.conversationId}`,
    input.leadSubmissionId
      ? `lead_submission_id.eq.${input.leadSubmissionId}`
      : null,
  ]
    .filter(Boolean)
    .join(",");
  const { data, error } = await client
    .from("calendly_bookings")
    .select(
      "created_at, event_start_at, scheduled_event_name, raw_payload, status",
    )
    .or(match)
    .eq("status", "booked")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("chatbot admin: booking lookup failed", {
      message: error.message,
    });
  }
  if (data) {
    return {
      bookedAt: data.created_at,
      eventStartAt: data.event_start_at,
      eventName: data.scheduled_event_name,
      hostName: hostNameFromPayload(data.raw_payload),
      source: "calendly",
    };
  }
  if (input.callBookedAt) {
    return {
      bookedAt: input.callBookedAt,
      eventStartAt: null,
      eventName: null,
      hostName: null,
      source: "close",
    };
  }
  return null;
}

/**
 * Who Calendly assigned. Webhook payloads carry it at
 * `scheduled_event.event_memberships[].user_name`; the embed route stores the
 * scheduled event under the same key. Anything else is null, never a guess.
 */
export function hostNameFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const event = (record.scheduled_event ??
    (record.payload as Record<string, unknown> | undefined)
      ?.scheduled_event) as Record<string, unknown> | undefined;
  const memberships = event?.event_memberships;
  if (!Array.isArray(memberships)) return null;
  const names = memberships
    .map((m) =>
      m && typeof m === "object"
        ? (m as { user_name?: unknown }).user_name
        : null,
    )
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  return names.length ? names.join(", ") : null;
}

export type AdminToggleFlagInput = {
  conversationId: string;
  flag: ChatbotFlag;
  actorId: string | null;
};

/** Flag rows are unique on (conversation_id, flag) — toggling deletes an
 *  existing row or inserts a fresh one, so re-clicking is idempotent. */
export async function adminToggleConversationFlag(
  input: AdminToggleFlagInput,
  deps: ServiceDeps = {},
): Promise<void> {
  const client = deps.client ?? createAdminClient();

  const { data: existing, error: findError } = await client
    .from("chatbot_conversation_flags")
    .select("id")
    .eq("conversation_id", input.conversationId)
    .eq("flag", input.flag)
    .maybeSingle();
  if (findError) throw new ChatbotAdminError("Could not read this flag.");

  if (existing) {
    const { error } = await client
      .from("chatbot_conversation_flags")
      .delete()
      .eq("id", existing.id);
    if (error) throw new ChatbotAdminError("Could not clear this flag.");
    return;
  }

  const { error } = await client.from("chatbot_conversation_flags").insert({
    conversation_id: input.conversationId,
    flag: input.flag,
    created_by: input.actorId,
  });
  if (error) throw new ChatbotAdminError("Could not set this flag.");
}

export type AdminSaveNoteInput = {
  conversationId: string;
  note: string;
};

/**
 * There is no standalone notes table — a reviewer note lives on a flag row's
 * `note` column (see the migration). It attaches to whichever flag was set
 * most recently. With zero flags there is nowhere to attach it, so this
 * throws a message-carrying error the UI surfaces as a hint to set a flag
 * first, rather than silently doing nothing.
 */
export async function adminSaveConversationNote(
  input: AdminSaveNoteInput,
  deps: ServiceDeps = {},
): Promise<void> {
  const client = deps.client ?? createAdminClient();

  const { data: latestFlag, error: findError } = await client
    .from("chatbot_conversation_flags")
    .select("id")
    .eq("conversation_id", input.conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw new ChatbotAdminError("Could not save this note.");
  if (!latestFlag) {
    throw new ChatbotAdminError(
      "Set a flag on this conversation before adding a reviewer note.",
    );
  }

  const { error } = await client
    .from("chatbot_conversation_flags")
    .update({ note: input.note.trim() || null })
    .eq("id", latestFlag.id);
  if (error) throw new ChatbotAdminError("Could not save this note.");
}

export type AdminHandOffInput = {
  conversationId: string;
  reason: string;
};

export async function adminHandOffConversation(
  input: AdminHandOffInput,
  deps: ServiceDeps = {},
): Promise<void> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now ? deps.now() : new Date();

  const { error } = await client
    .from("chatbot_conversations")
    .update({
      status: "handed_off",
      handed_off_at: now.toISOString(),
      handoff_reason:
        input.reason.trim() || "Handed off from the admin conversation view.",
    })
    .eq("id", input.conversationId);
  if (error)
    throw new ChatbotAdminError("Could not hand this conversation off.");
}

/**
 * Live count for the missed-leads catch-up window picker. "Eligible" means
 * captured (email or phone), inside the window, and never emailed a
 * profile digest — the same shape the Phase 4 digest cron will use, minus
 * the idle-time debounce a batch catch-up run doesn't need.
 */
export async function adminCountMissedLeadCatchUp(
  windowDays: number,
  deps: ServiceDeps = {},
): Promise<number> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now ? deps.now() : new Date();
  const start = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  try {
    const { count, error } = await client
      .from("chatbot_conversations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start.toISOString())
      .is("prospect_profile_emailed_at", null)
      .or("captured_email.not.is.null,captured_phone.not.is.null");
    if (error) throw new Error(error.message);
    return count ?? 0;
  } catch (error) {
    console.warn("chatbot catch-up count failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return 0;
  }
}

/** Drives the "live / last activity" chip on the config page header. */
export async function adminGetLatestActivity(
  deps: ServiceDeps = {},
): Promise<string | null> {
  const client = deps.client ?? createAdminClient();
  try {
    const { data, error } = await client
      .from("chatbot_conversations")
      .select("last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.last_message_at ?? null;
  } catch (error) {
    console.warn("chatbot latest activity load failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}

async function fetchFlagsFor(
  client: ChatbotAdminClient,
  conversationIds: string[],
): Promise<Map<string, ChatbotFlag[]>> {
  const byConversation = new Map<string, ChatbotFlag[]>();
  if (!conversationIds.length) return byConversation;

  const { data, error } = await client
    .from("chatbot_conversation_flags")
    .select("conversation_id, flag")
    .in("conversation_id", conversationIds);
  if (error) throw new ChatbotAdminError("Could not load conversation flags.");

  for (const row of (data ?? []) as Pick<
    FlagRow,
    "conversation_id" | "flag"
  >[]) {
    if (!isChatbotFlag(row.flag)) continue;
    const list = byConversation.get(row.conversation_id) ?? [];
    list.push(row.flag);
    byConversation.set(row.conversation_id, list);
  }
  return byConversation;
}

async function fetchLinkedLead(
  client: ChatbotAdminClient,
  leadSubmissionId: string | null,
): Promise<AdminChatbotLinkedLead> {
  if (!leadSubmissionId) return null;
  const { data, error } = await client
    .from("lead_submissions")
    .select("id, full_name, email, phone, status, close_sync_status")
    .eq("id", leadSubmissionId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    status: data.status,
    closeSyncStatus: data.close_sync_status,
  };
}

function normalizeMessages(messages: Json): AdminChatbotMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (entry): entry is StoredMessage =>
        typeof entry === "object" && entry !== null && !Array.isArray(entry),
    )
    .map((entry) => ({
      role: typeof entry.role === "string" ? entry.role : "assistant",
      content: typeof entry.content === "string" ? entry.content : "",
      ts: typeof entry.ts === "string" ? entry.ts : null,
    }));
}

function firstMessageByRole(messages: Json, role: string): string | null {
  return (
    normalizeMessages(messages)
      .find((m) => m.role === role)
      ?.content?.trim() || null
  );
}

// Reuses the chat pipeline's own summary reader (conversation-store.ts) so
// there is one definition of "what the summary field means" — this only
// adds an admin-only fallback for profiles that lack a `summary` string.
function summarizeProspectProfile(profile: Json): string | null {
  const summary = prospectSummaryFrom(profile);
  if (summary) return summary;
  if (!profile || typeof profile !== "object" || Array.isArray(profile))
    return null;
  const record = profile as Record<string, Json>;

  const parts: string[] = [];
  for (const key of [
    "current_work",
    "capital_signal",
    "timeline",
    "motivation",
  ]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
  }
  return parts.length ? parts.join(" — ") : null;
}

function emptyFlagCounts(): Record<ChatbotFlag, number> {
  return {
    quality_good: 0,
    quality_bad: 0,
    needs_prompt_tuning: 0,
    lead_high_intent: 0,
    lead_low_intent: 0,
    followup_needed: 0,
    handoff_missed: 0,
  };
}
