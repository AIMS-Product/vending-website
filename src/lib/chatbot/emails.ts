import "server-only";

import { config, publicConfig } from "@/lib/config";
import {
  chatbotLeadRoutingEmails,
  type ChatbotConfig,
} from "@/lib/chatbot/config";
import type { ProspectProfile } from "@/lib/chatbot/extract-prospect-profile";
import {
  CASE_STUDY_KEY_PREFIX,
  type ChatbotResource,
} from "@/lib/chatbot/resources";

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
    /** Lead-facing sends only (sendChatbotResourceEmail) — team digests stay plain text. */
    html?: string;
    to: string[];
    /** Overrides the display name only — the address always stays the verified sender. */
    fromName?: string;
    replyTo?: string[];
  },
  fetchImpl: typeof fetch,
): Promise<ChatbotEmailResult> {
  try {
    const from = resolveFromAddress();
    // Single choke point: every sender in this file (lead-facing and
    // team-facing) routes through sendResend, so sanitizing here — instead
    // of in each sender — is the one place that guarantees no em/en dash
    // ever reaches Resend, including inside LLM-extracted profile text.
    const subject = sanitizeDashes(message.subject);
    const text = sanitizeDashes(message.text);
    const html = message.html ? sanitizeDashes(message.html) : undefined;
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: message.fromName ? withFromName(from, message.fromName) : from,
        to: message.to,
        subject,
        text,
        ...(html ? { html } : {}),
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

  const content = buildResourceEmailContent(input);

  // Replies go to the sales inbox by default. If routing is off/unset, fall
  // back to the from-address itself rather than omitting reply-to — a real
  // reply from a visitor should always land somewhere, never bounce.
  const teamReplyTo = chatbotLeadRoutingEmails(chatbotConfig);
  const replyTo = teamReplyTo.length
    ? teamReplyTo
    : [addressOnly(resolveFromAddress())];

  return sendResend(
    {
      subject: content.subject,
      text: content.text,
      html: content.html,
      to: [input.to],
      fromName: `${input.personaName} at Vendingpreneurs`,
      replyTo,
    },
    deps.fetchImpl ?? fetch,
  );
}

const BRAND_BLUE = "#1f72a5";

type ResourceEmailContent = { subject: string; text: string; html: string };

/**
 * Builds both the text and HTML bodies from the same content decisions, so
 * they can never drift into saying different things. Two shapes:
 *
 * - A single specific member story (`case_study:<slug>`, and only that) gets
 *   Mia's personal case-study treatment: a subject in her voice instead of
 *   the story's title, and — when a profile detail exists — one line
 *   connecting the visitor's own situation to the member's before the story
 *   link (item 3 of the 2026-08-24 polish pass).
 * - Everything else (roadmap, worksheet, the case-study index, or a
 *   multi-resource send) keeps the original "here's what I promised"
 *   template.
 */
function buildResourceEmailContent(
  input: ChatbotResourceEmailInput,
): ResourceEmailContent {
  const profile = input.profile ?? null;
  const firstName =
    firstNameFrom(input.visitorName) ?? firstNameFrom(profile?.name);
  const greeting = firstName ? `Hey ${firstName},` : "Hey,";

  const soleCaseStudy = soleCaseStudyResource(input.resources);
  const { subject, openerText } = soleCaseStudy
    ? caseStudyOpener(soleCaseStudy, profile)
    : generalOpener(input.resources, profile);

  const resourceTextBlocks = input.resources.map(
    (resource) =>
      `${resource.title}\n${resource.blurb}\n${absoluteUrl(resource.url)}`,
  );
  const resourceHtmlBlocks = input.resources.map(
    (resource) =>
      `<strong>${escapeHtml(resource.title)}</strong><br>${escapeHtml(resource.blurb)}<br>` +
      `<a href="${escapeHtml(absoluteUrl(resource.url))}" style="color:${BRAND_BLUE};">${escapeHtml(anchorTextFor(resource))}</a>`,
  );

  const bookingText = input.bookingUrl
    ? [
        `If you'd rather just talk it through, grab a free 15 minutes here: ${input.bookingUrl}`,
      ]
    : [];
  const bookingHtml = input.bookingUrl
    ? [
        `If you'd rather just talk it through, <a href="${escapeHtml(input.bookingUrl)}" style="color:${BRAND_BLUE};">grab a free 15 minutes</a>.`,
      ]
    : [];

  // One blank line between paragraphs — join("\n\n") already inserts it
  // between array items, so no item here should also carry its own "".
  const text = [
    greeting,
    openerText,
    ...resourceTextBlocks,
    ...bookingText,
    `${input.personaName}\nVendingpreneurs`,
  ].join("\n\n");

  const html = htmlEmailDocument([
    escapeHtml(greeting),
    escapeHtml(openerText),
    ...resourceHtmlBlocks,
    ...bookingHtml,
    `${escapeHtml(input.personaName)}<br>Vendingpreneurs`,
  ]);

  return { subject, text, html };
}

function generalOpener(
  resources: ChatbotResource[],
  profile: ProspectProfile | null,
): { subject: string; openerText: string } {
  const subject =
    resources.length === 1
      ? resources[0].title
      : `The ${resources.length} things we talked about`;

  // Fixed copy, deliberately. An earlier draft let the model write this
  // line; that turned a verified-domain sender with the sales inbox as
  // reply-to into 400 characters of attacker-steerable text. The resource
  // blurbs below already say what these are.
  const detail = personalDetail(profile);
  const openerText = detail
    ? `Following up on what you shared about ${lowerFirst(detail)}, here's what I promised. All free, nothing to sign up for.`
    : "Here's what I promised. All free, nothing to sign up for.";
  return { subject, openerText };
}

/**
 * Mia's voice, not a form response: the subject names what this is ("the
 * member story I mentioned"), never the story's own title. The connector
 * line reuses the exact "was {background} before starting a route" fragment
 * already validated in resources.ts's own blurb copy, rather than
 * re-deriving new phrasing that might not read naturally for every
 * background string in the case-study data.
 */
function caseStudyOpener(
  resource: ChatbotResource,
  profile: ProspectProfile | null,
): { subject: string; openerText: string } {
  const subject = "The member story I mentioned";
  const memberFirstName =
    firstNameFrom(caseStudyMemberName(resource)) ?? "They";
  const detail = personalDetail(profile);
  const background = priorBackgroundFrom(resource);
  const openerText =
    detail && background
      ? `You mentioned ${lowerFirst(detail)}. ${memberFirstName} was ${background} before starting a route too.`
      : "Here's the story I mentioned.";
  return { subject, openerText };
}

/**
 * One line referencing what the visitor already told the bot. Both source
 * fields are free-text model extractions, so this is built to read
 * naturally after "about ___" regardless of whether the value is a noun
 * phrase ("managing a retail store") or a gerund phrase ("wanting more
 * flexibility") — the two shapes the extraction prompt actually produces.
 * Returns null when nothing's been extracted yet, which is the common case:
 * extraction usually runs later, on idle.
 */
function personalDetail(profile: ProspectProfile | null): string | null {
  return profile?.current_work?.trim() || profile?.motivation?.trim() || null;
}

function soleCaseStudyResource(
  resources: ChatbotResource[],
): ChatbotResource | null {
  return resources.length === 1 &&
    resources[0].key.startsWith(CASE_STUDY_KEY_PREFIX)
    ? resources[0]
    : null;
}

/** Title is `{memberName}: {headlineResult}` (see resources.ts) — the part before the first ": ". */
function caseStudyMemberName(resource: ChatbotResource): string {
  const idx = resource.title.indexOf(": ");
  return idx === -1 ? resource.title : resource.title.slice(0, idx);
}

/** Pulls the background fragment back out of the blurb resources.ts already built ("Was {background} before starting a route."). */
function priorBackgroundFrom(resource: ChatbotResource): string | null {
  return (
    resource.blurb.match(/^Was (.+) before starting a route\.$/)?.[1] ?? null
  );
}

/** Real anchor text instead of a bare URL — required for every link in the HTML body. */
function anchorTextFor(resource: ChatbotResource): string {
  if (resource.key.startsWith(CASE_STUDY_KEY_PREFIX)) {
    const name = firstNameFrom(caseStudyMemberName(resource)) ?? "their";
    return `Read ${name}'s story`;
  }
  if (resource.key === "roadmap") return "Get the roadmap";
  if (resource.key === "finance_templates") return "Get the worksheet";
  if (resource.key === "case_studies") return "See the stories";
  return resource.title;
}

function firstNameFrom(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed.split(/\s+/)[0] : null;
}

function lowerFirst(value: string): string {
  return value.length ? value[0].toLowerCase() + value.slice(1) : value;
}

/**
 * Escapes text interpolated into the HTML body. Visitor name and profile
 * fields (current_work, motivation, ...) are ultimately visitor-influenced —
 * current_work/motivation are LLM extractions over the visitor's own chat
 * turns — so this is a trust-boundary requirement, not decoration.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Premium-simple, matching the light site: system font stack, ~560px max
 * width, generous whitespace, no images, no heavy button styling, no
 * emojis. `paragraphsHtml` entries are pre-escaped/pre-built inner HTML for
 * one `<p>` each.
 */
function htmlEmailDocument(paragraphsHtml: string[]): string {
  const body = paragraphsHtml
    .map((paragraph) => `<p style="margin:0 0 20px;">${paragraph}</p>`)
    .join("\n");
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
            <tr>
              <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;">
${body}
                <p style="margin:32px 0 0;font-size:12px;color:#8a8a8a;">Vendingpreneurs &middot; vendingpreneurs.com</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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

/** `{name or email}, {call intent? 'wants a call' : topic}`, shared by the subject line and each digest row. Comma, not an em dash — see sanitizeDashes below. */
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
  return `${name}, ${tail}`;
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

/**
 * No em/en dashes anywhere in a generated email, subjects included (brand
 * rule, 2026-08-24). Called once, from sendResend, so it covers every sender
 * without needing to be threaded through each one — including the parts
 * this file doesn't fully control, like extract-prospect-profile.ts's
 * LLM-written `summary`. A spaced dash reads as a clause break -> comma; an
 * unspaced one (a number range like "20–30") -> a plain hyphen. Title-style
 * "Name — Result" strings are fixed at the source (resources.ts's
 * caseStudyResource, leadLabel above) so they read as "Name: Result" /
 * "Name, tail" instead of falling through to this blunter fallback.
 */
export function sanitizeDashes(text: string): string {
  return text.replace(/\s[—–]\s/g, ", ").replace(/[—–]/g, "-");
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return "";
  }
}
