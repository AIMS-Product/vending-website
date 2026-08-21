import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadChatbotConfigFresh } from "@/lib/chatbot/config";
import {
  toChatbotMessages,
  type ChatbotMessage,
} from "@/lib/chatbot/conversation-store";
import { chatbotBookingUrl } from "@/lib/chatbot/booking";
import {
  chatbotEmailsEnabled,
  sendChatbotDigestEmail,
  sendChatbotProfileEmail,
  type ChatbotProfileEmailInput,
} from "@/lib/chatbot/emails";
import {
  extractProspectProfile,
  prospectProfileSchema,
  type ProspectProfile,
} from "@/lib/chatbot/extract-prospect-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

/**
 * The three consumers of "extract a profile and email the team about this
 * conversation" (the digest cron, the manual catch-up digest, and the
 * "hand off to team" admin action — spec §Files + wiring items 5a/5b/5c) all
 * go through this file so the debounce stamp, the extraction fallback, and
 * the fail-soft email contract only exist in one place.
 */

const DEBOUNCE_MINUTES = 30;
const IDLE_MINUTES = 5;
const STALE_HOURS = 24;
const MAX_DIGEST_CRON_PER_RUN = 25;
// Wider than the per-run cap: PostgREST cannot compare two columns
// (prospect_profile_emailed_at vs last_message_at) in a filter, so the real
// "anything new since the last email" check runs in code below, over a wider
// candidate set, before the final cap is applied.
const DIGEST_CRON_CANDIDATE_LIMIT = 100;
const CATCH_UP_MAX_CONVERSATIONS = 200;
const CATCH_UP_EXTRACTION_CONCURRENCY = 4;
const CATCH_UP_EXTRACTION_BUDGET_MS = 50_000;

type ConversationRow = {
  id: string;
  session_id: string;
  captured_name: string | null;
  captured_email: string | null;
  captured_phone: string | null;
  messages: Json;
  prospect_profile: Json | null;
  prospect_profile_emailed_at: string | null;
};

type DigestConversation = {
  id: string;
  sessionId: string;
  capturedName: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  messages: ChatbotMessage[];
  prospectProfile: ProspectProfile | null;
};

function toDigestConversation(row: ConversationRow): DigestConversation {
  return {
    id: row.id,
    sessionId: row.session_id,
    capturedName: row.captured_name,
    capturedEmail: row.captured_email,
    capturedPhone: row.captured_phone,
    messages: toChatbotMessages(row.messages),
    prospectProfile: parseProspectProfile(row.prospect_profile),
  };
}

function parseProspectProfile(value: Json | null): ProspectProfile | null {
  if (!value) return null;
  const parsed = prospectProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const CONVERSATION_ROW_FIELDS =
  "id, session_id, captured_name, captured_email, captured_phone, messages, prospect_profile, prospect_profile_emailed_at" as const;

export type SendProfileEmailResult = { sent: boolean; reason?: string };

/**
 * Single-conversation seam: extract (or reuse a stored) profile, send the
 * one-conversation email, stamp the debounce. Extraction + persistence of
 * the profile always runs once a contact is captured, independent of
 * whether routing/Resend is configured — only the *stamp* is gated on an
 * actual send attempt. A path that attempts a send stamps even on a failed
 * send — the alternative (retry every cron tick forever on a broken Resend
 * key) is worse than waiting for the next debounce window; a path that
 * never attempts a send does not stamp, so a later config fix still finds
 * the conversation eligible. `force` skips the debounce check only; it
 * never skips the "has a captured email or phone" requirement.
 */
export async function sendProfileEmailForConversation(
  conversationId: string,
  options: { force?: boolean } = {},
  deps: { client?: Client; now?: () => Date } = {},
): Promise<SendProfileEmailResult> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();

  const { data, error } = await client
    .from("chatbot_conversations")
    .select(CONVERSATION_ROW_FIELDS)
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data) return { sent: false, reason: "Conversation not found." };

  const conv = toDigestConversation(data);
  if (!conv.capturedEmail && !conv.capturedPhone) {
    return { sent: false, reason: "No contact captured." };
  }
  if (
    !options.force &&
    isWithinDebounce(data.prospect_profile_emailed_at, now)
  ) {
    return { sent: false, reason: "Already emailed recently." };
  }

  const config = await loadChatbotConfigFresh();

  // Extract + persist regardless of whether an email can actually go out —
  // routing being off or Resend being unconfigured must not cost the team
  // the profile data itself. `if (!profile)` also means this only ever runs
  // once per conversation: a re-read on the next call sees the stored value
  // and skips straight past extraction.
  let profile = conv.prospectProfile;
  if (!profile) {
    profile = await extractProspectProfile(conv.messages, {
      model: config.model,
    });
    if (profile) await storeProfile(client, conversationId, profile);
  }

  if (!chatbotEmailsEnabled(config)) {
    // No send was attempted, so do NOT stamp — stamping here without ever
    // trying is exactly what left prospect_profile_emailed_at set while
    // prospect_profile stayed null. Leave the conversation eligible so a
    // later routing fix still picks it up.
    return { sent: false, reason: "Lead routing is off or has no recipients." };
  }

  const input: ChatbotProfileEmailInput = {
    conversationId: conv.id,
    capturedName: conv.capturedName,
    capturedEmail: conv.capturedEmail,
    capturedPhone: conv.capturedPhone,
    ...bookingFieldsFor(
      conv,
      await fetchBookedConversationIds(client, [conv.id]),
    ),
    profile,
  };
  const result = await sendChatbotProfileEmail(input, config);
  await stampEmailed(client, conversationId, now);

  if (!result.ok) {
    console.warn("chatbot: profile email failed", {
      conversationId,
      error: result.error,
    });
    return { sent: false, reason: result.error };
  }
  return { sent: true };
}

