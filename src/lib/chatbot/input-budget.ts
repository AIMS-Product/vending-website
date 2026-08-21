import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export const CHATBOT_INPUT_LIMITS = {
  maxMessageChars: 4000,
  maxMessagesPerRequest: 50,
  maxAggregateChars: 40_000,
  maxOutputTokens: 700,
  dailyCallCap: 2000,
} as const;

export type ChatbotBudgetMessage = { content: string };

export type ChatbotBudgetViolation =
  | "message_too_long"
  | "too_many_messages"
  | "aggregate_too_long";

export type ChatbotBudgetResult =
  | { ok: true }
  | { ok: false; violation: ChatbotBudgetViolation };

/** Synchronous shape checks — no I/O, safe to call before touching the DB or OpenAI. */
export function checkChatbotInputBudget(
  messages: readonly ChatbotBudgetMessage[],
): ChatbotBudgetResult {
  if (messages.length > CHATBOT_INPUT_LIMITS.maxMessagesPerRequest) {
    return { ok: false, violation: "too_many_messages" };
  }

  const tooLong = messages.some(
    (message) => message.content.length > CHATBOT_INPUT_LIMITS.maxMessageChars,
  );
  if (tooLong) return { ok: false, violation: "message_too_long" };

  const aggregate = messages.reduce(
    (sum, message) => sum + message.content.length,
    0,
  );
  if (aggregate > CHATBOT_INPUT_LIMITS.maxAggregateChars) {
    return { ok: false, violation: "aggregate_too_long" };
  }

  return { ok: true };
}

type BudgetClient = Pick<SupabaseClient<Database>, "from">;

export type ChatbotDailyCapDeps = {
  client?: BudgetClient;
  now?: () => Date;
};

/**
 * Global daily safety valve. Counts conversation rows touched today as a
 * cheap proxy for OpenAI call volume — this schema has no per-turn call log,
 * so an exact count would cost a second table and a write on every turn.
 *
 * ponytail: undercounts a conversation with many turns in one day as "one".
 * Good enough for a coarse kill switch; add a real per-call counter if this
 * ever needs to be exact.
 *
 * Fails OPEN on any error, same contract as checkPublicRateLimit — losing
 * the chatbot to a transient DB blip costs more than the flood this guards.
 */
export async function isUnderChatbotDailyCap(
  deps: ChatbotDailyCapDeps = {},
): Promise<boolean> {
  try {
    const client = deps.client ?? createAdminClient();
    const now = deps.now?.() ?? new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const { count, error } = await client
      .from("chatbot_conversations")
      .select("id", { count: "exact", head: true })
      .gte("last_message_at", startOfDay.toISOString());
    if (error) throw new Error(error.message);

    return (count ?? 0) < CHATBOT_INPUT_LIMITS.dailyCallCap;
  } catch (error) {
    console.warn("chatbot daily cap check failed open", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return true;
  }
}
