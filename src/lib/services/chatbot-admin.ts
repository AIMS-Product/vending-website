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

export const CHATBOT_FLAGS = [
  "quality_good",
  "quality_bad",
  "needs_prompt_tuning",
  "lead_high_intent",
  "lead_low_intent",
  "followup_needed",
  "handoff_missed",
] as const;
export type ChatbotFlag = (typeof CHATBOT_FLAGS)[number];

export function isChatbotFlag(value: string): value is ChatbotFlag {
  return (CHATBOT_FLAGS as readonly string[]).includes(value);
}

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
  flags: ChatbotFlag[];
};

export type AdminChatbotSort = "newest" | "oldest" | "most_messages";

export type AdminListConversationsInput = {
  q?: string | null;
  sort?: AdminChatbotSort;
  flag?: string | null;
};

export type AdminChatbotConversationsResult = {
  items: AdminChatbotConversationListItem[];
  totalCount: number;
  highIntentCount: number;
  missedHandoffCount: number;
  badQualityCount: number;
  flagCounts: Record<ChatbotFlag, number>;
};

const LIST_FIELDS =
  "id, session_id, status, captured_name, captured_email, captured_phone, messages, message_count, last_message_at, created_at" as const;

export async function adminListConversations(
  input: AdminListConversationsInput = {},
  deps: ServiceDeps = {},
): Promise<AdminChatbotConversationsResult> {
  const client = deps.client ?? createAdminClient();

  const { data, error } = await client
    .from("chatbot_conversations")
    .select(LIST_FIELDS)
    .order("last_message_at", { ascending: false })
    .limit(LIST_CAP);
  if (error) throw new ChatbotAdminError("Could not load conversations.");

  const rows = (data ?? []) as Pick<
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
  >[];

  const ids = rows.map((row) => row.id);
  const flagsByConversation = await fetchFlagsFor(client, ids);

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

  const q = input.q?.trim().toLowerCase();
  if (q) {
    items = items.filter((item) => matchesSearch(item, q));
  }

  const flagFilter = input.flag?.trim();
  if (flagFilter && flagFilter !== "all" && isChatbotFlag(flagFilter)) {
    items = items.filter((item) => item.flags.includes(flagFilter));
  }

  items = sortConversations(items, input.sort ?? "newest");

  return {
    items,
    totalCount,
    highIntentCount,
    missedHandoffCount,
    badQualityCount,
    flagCounts,
  };
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
};

export async function adminGetConversationDetail(
  conversationId: string,
  deps: ServiceDeps = {},
): Promise<AdminChatbotConversationDetail | null> {
  const client = deps.client ?? createAdminClient();

  const { data: conversation, error } = await client
    .from("chatbot_conversations")
    .select(
      "id, session_id, status, page_url, user_agent, captured_name, captured_email, captured_phone, messages, message_count, created_at, last_message_at, handed_off_at, handoff_reason, prospect_profile, lead_submission_id",
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

  const linkedLead = await fetchLinkedLead(
    client,
    conversation.lead_submission_id,
  );

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
  };
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
