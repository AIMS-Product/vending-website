import { createHmac, timingSafeEqual } from "node:crypto";
import { buildCalendlyBookingUrl } from "@/lib/content/lead-embed";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { THANK_YOU_LINKS } from "@/lib/qualification/thank-you-links";
import type { Json, Tables } from "@/types/database";

/**
 * Pure half of the lead-facing no-book follow-up (no-book-followup.ts runs it).
 *
 * A site lead who filled the form and did not book gets up to three emails from
 * us, each with a one-tap link to the calendar the site would have shown them.
 * Marketing owns the booking instead of handing every unbooked lead to a setter.
 *
 * Timing is measured from when the lead came in, and every step has a closing
 * edge so the first run after deploy (or after an outage) never mails the back
 * catalogue: a lead who missed a window simply skips that step.
 */

type LeadRow = Tables<"lead_submissions">;

export type FollowupStep = 1 | 2 | 3;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** [opens, closes] after the lead's created_at. Step 1 matches the Slack no-book alert's 15 minutes. */
export const STEP_WINDOWS: Record<FollowupStep, readonly [number, number]> = {
  1: [15 * MINUTE, 6 * HOUR],
  2: [24 * HOUR, 48 * HOUR],
  3: [72 * HOUR, 96 * HOUR],
};

export const STEPS: readonly FollowupStep[] = [1, 2, 3];

export const stepKey = (step: FollowupStep) => `nbf_step${step}_at`;
export const UNSUBSCRIBED_KEY = "nbf_unsubscribed_at";

/** The utm_content our links carry, so a booking from this email can be counted. */
export const followupUtmContent = (step: FollowupStep) => `nbf-step${step}`;

function metadataOf(row: Pick<LeadRow, "metadata">): Record<string, Json> {
  const m = row.metadata;
  return m && typeof m === "object" && !Array.isArray(m)
    ? (m as Record<string, Json>)
    : {};
}

function summaryString(
  row: Pick<LeadRow, "qualification_summary">,
  key: string,
): string | null {
  const s = row.qualification_summary;
  if (!s || typeof s !== "object" || Array.isArray(s)) return null;
  const value = (s as Record<string, Json>)[key];
  return typeof value === "string" ? value : null;
}

/** Explicit "no" to contact. Unanswered (booking pages never ask) is not a no. */
function declinedContact(row: Pick<LeadRow, "qualification_summary">): boolean {
  const s = row.qualification_summary;
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  return (s as Record<string, Json>).consent === false;
}

/**
 * Why a person (every lead row sharing one email) gets no email at this step,
 * or null when they should get it. `history` is all of their rows, not just the
 * one in the window: a second form fill must not restart the sequence, and a
 * booking or unsubscribe recorded on any row stops it.
 */
export function skipReason(
  lead: LeadRow,
  history: LeadRow[],
  step: FollowupStep,
): string | null {
  if (!lead.email?.trim()) return "no_email";
  if (history.some((r) => r.call_booked_at)) return "booked";
  if (history.some((r) => metadataOf(r)[UNSUBSCRIBED_KEY]))
    return "unsubscribed";
  if (history.some(declinedContact)) return "declined_contact";
  if (summaryString(lead, "qualification_band") === "disqualify") {
    return "disqualified";
  }
  if (history.some((r) => metadataOf(r)[stepKey(step)])) return "already_sent";
  if (step > 1) {
    const prev = stepKey((step - 1) as FollowupStep);
    if (!history.some((r) => metadataOf(r)[prev]))
      return "previous_step_missing";
  }
  return null;
}

/**
 * The calendar the site would have offered this lead (thank-you-links.ts).
 * Unscored leads mostly came through the booking pages, which book Lane 1.
 */
export function calendarFor(
  lead: Pick<LeadRow, "qualification_summary">,
): string {
  switch (summaryString(lead, "qualification_thank_you_state")) {
    case "perfect_fit":
      return THANK_YOU_LINKS.lane1TopCalendlyUrl;
    case "good_potential":
    case "not_right_time":
      return THANK_YOU_LINKS.setterCalendlyUrl;
    default:
      return THANK_YOU_LINKS.lane1CalendlyUrl;
  }
}

