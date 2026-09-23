import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

type ConversationClient = Pick<SupabaseClient<Database>, "from">;
export type ChatbotConversation =
  Database["public"]["Tables"]["chatbot_conversations"]["Row"];

/**
 * Rich-message discriminator (v2). Absent means "text" — every message
 * written before v2 shipped has no `kind`, so plain absence must keep
 * rendering as an ordinary bubble forever. Never make this field required.
 */
export type ChatbotMessageKind =
  | "text"
  | "calendar"
  | "resource_card"
  /** A catalog resource shown in the chat, not emailed. See sharedResourceMessage. */
  | "shared_resource"
  | "booking_confirmed";

export const CHATBOT_MESSAGE_KINDS: readonly ChatbotMessageKind[] = [
  "text",
  "calendar",
  "resource_card",
  "shared_resource",
  "booking_confirmed",
];

export type ChatbotMessage = {
  role: "user" | "assistant";
  /**
   * Always a plain-language line, even on a rich message ("Opened the booking
   * calendar in the chat."). It is what the model, the admin transcript
   * viewer, and the learning engine read, so a rich message is never opaque
   * to any of them.
   */
  content: string;
  ts: string;
  kind?: ChatbotMessageKind;
  /** Renderer payload for a rich `kind` — the calendar URL, the resource card fields. */
  data?: Record<string, Json>;
};

const CONVERSATION_FIELDS =
  "id,session_id,visitor_hash,status,messages,captured_name,captured_email,captured_phone,prospect_profile,prospect_profile_emailed_at,lead_submission_id,message_count,last_message_at,handed_off_at,handoff_reason,page_url,user_agent,created_at" as const;

/**
 * Loads the conversation for this session, creating it on first turn. A
 * brand-new row seeds captured_* from the most recent past conversation with
 * the same visitor_hash (the vp_chat_vid cookie recall — see spec
 * architecture) so a returning visitor is never re-asked for contact info
 * already on file.
 */
export async function loadOrCreateConversation(
  input: {
    sessionId: string;
    pageUrl: string | null;
    userAgent: string | null;
    visitorHash: string | null;
  },
  deps: { client?: ConversationClient } = {},
): Promise<ChatbotConversation> {
  const client = deps.client ?? createAdminClient();

  const existing = await client
    .from("chatbot_conversations")
    .select(CONVERSATION_FIELDS)
    .eq("session_id", input.sessionId)
    .maybeSingle();
  if (existing.error) {
    throw new Error(existing.error.message);
  }
  if (existing.data) return existing.data as ChatbotConversation;

  const recall = input.visitorHash
    ? await recallVisitor(client, input.visitorHash)
    : null;

  const { data, error } = await client
    .from("chatbot_conversations")
    .insert({
      session_id: input.sessionId,
      visitor_hash: input.visitorHash,
      page_url: input.pageUrl,
      user_agent: input.userAgent,
      captured_name: recall?.captured_name ?? null,
      captured_email: recall?.captured_email ?? null,
      captured_phone: recall?.captured_phone ?? null,
    })
    .select(CONVERSATION_FIELDS)
    .single();

  if (error || !data) {
    // A concurrent request for the same brand-new session_id (double-submit,
    // double-tap) races this insert against the unique constraint. Re-read
    // rather than fail the turn — the other request's row is just as valid.
    const retry = await client
      .from("chatbot_conversations")
      .select(CONVERSATION_FIELDS)
      .eq("session_id", input.sessionId)
      .maybeSingle();
    if (retry.data) return retry.data as ChatbotConversation;
    throw new Error(error?.message ?? "Could not start chatbot conversation.");
  }

  return data as ChatbotConversation;
}