function isWithinDebounce(emailedAt: string | null, now: Date): boolean {
  if (!emailedAt) return false;
  const elapsedMinutes =
    (now.getTime() - new Date(emailedAt).getTime()) / 60_000;
  return elapsedMinutes < DEBOUNCE_MINUTES;
}

async function stampEmailed(
  client: Client,
  conversationId: string,
  now: Date,
): Promise<void> {
  const { error } = await client
    .from("chatbot_conversations")
    .update({ prospect_profile_emailed_at: now.toISOString() })
    .eq("id", conversationId);
  if (error) {
    console.warn("chatbot: could not stamp prospect_profile_emailed_at", {
      conversationId,
      error: error.message,
    });
  }
}

async function storeProfile(
  client: Client,
  conversationId: string,
  profile: ProspectProfile,
): Promise<void> {
  const { error } = await client
    .from("chatbot_conversations")
    .update({ prospect_profile: profile as unknown as Json })
    .eq("id", conversationId);
  if (error) {
    console.warn("chatbot: could not store prospect_profile", {
      conversationId,
      error: error.message,
    });
  }
}

export type DigestCronResult = {
  scanned: number;
  sent: number;
  skipped: number;
  markedAbandoned: number;
};

/**
 * Every-10-minutes cron: conversations idle ≥5min with a captured contact
 * and outside the 30-minute debounce get an individual profile email; stale
 * (≥24h idle) uncaptured conversations get marked abandoned so they stop
 * showing up as "active" in the admin list.
 */
export async function runChatbotDigestCron(
  deps: { client?: Client; now?: () => Date } = {},
): Promise<DigestCronResult> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();

  const eligible = await findDigestCronEligibleConversations(client, now);
  let sent = 0;
  let skipped = 0;
  for (const conv of eligible) {
    const result = await sendProfileEmailForConversation(
      conv.id,
      {},
      { client, now: () => now },
    );
    if (result.sent) sent += 1;
    else skipped += 1;
  }

  const markedAbandoned = await markStaleUncapturedConversationsAbandoned({
    client,
    now: () => now,
  });

  return { scanned: eligible.length, sent, skipped, markedAbandoned };
}

async function findDigestCronEligibleConversations(
  client: Client,
  now: Date,
): Promise<DigestConversation[]> {
  const idleCutoff = new Date(
    now.getTime() - IDLE_MINUTES * 60_000,
  ).toISOString();

  const { data, error } = await client
    .from("chatbot_conversations")
    .select(
      "id, session_id, captured_name, captured_email, captured_phone, messages, prospect_profile, prospect_profile_emailed_at, status, last_message_at",
    )
    .in("status", ["active", "lead_captured"])
    .lte("last_message_at", idleCutoff)
    .or("captured_email.not.is.null,captured_phone.not.is.null")
    .order("last_message_at", { ascending: true })
    .limit(DIGEST_CRON_CANDIDATE_LIMIT);
  if (error) throw new Error(error.message);

  // Steady state must be zero eligible rows once nothing has happened since
  // the last email — a wall-clock debounce (elapsed time since the email)
  // can't express that, it just re-opens every DEBOUNCE_MINUTES forever.
  // "Never emailed" or "a visitor turn landed after the last email" are the
  // only two eligible states.
  const eligible = (data ?? []).filter((row) => {
    if (!row.prospect_profile_emailed_at) return true;
    return (
      new Date(row.prospect_profile_emailed_at).getTime() <
      new Date(row.last_message_at).getTime()
    );
  });

  return eligible.slice(0, MAX_DIGEST_CRON_PER_RUN).map(toDigestConversation);
}