/**
 * Prefilled booking link. Keeps the lead's own source/medium/campaign so the
 * call is still credited to the channel that brought them; only utm_content
 * changes, to mark that this email produced the booking.
 */
export function bookingLink(lead: LeadRow, step: FollowupStep): string {
  const attribution = {
    utm_source: lead.utm_source ?? "",
    utm_medium: lead.utm_medium ?? "",
    utm_campaign: lead.utm_campaign ?? "",
    utm_content: followupUtmContent(step),
  } as unknown as LeadAttribution;
  return buildCalendlyBookingUrl(calendarFor(lead), {
    name: lead.full_name,
    email: lead.email,
    attribution,
  });
}

// ponytail: unsubscribe tokens are an HMAC of the address under CRON_SECRET
// (domain-separated by the "nbf-unsub:" prefix) rather than a dedicated key.
// Rotating CRON_SECRET invalidates links already sent; give it its own env var
// if that ever matters.
export function unsubscribeToken(email: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`nbf-unsub:${email.trim().toLowerCase()}`)
    .digest("base64url");
}

export function verifyUnsubscribeToken(
  email: string,
  token: string,
  secret: string,
): boolean {
  const expected = Buffer.from(unsubscribeToken(email, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(siteUrl: string, email: string, secret: string) {
  const url = new URL("/api/email/unsubscribe", siteUrl);
  url.searchParams.set("e", email.trim().toLowerCase());
  url.searchParams.set("t", unsubscribeToken(email, secret));
  return url.toString();
}

export type FollowupEmail = { subject: string; text: string; html: string };

const WINS_URL = "https://wins.vendingpreneurs.com";

function firstName(lead: LeadRow): string {
  const first = lead.full_name?.trim().split(/\s+/)[0] ?? "";
  return /^[\p{L}'-]{1,30}$/u.test(first) ? first : "there";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * The three emails. No income, count or timeframe claims (the same rule the ads
 * follow), no em dashes, no emojis. Plain and short: these read like a person
 * following up, not a newsletter.
 */
export function buildFollowupEmail(
  lead: LeadRow,
  step: FollowupStep,
  links: { booking: string; unsubscribe: string; mailingAddress: string },
): FollowupEmail {
  const name = firstName(lead);
  const copy = {
    1: {
      subject: `${name === "there" ? "Your" : `${name}, your`} vending call is not booked yet`,
      body: [
        `Hi ${name},`,
        "You asked about starting a vending business but did not pick a time for your call. It takes about 30 seconds.",
        "On the call an advisor looks at your area, your budget and your timeline, and maps out what your first machines could look like. No cost and no obligation.",
      ],
      cta: "Pick a time",
    },
    2: {
      subject: "Still thinking about vending?",
      body: [
        `Hi ${name},`,
        "Quick follow-up. Members of our community post new locations and first machines every week, and most of them started exactly where you are now: curious, with questions.",
        `You can read their posts here: ${WINS_URL}`,
        "If you want to talk through your own plan, grab a time below.",
      ],
      cta: "Book my call",
    },
    3: {
      subject: "Should we close your request?",
      body: [
        `Hi ${name},`,
        "We have not seen a time come through, so this is the last note from us about your request.",
        "If you still want help working out whether vending fits you, the calendar is below. If now is not the right time, no problem at all.",
      ],
      cta: "Pick a time",
    },
  }[step];

  const footer = [
    "Vendingpreneurs",
    links.mailingAddress,
    `Unsubscribe: ${links.unsubscribe}`,
  ];
  const text = [
    ...copy.body,
    `${copy.cta}: ${links.booking}`,
    footer.join("\n"),
  ].join("\n\n");

  const paragraphs = copy.body
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`)
    .join("");
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a;max-width:560px">` +
    paragraphs +
    `<p style="margin:24px 0"><a href="${escapeHtml(links.booking)}" style="background:#1a56db;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(copy.cta)}</a></p>` +
    `<p style="margin:32px 0 0;font-size:12px;color:#6b7280">Vendingpreneurs<br>${escapeHtml(links.mailingAddress)}<br><a href="${escapeHtml(links.unsubscribe)}" style="color:#6b7280">Unsubscribe</a></p>` +
    `</div>`;

  return { subject: copy.subject, text, html };
}
