import { classifyEventType } from "@/lib/services/calendly-event-class";

/**
 * Self-booked first calls: the number marketing owns outright.
 *
 * A person who put a first sales call on the calendar THEMSELVES, through one of
 * our surfaces: the live webinar or its replay links, a site form or embed, the
 * site chatbot, or the no-book follow-up email. Calls a setter or DM booked
 * (setter / pearl / dm links) are the sales floor's and are left out, however
 * the lead first arrived.
 *
 * Read from `calendly_bookings` (the live webhook), "new"-class event types only
 * (calendly-event-types.json), one count per person per window. Unreviewed event
 * types count as nothing, the same fail-closed rule every booked figure follows.
 *
 * ponytail: "first" means first in the window, not first ever. A person who
 * books, cancels and rebooks a week later counts in both weeks. Join against
 * Close's First Sales Call Booked Date if that ever matters.
 */

export type SelfBookedRow = {
  invitee_email: string | null;
  scheduled_event_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  lead_submission_id: string | null;
  raw_payload: unknown;
};

export const SURFACES = [
  "Webinar",
  "Site form",
  "Chatbot",
  "Follow-up email",
  "Other marketing link",
  "No tag",
] as const;

export type Surface = (typeof SURFACES)[number];

/** Links a setter or DM hands a lead. Their bookings belong to sales. */
const SETTER_MEDIUMS = new Set(["setter", "pearl", "dm"]);

function eventTypeUri(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = (raw as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") return null;
  const event = (payload as { scheduled_event?: unknown }).scheduled_event;
  if (!event || typeof event !== "object") return null;
  const uri = (event as { event_type?: unknown }).event_type;
  return typeof uri === "string" ? uri : null;
}

const clean = (value: string | null) => {
  const v = value?.trim().toLowerCase() ?? "";
  return /^_+$/.test(v) ? "" : v;
};

/** Which surface produced a self-booking, or null when it is not one. */
export function surfaceOf(row: SelfBookedRow): Surface | null {
  const c = classifyEventType(
    eventTypeUri(row.raw_payload),
    row.scheduled_event_name,
  );
  if (!c.reviewed || c.class !== "new") return null;

  const source = clean(row.utm_source);
  const medium = clean(row.utm_medium);
  if (SETTER_MEDIUMS.has(medium)) return null;

  if (clean(row.utm_content).startsWith("nbf-")) return "Follow-up email";
  if (source === "chatbot") return "Chatbot";
  if (source === "internal-webinar") return "Webinar";
  if (row.lead_submission_id) return "Site form";
  if (source) return "Other marketing link";
  return "No tag";
}

export type SelfBookedBreakdown = {
  total: number;
  bySurface: Record<Surface, number>;
};

/** One count per person: their first self-booking in `rows` (oldest first) decides the surface. */
export function selfBookedBreakdown(
  rows: readonly SelfBookedRow[],
): SelfBookedBreakdown {
  const bySurface = Object.fromEntries(SURFACES.map((s) => [s, 0])) as Record<
    Surface,
    number
  >;
  const seen = new Set<string>();
  for (const row of rows) {
    const email = row.invitee_email?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    const surface = surfaceOf(row);
    if (!surface) continue;
    seen.add(email);
    bySurface[surface] += 1;
  }
  return { total: seen.size, bySurface };
}

/**
 * Warm assists: a Reactivation Scrapers call or win whose person marketing
 * touched BEFORE the call was booked. The sales floor keeps the credit; this is
 * printed beside it so the touch that started it is on the record (Jess and
 * Adam, 2026-10-26).
 *
 * Close's own "Entry Source" (how the lead first entered Close) always predates
 * the call. A site form or chatbot chat counts only when it happened on or
 * before the booked day.
 */
export type AssistTouch = "Webinar" | "Lead magnet" | "Site form" | "Chatbot";

export const ASSIST_TOUCHES: readonly AssistTouch[] = [
  "Webinar",
  "Lead magnet",
  "Site form",
  "Chatbot",
];

const ENTRY_SOURCE_TOUCH: Record<string, AssistTouch> = {
  Webinar: "Webinar",
  "Lead-Magnet": "Lead magnet",
  Typeform: "Site form",
  "Website-Apply": "Site form",
};

export function assistTouch(input: {
  entrySource: string | null;
  /** YYYY-MM-DD: the first sales call's booked day, or the won day when unknown. */
  bookedDay: string;
  formDays: readonly string[];
  chatDays: readonly string[];
}): AssistTouch | null {
  const fromEntry = input.entrySource
    ? ENTRY_SOURCE_TOUCH[input.entrySource]
    : undefined;
  if (fromEntry) return fromEntry;
  if (input.formDays.some((d) => d <= input.bookedDay)) return "Site form";
  if (input.chatDays.some((d) => d <= input.bookedDay)) return "Chatbot";
  return null;
}
