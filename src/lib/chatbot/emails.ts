import "server-only";

import { config, publicConfig } from "@/lib/config";
import {
  chatbotLeadRoutingEmails,
  type ChatbotConfig,
} from "@/lib/chatbot/config";
import type { ProspectProfile } from "@/lib/chatbot/extract-prospect-profile";
import type { ChatbotResource } from "@/lib/chatbot/resources";

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
  /** True once a Calendly booking was attributed to this conversation. */
  callBooked?: boolean;
  /** Conversation-tagged booking link, so a rep sending one keeps attribution intact. */
  bookingUrl?: string | null;
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
  if (!input.capturedEmail && !input.capturedPhone) {
    // Defense in depth: the only caller (learning/digest.ts) already checks
    // this before extracting/emailing, but a team email with no way to reach
    // the lead is a critical-field gap either way — skip and log rather than
    // send an email that tells nobody how to follow up.
    console.warn("chatbot: profile email skipped, no contact captured", {
      conversationId: input.conversationId,
    });
    return { ok: false, error: "No contact captured." };
  }
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

  // v2 ordering: the point of this email is phone calls, so people who asked
  // to talk and have NOT booked go in their own block at the top. Everything
  // else keeps the old hotness ranking below it.
  const callNow = input.profiles
    .filter(needsACallNow)
    .sort((a, b) => hotnessScore(b.profile) - hotnessScore(a.profile));
  const callNowIds = new Set(callNow.map((entry) => entry.conversationId));
  const rest = input.profiles
    .filter((entry) => !callNowIds.has(entry.conversationId))
    .sort((a, b) => hotnessScore(b.profile) - hotnessScore(a.profile));

  const subject = callNow.length
    ? `Chatbot: ${callNow.length} to call now, ${rest.length} more to review`
    : `Chatbot catch-up — ${rest.length} conversation${rest.length === 1 ? "" : "s"} to review`;

  const text = [
    subject,
    "",
    ...(callNow.length
      ? [
          "CALL THESE NOW — they asked to talk and have not booked:",
          "",
          ...callNow.flatMap((profile, index) =>
            digestEntryLines(profile, index + 1, true),
          ),
        ]
      : []),
    ...(rest.length
      ? [
          callNow.length ? "EVERYONE ELSE:" : "",
          "",
          ...rest.flatMap((profile, index) =>
            digestEntryLines(profile, index + 1, false),
          ),
        ]
      : []),
  ]
    .filter((line) => line !== null)
    .join("\n");

  return sendResend({ subject, text, to: recipients }, deps.fetchImpl ?? fetch);
}

/** Used only if neither env var is set — keeps a send working the moment RESEND_API_KEY lands, even before the from-address is configured. */
const FALLBACK_FROM_ADDRESS = "Vendingpreneurs <hello@vendingpreneurs.com>";

/**
 * From-address chain every chatbot sender goes through: the dedicated lead
 * var, then the general Resend var, then a hardcoded default. Only
 * RESEND_API_KEY is treated as "not configured" (see hasResendConfig) —
 * the from-address always resolves to something sendable.
 */
function resolveFromAddress(): string {
  return (
    config.LEAD_NOTIFICATION_FROM?.trim() ||
    config.RESEND_FROM_EMAIL?.trim() ||
    FALLBACK_FROM_ADDRESS
  );
}

function hasResendConfig(): boolean {
  return Boolean(config.RESEND_API_KEY);
}

