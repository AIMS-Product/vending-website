import "server-only";

import { config, publicConfig } from "@/lib/config";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import type { ProspectProfile } from "@/lib/chatbot/extract-prospect-profile";

/**
 * Chatbot lead notifications to #vp-site-leads. Independent of the Resend
 * profile email (src/lib/chatbot/emails.ts) — this is the only channel that
 * actually works today, since RESEND_API_KEY is not configured in this
 * project's Vercel env. Same fail-soft contract as the house Slack helper in
 * src/lib/services/leads.ts: a missing webhook URL or a rejected fetch never
 * throws, it just logs the conversationId and moves on.
 */

const SLACK_CHAR_BUDGET = 3500;
const TRUNCATION_PREFIX =
  "(earlier messages truncated — full transcript in admin)";

export type ChatbotSlackLeadConversation = {
  id: string;
  personaName: string;
  /** True once this conversation has been handed off by an admin. */
  handedOff: boolean;
  capturedName: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  pageUrl: string | null;
  messages: ChatbotMessage[];
};

/** Posts a lead notification with the full transcript. Returns whether the post succeeded — callers use this to decide whether a send was attempted for debounce purposes. Never throws. */
export async function postChatbotLeadToSlack(
  conversation: ChatbotSlackLeadConversation,
  profile?: ProspectProfile | null,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  return postSlackText(
    buildChatbotSlackText(conversation, profile ?? null),
    "chatbot: Slack lead post failed",
    conversation.id,
    deps.fetchImpl,
  );
}

/**
 * Tells the team the chatbot could not answer a visitor (OpenAI down, out of
 * credits, rate limited). Before this existed, a month of failed chats went
 * unnoticed. Fires once per conversation, on its first failed turn. Never throws.
 */
export async function postChatbotOutageToSlack(
  input: { conversationId: string; reason: string; visitorMessage: string | null },
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const adminUrl = `${publicConfig.siteUrl}/admin/chatbot/conversations/${input.conversationId}`;
  const text = [
    "*Chatbot is failing: a visitor got the fallback message instead of an answer*",
    `Reason: ${input.reason.slice(0, 300)}`,
    fieldLine("Visitor asked", input.visitorMessage?.slice(0, 500)),
    `Transcript: ${adminUrl}`,
  ]
    .filter(isPresent)
    .join("\n");
  return postSlackText(
    text,
    "chatbot: Slack outage post failed",
    input.conversationId,
    deps.fetchImpl,
  );
}

async function postSlackText(
  text: string,
  logLabel: string,
  conversationId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const webhookUrl = config.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      console.warn(logLabel, { conversationId, status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    console.warn(logLabel, {
      conversationId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return false;
  }
}

function buildChatbotSlackText(
  conversation: ChatbotSlackLeadConversation,
  profile: ProspectProfile | null,
): string {
  const header = conversation.handedOff
    ? `*${conversation.personaName}: Chatbot hand-off*`
    : `*${conversation.personaName}: New chatbot lead*`;

  const contactLines = [
    fieldLine("Name", conversation.capturedName ?? profile?.name),
    fieldLine("Email", conversation.capturedEmail ?? profile?.email),
    fieldLine("Phone", conversation.capturedPhone ?? profile?.phone),
    fieldLine("Page", conversation.pageUrl),
  ].filter(isPresent);

  const profileLines = profile
    ? [
        fieldLine("Current work", profile.current_work),
        fieldLine("Capital", profile.capital_signal),
        fieldLine("Timeline", profile.timeline),
        fieldLine("Motivation", profile.motivation),
        fieldLine("Call intent", profile.call_intent ? "Yes" : null),
        fieldLine("Sentiment", profile.sentiment),
      ].filter(isPresent)
    : [];

  const adminUrl = `${publicConfig.siteUrl}/admin/chatbot/conversations/${conversation.id}`;
  const footer = `Full transcript: ${adminUrl}`;
  const preamble = [header, ...contactLines, ...profileLines].join("\n");
  const transcript = transcriptBlock(
    conversation,
    preamble.length + footer.length,
  );

  return [preamble, "", transcript, "", footer].join("\n");
}

/**
 * Most-recent-first fit: walks the transcript backwards, keeping whatever
 * fits under the Slack payload budget, and prefixes a truncation notice when
 * something had to be dropped. `reservedChars` accounts for the rest of the
 * message (header/contact/profile lines + the admin URL footer) so the whole
 * payload — not just this block — stays under budget.
 */
function transcriptBlock(
  conversation: ChatbotSlackLeadConversation,
  reservedChars: number,
): string {
  const lines = conversation.messages.map(
    (message) =>
      `${message.role === "user" ? "Visitor" : conversation.personaName}: ${message.content}`,
  );

  // Extra margin for the blank-line joins and the truncation prefix itself.
  const budget =
    SLACK_CHAR_BUDGET - reservedChars - TRUNCATION_PREFIX.length - 20;

  const kept: string[] = [];
  let used = 0;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const cost = lines[i].length + 1;
    if (used + cost > budget) {
      return [TRUNCATION_PREFIX, ...kept].join("\n");
    }
    kept.unshift(lines[i]);
    used += cost;
  }
  return kept.join("\n");
}

function fieldLine(
  label: string,
  value: string | null | undefined,
): string | null {
  return value ? `${label}: ${value}` : null;
}

function isPresent(value: string | null): value is string {
  return value !== null;
}