export async function markStaleUncapturedConversationsAbandoned(
  deps: { client?: Client; now?: () => Date } = {},
): Promise<number> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();
  const staleCutoff = new Date(
    now.getTime() - STALE_HOURS * 3_600_000,
  ).toISOString();

  const { data, error } = await client
    .from("chatbot_conversations")
    .update({ status: "abandoned" })
    .eq("status", "active")
    .lt("last_message_at", staleCutoff)
    .is("captured_email", null)
    .is("captured_phone", null)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export type CatchUpDigestResult = {
  eligible: number;
  extracted: number;
  reusedProfile: number;
  extractionIncomplete: number;
  emailed: boolean;
  emailError?: string;
  timedOut: boolean;
};

/**
 * Admin-triggered catch-up (item 5b): unlike the cron, this re-includes
 * conversations already emailed — the admin is fixing a routing gap, not
 * running steady-state — and sends every eligible profile in ONE digest
 * email rather than one per conversation.
 */
export async function runChatbotCatchUpDigest(
  windowDays: number,
  deps: { client?: Client; now?: () => Date } = {},
): Promise<CatchUpDigestResult> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();

  const eligible = await findCatchUpEligibleConversations(
    client,
    windowDays,
    now,
  );
  if (!eligible.length) {
    return {
      eligible: 0,
      extracted: 0,
      reusedProfile: 0,
      extractionIncomplete: 0,
      emailed: false,
      timedOut: false,
    };
  }

  const config = await loadChatbotConfigFresh();
  const withProfile = eligible.filter((c) => c.prospectProfile);
  const needsExtraction = eligible.filter((c) => !c.prospectProfile);

  const { results, timedOut } = await runWithConcurrencyBudget(
    needsExtraction,
    (conv) => extractProspectProfile(conv.messages, { model: config.model }),
    {
      concurrency: CATCH_UP_EXTRACTION_CONCURRENCY,
      budgetMs: CATCH_UP_EXTRACTION_BUDGET_MS,
    },
  );

  for (const conv of needsExtraction) {
    const profile = results.get(conv.id);
    if (profile) await storeProfile(client, conv.id, profile);
  }

  const bookedIds = await fetchBookedConversationIds(
    client,
    eligible.map((conv) => conv.id),
  );
  const profileEntries: ChatbotProfileEmailInput[] = eligible.map((conv) => ({
    conversationId: conv.id,
    capturedName: conv.capturedName,
    capturedEmail: conv.capturedEmail,
    capturedPhone: conv.capturedPhone,
    profile: conv.prospectProfile ?? results.get(conv.id) ?? null,
    ...bookingFieldsFor(conv, bookedIds),
  }));

  const emailResult = await sendChatbotDigestEmail(
    { profiles: profileEntries },
    config,
  );

  if (emailResult.ok) {
    const { error } = await client
      .from("chatbot_conversations")
      .update({ prospect_profile_emailed_at: now.toISOString() })
      .in(
        "id",
        eligible.map((c) => c.id),
      );
    if (error) {
      console.warn("chatbot: could not stamp catch-up digest recipients", {
        error: error.message,
      });
    }
  }

  const extracted = Array.from(results.values()).filter(Boolean).length;
  return {
    eligible: eligible.length,
    extracted,
    reusedProfile: withProfile.length,
    extractionIncomplete: needsExtraction.length - results.size,
    emailed: emailResult.ok,
    emailError: emailResult.ok ? undefined : emailResult.error,
    timedOut,
  };
}

/**
 * Booking state for a digest entry.
 *
 * `call_booked_at` is authoritative: it is the one value the Calendly webhook
 * writes race-free. The transcript card is only a fallback for the window
 * before the v2 migration is applied, because the card CAN be lost — a chat
 * turn rewrites the whole messages array from a pre-model-call snapshot and
 * can overwrite it. Reading the card alone would put someone who booked ten
 * minutes ago at the top of the "CALL THESE NOW — they have not booked"
 * block, which is precisely what this digest exists to avoid.
 */