async function sendResend(
  message: {
    subject: string;
    text: string;
    to: string[];
    /** Overrides the display name only — the address always stays the verified sender. */
    fromName?: string;
    replyTo?: string[];
  },
  fetchImpl: typeof fetch,
): Promise<ChatbotEmailResult> {
  try {
    const from = resolveFromAddress();
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: message.fromName ? withFromName(from, message.fromName) : from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.replyTo?.length ? { reply_to: message.replyTo } : {}),
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

/**
 * Asked for a call and does not have one on the calendar. This is the only
 * segment in the digest that is worth interrupting a rep's morning for.
 */
function needsACallNow(input: ChatbotProfileEmailInput): boolean {
  if (input.callBooked) return false;
  return Boolean(input.profile?.call_intent);
}

function digestEntryLines(
  input: ChatbotProfileEmailInput,
  position: number,
  callFirst: boolean,
): string[] {
  return [
    `${position}. ${leadLabel(input)}`,
    // Phone first in the call block: it is the action being asked for.
    ...(callFirst && input.capturedPhone
      ? [`   CALL: ${input.capturedPhone}`]
      : []),
    ...profileLines(input).map((line) => `   ${line}`),
    ...(input.bookingUrl && !input.callBooked
      ? [`   Send them a booking link: ${input.bookingUrl}`]
      : []),
    ...(input.callBooked ? ["   Already booked a call."] : []),
    `   Full transcript: ${conversationUrl(input.conversationId)}`,
    "",
  ];
}

export type ChatbotResourceEmailInput = {
  to: string;
  visitorName: string | null;
  personaName: string;
  resources: ChatbotResource[];
  bookingUrl: string | null;
  /** Whatever's been extracted for this conversation so far — often null, since extraction usually runs later on idle. Used only for the opening line. */
  profile?: ProspectProfile | null;
};

/**
 * The first email this system sends TO a visitor rather than to the team, and
 * the reason "I'll send that over" can be a true statement. Deliberately
 * plain text from the persona's display name with reply-to pointed at the
 * sales inbox, so a reply lands with a human instead of bouncing.
 *
 * Unlike the team emails above this does NOT check chatbotEmailsEnabled():
 * that flag mutes internal notifications. Refusing to deliver a resource the
 * visitor just asked for because the team muted its own digest would be a
 * broken promise to the visitor. It still requires Resend to be configured.
 */
export async function sendChatbotResourceEmail(
  input: ChatbotResourceEmailInput,
  chatbotConfig: ChatbotConfig,
  deps: EmailDeps = {},
): Promise<ChatbotEmailResult> {
  if (!input.to.trim()) {
    console.warn("chatbot: resource email skipped, no recipient address");
    return { ok: false, error: "No recipient email." };
  }
  if (!input.resources.length) return { ok: false, error: "Nothing to send." };
  if (!hasResendConfig())
    return { ok: false, error: "Resend isn't configured." };

  const greeting = input.visitorName?.trim()
    ? `Hey ${input.visitorName.trim()},`
    : "Hey,";
  const subject =
    input.resources.length === 1
      ? `${input.resources[0].title}`
      : `The ${input.resources.length} things we talked about`;

  const openerLine = personalOpener(input.profile ?? null);

  // One blank line between paragraphs — join("\n\n") already inserts it
  // between array items, so no item here should also carry its own "".
  const text = [
    greeting,
    // Fixed copy, deliberately. An earlier draft let the model write this
    // line; that turned a verified-domain sender with the sales inbox as
    // reply-to into 400 characters of attacker-steerable text. The resource
    // blurbs below already say what these are.
    `${openerLine} All free, nothing to sign up for.`,
    ...input.resources.map(
      (resource) =>
        `${resource.title}\n${resource.blurb}\n${absoluteUrl(resource.url)}`,
    ),
    ...(input.bookingUrl
      ? [
          `If you'd rather just talk it through, grab a free 15 minutes here: ${input.bookingUrl}`,
        ]
      : []),
    `${input.personaName}\nVendingpreneurs`,
  ].join("\n\n");

  // Replies go to the sales inbox by default. If routing is off/unset, fall
  // back to the from-address itself rather than omitting reply-to — a real
  // reply from a visitor should always land somewhere, never bounce.
  const teamReplyTo = chatbotLeadRoutingEmails(chatbotConfig);
  const replyTo = teamReplyTo.length
    ? teamReplyTo
    : [addressOnly(resolveFromAddress())];

  return sendResend(
    {
      subject,
      text,
      to: [input.to],
      fromName: `${input.personaName} at Vendingpreneurs`,
      replyTo,
    },
    deps.fetchImpl ?? fetch,
  );
}

/**
 * One line referencing what the visitor already told the bot, so the email
 * reads like Mia picking the conversation back up rather than a form
 * response. Both source fields are free-text model extractions, so this is
 * built to read naturally after "about ___" regardless of whether the value
 * is a noun phrase ("managing a retail store") or a gerund phrase ("wanting
 * more flexibility") — the two shapes the extraction prompt actually produces.
 * Falls back to a plain opener when nothing's been extracted yet, which is
 * the common case: extraction usually runs later, on idle.
 */
function personalOpener(profile: ProspectProfile | null): string {
  const detail = profile?.current_work?.trim() || profile?.motivation?.trim();
  if (!detail) return "Here's what I promised.";
  return `Following up on what you shared about ${lowerFirst(detail)}, here's what I promised.`;
}

function lowerFirst(value: string): string {
  return value.length ? value[0].toLowerCase() + value.slice(1) : value;
}

function absoluteUrl(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${publicConfig.siteUrl}${path}`;
}

/**
 * Swaps the display name on a `Name <address@domain>` sender while keeping
 * the address exactly as configured — a Resend send fails outright if the
 * address is not on a verified domain, so the address is never derived.
 */
function withFromName(from: string, name: string): string {
  const address = addressOnly(from);
  if (!address) return from;
  return `${name} <${address}>`;
}

/** Bare `address@domain` out of a `Name <address@domain>` sender, or the input unchanged if it's already bare. */
function addressOnly(from: string): string {
  return from.match(/<([^>]+)>/)?.[1] ?? from;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** `{name or email} — {call intent? 'wants a call' : topic}`, shared by the subject line and each digest row. */
function leadLabel(input: ChatbotProfileEmailInput): string {
  const name =
    input.capturedName?.trim() ||
    input.capturedEmail ||
    input.capturedPhone ||
    "A visitor";
  const tail = input.profile?.call_intent
    ? "wants a call"
    : truncate(
        input.profile?.summary?.trim() || "chatted with the site chatbot",
        60,
      );
  return `${name} — ${tail}`;
}

function profileEmailSubject(input: ChatbotProfileEmailInput): string {
  return `Chatbot lead: ${leadLabel(input)}`;
}

/**
 * Scannable order: contact, then call intent (the one signal that decides
 * whether this gets a same-day reply), then capital/timeline/motivation, then
 * the lower-priority extras, then the one-sentence summary last. The
 * transcript link is appended by each caller, after this.
 */
function profileLines(input: ChatbotProfileEmailInput): string[] {
  const p = input.profile;
  return [
    fieldLine("Name", input.capturedName ?? p?.name),
    fieldLine("Email", input.capturedEmail ?? p?.email),
    fieldLine("Phone", input.capturedPhone ?? p?.phone),
    fieldLine("Call intent", p ? (p.call_intent ? "Yes" : "No") : null),
    fieldLine("Capital signal", p?.capital_signal),
    fieldLine("Timeline", p?.timeline),
    fieldLine("Motivation", p?.motivation),
    fieldLine("Current work", p?.current_work),
    fieldLine("Market", p?.state_or_market),
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