async function recallVisitor(client: ConversationClient, visitorHash: string) {
  const { data } = await client
    .from("chatbot_conversations")
    .select("captured_name,captured_email,captured_phone")
    .eq("visitor_hash", visitorHash)
    .or("captured_email.not.is.null,captured_phone.not.is.null")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Attempts before giving up on a contended append. */
const APPEND_ATTEMPTS = 5;

/**
 * Appends this request's messages to the stored transcript, never rewrites it.
 *
 * Several writers touch one conversation: the chat turn (saved in after(), up
 * to a minute after it read the row), a quick-action click, the capture form,
 * and the booking webhook's chatbot_append_message. A whole-array write from a
 * stale snapshot deleted whatever landed in between. So the append is a
 * compare-and-set on `message_count`: read the current array, write it plus
 * ours only if the count is still what we read, otherwise re-read and retry.
 * chatbot_append_message bumps message_count too, so it takes part in the
 * same check. No migration needed.
 *
 * `conversation` is a snapshot read at the *start* of the request; the model
 * call in between can take seconds, during which a concurrent request (the
 * capture-card submit, another turn, the admin hand-off action) may have
 * written a real value this snapshot doesn't know about. So this never
 * writes a field from the stale snapshot as a fallback — a field is only
 * ever included in the UPDATE when this turn's own value is truthy, which
 * means "nothing changed this turn" leaves the column untouched rather than
 * clobbering a newer value back to null. Same reasoning for `status`: the
 * capture paths (handleChatbotLeadCaptured, the admin hand-off action) own
 * every transition; the one exception here is the strict active ->
 * lead_captured upgrade when THIS turn is what captured contact info.
 */
export async function persistConversationTurn(
  conversation: ChatbotConversation,
  patch: {
    /** Messages this request adds. Empty = update the other fields only. */
    append: readonly ChatbotMessage[];
    capturedName?: string | null;
    capturedEmail?: string | null;
    capturedPhone?: string | null;
    pageUrl?: string | null;
    visitorHash?: string | null;
  },
  deps: { client?: ConversationClient; now?: () => Date } = {},
): Promise<void> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();

  const update: Database["public"]["Tables"]["chatbot_conversations"]["Update"] =
    { last_message_at: now.toISOString() };
  if (patch.capturedName) update.captured_name = patch.capturedName;
  if (patch.capturedEmail) update.captured_email = patch.capturedEmail;
  if (patch.capturedPhone) update.captured_phone = patch.capturedPhone;
  // Write-once: page_url is the page that pulled this visitor in, and the
  // widget survives navigation, so overwriting it on every turn quietly
  // turned it into "the last page they happened to be on". Same first-touch
  // rule the codebase already applies to Entry Source and Resource Tag in
  // Close (see closeTaggingPayload) -- re-sending stomps the real answer.
  // Still fills a null, so a conversation that started before the client sent
  // a page can record one later.
  if (patch.pageUrl && !conversation.page_url) {
    update.page_url = patch.pageUrl;
  }
  if (patch.visitorHash) update.visitor_hash = patch.visitorHash;

  if (
    conversation.status === "active" &&
    (patch.capturedEmail || patch.capturedPhone)
  ) {
    update.status = "lead_captured";
  }

  if (patch.append.length === 0) {
    const { error } = await client
      .from("chatbot_conversations")
      .update(update)
      .eq("id", conversation.id);
    if (error) throw new Error(error.message);
    return;
  }

  for (let attempt = 0; attempt < APPEND_ATTEMPTS; attempt += 1) {
    const current = await client
      .from("chatbot_conversations")
      .select("messages,message_count")
      .eq("id", conversation.id)
      .single();
    if (current.error || !current.data) {
      throw new Error(current.error?.message ?? "conversation not found");
    }
    const merged = [
      ...(Array.isArray(current.data.messages) ? current.data.messages : []),
      ...(patch.append as unknown as Json[]),
    ];
    const { data, error } = await client
      .from("chatbot_conversations")
      .update({ ...update, messages: merged, message_count: merged.length })
      .eq("id", conversation.id)
      .eq("message_count", current.data.message_count)
      .select("id");
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return;
    // Someone appended between our read and write. Re-read and try again.
  }
  throw new Error("chatbot transcript append kept losing the race");
}

/** Defensive read of the stored `messages` jsonb array — never throws on a shape surprise. */
export function toChatbotMessages(value: Json | null): ChatbotMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: ChatbotMessage[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const role = (entry as Record<string, unknown>).role;
    const content = (entry as Record<string, unknown>).content;
    const ts = (entry as Record<string, unknown>).ts;
    if (
      (role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.length > 0
    ) {
      const message: ChatbotMessage = {
        role,
        content,
        ts: typeof ts === "string" ? ts : new Date(0).toISOString(),
      };
      const kind = (entry as Record<string, unknown>).kind;
      // An unrecognised kind (hand-edited row, a kind from a newer deploy)
      // degrades to a plain bubble rather than rendering nothing.
      if (
        typeof kind === "string" &&
        CHATBOT_MESSAGE_KINDS.includes(kind as ChatbotMessageKind) &&
        kind !== "text"
      ) {
        message.kind = kind as ChatbotMessageKind;
        const data = (entry as Record<string, unknown>).data;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          message.data = data as Record<string, Json>;
        }
      }
      messages.push(message);
    }
  }
  return messages;
}

/** Reads the one-sentence summary out of a stored prospect_profile, if any. */
export function prospectSummaryFrom(profile: Json | null): string | null {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return null;
  }
  const summary = (profile as Record<string, unknown>).summary;
  return typeof summary === "string" && summary.trim() ? summary.trim() : null;
}