function bookingFieldsFor(
  conversation: {
    id: string;
    capturedName: string | null;
    capturedEmail: string | null;
    messages: ChatbotMessage[];
  },
  bookedIds: ReadonlySet<string> | null,
): {
  callBooked: boolean;
  bookingUrl: string | null;
} {
  return {
    // `null` means the booked-call lookup could not run at all (pre-migration,
    // or a transient failure) — only then is the transcript card consulted.
    // Never both: the webhook deliberately leaves the card in place on a
    // cancellation and only clears the timestamp, so an OR here would report
    // someone who just freed their slot as still booked and drop them out of
    // the "call these now" block.
    callBooked: bookedIds
      ? bookedIds.has(conversation.id)
      : conversation.messages.some(
          (message) => message.kind === "booking_confirmed",
        ),
    bookingUrl: chatbotBookingUrl({
      conversationId: conversation.id,
      name: conversation.capturedName,
      email: conversation.capturedEmail,
    }),
  };
}

/**
 * Which of these conversations have a live booked call. Reads both signals in
 * one pass: the conversation's own call_booked_at (set by the Calendly
 * webhook) and the linked lead's call_booked_at (reconciled from Close, which
 * is the signal that actually works today — see
 * .claude/specs/2026-08-20-booking-attribution.md).
 *
 * Returns null, not an empty set, when the lookup cannot run — the caller
 * treats that as "unknown" and falls back to the transcript card.
 */
async function fetchBookedConversationIds(
  client: Client,
  ids: string[],
): Promise<ReadonlySet<string> | null> {
  if (ids.length === 0) return new Set();
  const { data, error } = await client
    .from("chatbot_conversations")
    .select("id, lead_submission_id, call_booked_at")
    .in("id", ids);
  if (error) {
    console.warn("chatbot: booked-call lookup unavailable for the digest", {
      error: error.message,
    });
    return null;
  }

  const rows = data ?? [];
  const booked = new Set(
    rows.filter((row) => row.call_booked_at).map((row) => row.id),
  );

  const leadIds = rows
    .filter((row) => !row.call_booked_at && row.lead_submission_id)
    .map((row) => row.lead_submission_id as string);
  if (leadIds.length === 0) return booked;

  const leads = await client
    .from("lead_submissions")
    .select("id")
    .in("id", leadIds)
    .not("call_booked_at", "is", null);
  if (leads.error) {
    // The conversation-level signal still stands; only the Close-derived half
    // is missing, so report what is known rather than nothing.
    console.warn("chatbot: Close-reconciled booking lookup failed", {
      error: leads.error.message,
    });
    return booked;
  }

  const bookedLeadIds = new Set((leads.data ?? []).map((row) => row.id));
  for (const row of rows) {
    if (row.lead_submission_id && bookedLeadIds.has(row.lead_submission_id)) {
      booked.add(row.id);
    }
  }
  return booked;
}

async function findCatchUpEligibleConversations(
  client: Client,
  windowDays: number,
  now: Date,
): Promise<DigestConversation[]> {
  const start = new Date(
    now.getTime() - windowDays * 24 * 3_600_000,
  ).toISOString();

  const { data, error } = await client
    .from("chatbot_conversations")
    .select(
      "id, session_id, captured_name, captured_email, captured_phone, messages, prospect_profile, prospect_profile_emailed_at, message_count, created_at",
    )
    .gte("created_at", start)
    .gt("message_count", 0)
    .or(
      "status.eq.lead_captured,captured_email.not.is.null,captured_phone.not.is.null",
    )
    .order("last_message_at", { ascending: false })
    .limit(CATCH_UP_MAX_CONVERSATIONS);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toDigestConversation);
}

/**
 * Minimal worker-pool: N workers pull from a shared queue until either the
 * queue drains or the budget runs out. `timedOut` tells the caller some
 * items were never attempted (partial-completion reporting per spec item
 * 5b) — those are reported as `extractionIncomplete`, not silently dropped.
 */
async function runWithConcurrencyBudget<T extends { id: string }, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  options: { concurrency: number; budgetMs: number },
): Promise<{ results: Map<string, R>; timedOut: boolean }> {
  const results = new Map<string, R>();
  if (!items.length) return { results, timedOut: false };

  const deadline = Date.now() + options.budgetMs;
  let index = 0;
  let timedOut = false;

  async function drain() {
    while (index < items.length) {
      if (Date.now() >= deadline) {
        timedOut = true;
        return;
      }
      const item = items[index];
      index += 1;
      results.set(item.id, await worker(item));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, items.length) }, () =>
      drain(),
    ),
  );
  return { results, timedOut };
}
