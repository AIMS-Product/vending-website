import "server-only";

import { config, publicConfig } from "@/lib/config";
import {
  chatbotLeadRoutingEmails,
  type ChatbotConfig,
} from "@/lib/chatbot/config";
import type { ProspectProfile } from "@/lib/chatbot/extract-prospect-profile";

/**
 * Resend senders for the two email shapes the spec calls for: one
 * prospect-profile email per conversation, and ONE catch-up digest email
 * containing every eligible profile (never N separate emails — see spec
 * §Files, emails.ts). Both follow the fail-soft contract already
 * established in src/lib/services/leads.ts: a missing key or a rejected
 * fetch is reported back as `{ ok: false }`, never thrown.
 */

export type ChatbotEmailResult = { ok: true } | { ok: false; error: string };

export type ChatbotProfileEmailInput = {
  conversationId: string;
  capturedName: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  profile: ProspectProfile | null;
};

type EmailDeps = { fetchImpl?: typeof fetch };

/** True whenever routing is configured AND the admin hasn't muted it. */
export function chatbotEmailsEnabled(config: ChatbotConfig): boolean {
  return config.notifyEnabled && chatbotLeadRoutingEmails(config).length > 0;
}

export async function sendChatbotProfileEmail(
  input: ChatbotProfileEmailInput,
  chatbotConfig: ChatbotConfig,
  deps: EmailDeps = {},
): Promise<ChatbotEmailResult> {
  if (!chatbotEmailsEnabled(chatbotConfig)) {
    return { ok: false, error: "Lead routing is off or has no recipients." };
  }
  const recipients = chatbotLeadRoutingEmails(chatbotConfig);
  const resendReady = hasResendConfig();
  if (!resendReady) return { ok: false, error: "Resend isn't configured." };

  const subject = profileEmailSubject(input);
  const text = [
    subject,
    "",
    ...profileLines(input),
    "",
    `Full transcript: ${conversationUrl(input.conversationId)}`,
  ].join("\n");

  return sendResend({ subject, text, to: recipients }, deps.fetchImpl ?? fetch);
}

export type ChatbotDigestEmailInput = {
  profiles: ChatbotProfileEmailInput[];
};

/**
 * ONE email listing every eligible conversation, hottest first. Splitting
 * this into N separate sends is explicitly what the spec forbids — besides
 * the noise, most inbox providers treat a burst of near-identical emails
 * from one sender as a bulk-send signal.
 */
export async function sendChatbotDigestEmail(
  input: ChatbotDigestEmailInput,
  chatbotConfig: ChatbotConfig,
  deps: EmailDeps = {},
): Promise<ChatbotEmailResult> {
  if (!input.profiles.length) return { ok: false, error: "Nothing to send." };
  if (!chatbotEmailsEnabled(chatbotConfig)) {
    return { ok: false, error: "Lead routing is off or has no recipients." };
  }
  const recipients = chatbotLeadRoutingEmails(chatbotConfig);
  if (!hasResendConfig())
    return { ok: false, error: "Resend isn't configured." };

  const ranked = [...input.profiles].sort(
    (a, b) => hotnessScore(b.profile) - hotnessScore(a.profile),
  );

  const subject = `Chatbot catch-up — ${ranked.length} conversation${ranked.length === 1 ? "" : "s"} to review`;
  const text = [
    subject,
    "",
    ...ranked.flatMap((profile, index) => [
      `${index + 1}. ${profileEmailSubject(profile)}`,
      ...profileLines(profile).map((line) => `   ${line}`),
      `   Full transcript: ${conversationUrl(profile.conversationId)}`,
      "",
    ]),
  ].join("\n");

  return sendResend({ subject, text, to: recipients }, deps.fetchImpl ?? fetch);
}

function hasResendConfig(): boolean {
  return Boolean(config.RESEND_API_KEY && config.LEAD_NOTIFICATION_FROM);
}

async function sendResend(
  message: { subject: string; text: string; to: string[] },
  fetchImpl: typeof fetch,
): Promise<ChatbotEmailResult> {
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.LEAD_NOTIFICATION_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await safeResponseText(response);
      return {
        ok: false,
        error: `Resend rejected the chatbot email (${response.status})${body ? `: ${body}` : ""}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Resend request failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

function profileEmailSubject(input: ChatbotProfileEmailInput): string {
  const name =
    input.capturedName?.trim() ||
    input.capturedEmail ||
    input.capturedPhone ||
    "A visitor";
  return `${name} chatted with the site chatbot`;
}

function profileLines(input: ChatbotProfileEmailInput): string[] {
  const p = input.profile;
  return [
    fieldLine("Name", input.capturedName ?? p?.name),
    fieldLine("Email", input.capturedEmail ?? p?.email),
    fieldLine("Phone", input.capturedPhone ?? p?.phone),
    fieldLine("Current work", p?.current_work),
    fieldLine("Capital signal", p?.capital_signal),
    fieldLine("Timeline", p?.timeline),
    fieldLine("Market", p?.state_or_market),
    fieldLine("Motivation", p?.motivation),
    fieldLine("Sentiment", p?.sentiment),
    fieldLine(
      "Follow-up needed",
      p ? (p.follow_up_needed ? "Yes" : "No") : null,
    ),
    fieldLine("Summary", p?.summary),
  ].filter((line): line is string => line !== null);
}

function fieldLine(
  label: string,
  value: string | null | undefined,
): string | null {
  return value ? `${label}: ${value}` : null;
}

function conversationUrl(conversationId: string): string {
  return `${publicConfig.siteUrl}/admin/chatbot/conversations/${conversationId}`;
}

/**
 * Ranks a digest entry hot-to-cold from the one LLM-derived signal set the
 * spec gives us (extract-prospect-profile's output). Call intent and an
 * explicit follow-up flag outweigh a merely-filled-out profile.
 */
function hotnessScore(profile: ProspectProfile | null): number {
  if (!profile) return 0;
  let score = 0;
  if (profile.call_intent) score += 3;
  if (profile.follow_up_needed) score += 2;
  if (profile.timeline) score += 1;
  if (profile.capital_signal) score += 1;
  return score;
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return "";
  }
}
