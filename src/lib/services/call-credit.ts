/**
 * Who set each booked call — the one answer, and the evidence for it.
 *
 * Every booking gets exactly one credit, taken from the strongest evidence
 * available, and the evidence travels with the answer so a disagreement is
 * settled by reading the row instead of arguing about it.
 *
 * 1. `rep` — Calendly's own `invitee_scheduled_by`. When a rep books a call on
 *    a lead's behalf, Calendly records who did it. This is a fact from
 *    Calendly, not an inference from activity near the booking, and it needs
 *    nobody to remember to fill a field in.
 * 2. `chatbot` — the booking link carried the chat's own utm.
 * 3. `channel` — the booking link carried some other tag (youtube, a webinar,
 *    a paid campaign). The lead booked themselves off that link.
 * 4. Close's setter field, when a human filled it in.
 * 5. The last setter to call or text them before they booked — inferred from
 *    Close activity, shown with the gap, never stated as a record.
 * 6. `untagged` — an untagged link, self-served. Most often a rep who texted a
 *    raw Calendly link instead of booking it themselves. Nothing on the
 *    booking says who sent it, so this says exactly that rather than guessing.
 *
 * Deliberately NOT evidence: the Calendly host (a round robin picks a closer,
 * not the person who set the call) and Close activity near the booking time
 * (the same names appear as both setters and closers, so a call or SMS before
 * a booking cannot tell them apart).
 */

import { describeTouchGap } from "@/lib/close/setter-touch";

/** Kinds ordered by strength of evidence, strongest first. */
export type CallCreditKind = "rep" | "chatbot" | "channel" | "untagged";

/** Where a `rep` answer came from: a record, a link tag, or an inference. */
export type CallCreditBasis = "calendly" | "tag" | "close" | "touch";

export type CallCredit = {
  kind: CallCreditKind;
  /** Set on `rep` answers only, so a leaderboard can split recorded / tagged / inferred. */
  basis?: CallCreditBasis;
  /** Display name: "Connor George", "Website chatbot", "YouTube", "No tag". */
  who: string;
  /** One line naming the evidence, shown next to the answer in the UI. */
  evidence: string;
  /** Calendly user URI, when a person booked it. */
  repUri: string | null;
};

export type CallCreditInput = {
  /** `invitee_scheduled_by` — Calendly's record of the rep who booked it. */
  scheduledByUri: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  /** Carries the setter's slug on a `utm_source=setter` link. */
  utmContent?: string | null;
  /** Close's "Reactivation - Setter Name", mirrored onto the lead. */
  closeSetter?: string | null;
  /** The setter whose call or SMS in Close came last before the booking. */
  setterTouch?: { name: string; minutesBefore: number } | null;
};

/** Calendly user URI -> what we know about that person. */
export type CalendlyDirectory = Map<string, { name: string; email?: string }>;

/** The utm the chat's own calendar link carries (lib/chatbot/booking.ts). */
const CHATBOT_UTM_SOURCE = "chatbot";

/**
 * The utm a setter's own booking link carries:
 * `?utm_source=setter&utm_content=connor-george`.
 *
 * This is how a setter who TEXTS a link gets the same named credit as one who
 * books the call themselves in Calendly. Without it, a lead self-booking off a
 * link a setter sent is indistinguishable from any other untagged booking, and
 * that pile is most of the disputes.
 */
const SETTER_UTM_SOURCE = "setter";

export function resolveCallCredit(
  input: CallCreditInput,
  directory: CalendlyDirectory,
): CallCredit {
  const uri = input.scheduledByUri?.trim() || null;
  if (uri) {
    const known = directory.get(uri);
    return {
      kind: "rep",
      basis: "calendly",
      who: known?.name ?? unknownRepLabel(uri),
      evidence: "Calendly recorded this person as the one who booked the call.",
      repUri: uri,
    };
  }

  const source = input.utmSource?.trim() || null;
  const taggedSetter =
    source?.toLowerCase() === SETTER_UTM_SOURCE
      ? nameFromTag(input.utmContent)
      : null;
  if (source?.toLowerCase() === SETTER_UTM_SOURCE) {
    // A setter link whose tag does not read as a name is worth nothing: naming
    // the person is the entire job. Fall through to "no tag" and say why,
    // rather than crediting a channel literally called "Setter".
    return taggedSetter
      ? {
          kind: "rep",
          basis: "tag",
          who: taggedSetter,
          evidence: "Booked from this person's own tagged booking link.",
          repUri: null,
        }
      : {
          kind: "untagged",
          who: "No tag",
          evidence:
            "Booked from a setter link, but its tag does not name anyone, so there is nothing to credit.",
          repUri: null,
        };
  }
  if (source && source.toLowerCase() === CHATBOT_UTM_SOURCE) {
    return {
      kind: "chatbot",
      who: "Website chatbot",
      evidence:
        "Booked from the calendar inside the chat, tagged as the chat's.",
      repUri: null,
    };
  }
  if (source) {
    const medium = input.utmMedium?.trim();
    return {
      kind: "channel",
      who: humanizeSource(source),
      evidence: medium
        ? `Self-booked from a link tagged ${source} / ${medium}.`
        : `Self-booked from a link tagged ${source}.`,
      repUri: null,
    };
  }

  // Last, and last on purpose: a tag on the link is direct evidence of how the
  // booking was made, while Close's setter field is a note a human typed
  // afterwards. It still beats knowing nothing.
  const closeSetter = input.closeSetter?.trim();
  if (closeSetter) {
    return {
      kind: "rep",
      basis: "close",
      who: closeSetter,
      evidence: "Recorded in Close as the setter who booked this call.",
      repUri: null,
    };
  }

  // Weakest, and the only inferred answer on the page: the lead booked
  // themselves off a link nothing tagged, and this setter is the last one who
  // called or texted them before they did. Shown with the gap so it reads as
  // the argument it is, not as a record.
  const touch = input.setterTouch;
  if (touch?.name) {
    return {
      kind: "rep",
      basis: "touch",
      who: touch.name,
      evidence: `Called or texted them ${describeTouchGap(touch.minutesBefore)} (from Close activity, not a record of the booking).`,
      repUri: null,
    };
  }

  return {
    kind: "untagged",
    who: "No tag",
    evidence:
      "Self-booked from an untagged link, and Calendly has no record of anyone booking it. Nothing here says who sent the link.",
    repUri: null,
  };
}

/**
 * A Calendly user we have never seen host a call, so no name has reached us.
 * Shown as an id rather than silently dropped: the count is still real, and an
 * unnamed row is a prompt to name them, not a reason to hide the booking.
 */
function unknownRepLabel(uri: string): string {
  return `Calendly user ${uri.split("/").pop()?.slice(0, 8) ?? "unknown"}`;
}

/**
 * `connor-george` -> `Connor George`. Returns null for anything that is not a
 * plausible name tag, so a stray or machine-generated utm_content cannot invent
 * a person: an unreadable tag falls through to the untagged answer.
 */
function nameFromTag(tag: string | null | undefined): string | null {
  const cleaned = tag?.trim().toLowerCase() ?? "";
  if (!/^[a-z][a-z-]{1,40}$/.test(cleaned)) return null;
  return cleaned
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** `internal-webinar` -> `Internal webinar`, `youtube` -> `Youtube`. */
function humanizeSource(source: string): string {
  const words = source.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Reps who book calls for others but have never hosted one, so no booking
 * payload carries their name. Resolved once through Calendly's users API
 * (2026-09-14, `/api/admin/calendly-backfill/run?users=`). Four more scheduling
 * ids answered 403: they sit in another Calendly organization and stay as ids.
 */
const KNOWN_CALENDLY_USERS: ReadonlyArray<
  [string, { name: string; email?: string }]
> = [
  [
    "https://api.calendly.com/users/6d68f528-ae85-4839-8744-2b2a2143a235",
    { name: "August Young", email: "august@modern-amenities.com" },
  ],
  [
    "https://api.calendly.com/users/b45484dd-3d04-4f2f-8c9d-ee603b503752",
    { name: "Naria Torres", email: "naria@modern-amenities.com" },
  ],
  [
    "https://api.calendly.com/users/b3f10a66-4ad7-4a55-bb9c-522b1b00f51c",
    { name: "Jessica Zatkin", email: "jessica@modern-amenities.com" },
  ],
  [
    "https://api.calendly.com/users/01f8b310-d3dc-4bcb-84b2-f63effca4759",
    { name: "Cassie Caraballo", email: "cassie@modern-amenities.com" },
  ],
  [
    "https://api.calendly.com/users/abaed0e6-5190-4f44-9c56-185fdbb04f30",
    { name: "Spencer Reynolds", email: "spencer@modern-amenities.com" },
  ],
  [
    "https://api.calendly.com/users/fc6d02f1-6f4e-4d00-a43d-16667fe49966",
    { name: "Pearl Sathekge", email: "pearl@modern-amenities.com" },
  ],
  [
    "https://api.calendly.com/users/c8118911-6a06-4f3f-8a8c-3d3c397012f6",
    { name: "Stephen Olivas", email: "stephen@modern-amenities.com" },
  ],
];

/**
 * Builds the Calendly user directory from the hosts already named on the
 * bookings themselves (`event_memberships`), so naming a rep costs no API call.
 *
 * ponytail: a rep who books calls but has never hosted one stays unnamed until
 * someone adds them. Resolve those through the Calendly users API if the
 * unnamed rows ever matter more than the names we get free.
 */
export function buildCalendlyDirectory(
  rows: Array<{ hosts?: unknown }>,
): CalendlyDirectory {
  const directory: CalendlyDirectory = new Map(KNOWN_CALENDLY_USERS);
  for (const row of rows) {
    if (!Array.isArray(row.hosts)) continue;
    for (const host of row.hosts) {
      if (!host || typeof host !== "object") continue;
      const {
        user,
        user_name: name,
        user_email: email,
      } = host as Record<string, unknown>;
      if (typeof user !== "string" || typeof name !== "string") continue;
      if (directory.has(user)) continue;
      directory.set(user, {
        name,
        email: typeof email === "string" ? email : undefined,
      });
    }
  }
  return directory;
}

/**
 * Who on the team sets calls, from Adam 2026-09-12: everyone in the sales Slack
 * except the people below. Anyone booking calls who is in neither list shows as
 * unclassified rather than being guessed into a role — mislabelling a closer as
 * a setter is how the argument this page exists to end got started.
 */
const NOT_SETTERS = new Set([
  "adam wolfe",
  "anthony",
  "dom ellis",
  "eric",
  "glenda castro",
  "jess",
  "joe dysert",
  "kody wirth",
  "mike hoffmann",
  "stephen olivas",
]);

/** The people who set calls, as their name reads in Calendly and Close. */
export const SETTER_NAMES = [
  "Ariella",
  "August Young",
  "Beatrice Braescu Cojocaru",
  "Cassie Caraballo",
  "Charlie Ingram",
  "Connor George",
  "Jessica Zatkin",
  "Josh Stoffel",
  "Kelly Schrader",
  "Melia King",
  "Naria Torres",
  "Pearl Sathekge",
  "Spencer Reynolds",
  "Vince Bartolini",
] as const;

const SETTERS = new Set([
  ...SETTER_NAMES.map((name) => name.toLowerCase()),
  // Calendly shows her first name only; Close carries the full one.
  "pearl",
]);

export type RepRole = "setter" | "not_setter" | "unclassified";

export function repRole(name: string): RepRole {
  const key = name.trim().toLowerCase();
  if (SETTERS.has(key)) return "setter";
  if (NOT_SETTERS.has(key)) return "not_setter";
  return "unclassified";
}

export type CallCreditRow = {
  id: string;
  inviteeName: string | null;
  inviteeEmail: string | null;
  calendar: string | null;
  /** When the call itself is (or was). */
  startAt: string | null;
  /** When it was booked. */
  bookedAt: string | null;
  canceled: boolean;
  credit: CallCredit;
  /** The chat this person had before the call, when there was one. */
  chat: ChatTouch | null;
  /** The lead row this booking belongs to, when one matched. */
  leadSubmissionId: string | null;
  /** Close's setter name on that lead, kept for reporting that needs it raw. */
  closeSetter: string | null;
};

export type CallCreditPerson = {
  who: string;
  role: RepRole;
  calls: number;
};

export type CallCreditSummary = {
  total: number;
  byKind: Record<CallCreditKind, number>;
  people: CallCreditPerson[];
  /** Reps booking calls who are in neither roster list. */
  unclassified: string[];
  /** Calls where the person had chatted with the bot beforehand. */
  chatTouched: number;
};

export function summarizeCallCredits(rows: CallCreditRow[]): CallCreditSummary {
  const byKind: Record<CallCreditKind, number> = {
    rep: 0,
    chatbot: 0,
    channel: 0,
    untagged: 0,
  };
  const people = new Map<string, CallCreditPerson>();

  for (const row of rows) {
    byKind[row.credit.kind] += 1;
    if (row.credit.kind !== "rep") continue;
    const existing = people.get(row.credit.who);
    if (existing) {
      existing.calls += 1;
      continue;
    }
    people.set(row.credit.who, {
      who: row.credit.who,
      role: repRole(row.credit.who),
      calls: 1,
    });
  }

  const sorted = [...people.values()].sort(
    (a, b) => b.calls - a.calls || a.who.localeCompare(b.who),
  );

  return {
    total: rows.length,
    byKind,
    people: sorted,
    unclassified: sorted
      .filter((person) => person.role === "unclassified")
      .map((person) => person.who),
    chatTouched: rows.filter((row) => row.chat !== null).length,
  };
}

/**
 * A chat this person had before the call was booked.
 *
 * Separate from the credit on purpose: the chat is an earlier touch, and
 * showing it next to the last touch is what keeps "the bot talked to them" and
 * "somebody set the call" from being argued as the same claim.
 */
export type ChatTouch = {
  conversationId: string;
  chattedAt: string;
  /** The booking carried this conversation's own tag, so the chat booked it. */
  bookedInChat: boolean;
};

export type ChatConversationRow = {
  id: string;
  capturedEmail: string | null;
  createdAt: string;
};

/** Lowercased email -> that person's chats, newest first. */
export type ChatIndex = Map<string, ChatConversationRow[]>;

export function buildChatIndex(rows: ChatConversationRow[]): ChatIndex {
  const index: ChatIndex = new Map();
  for (const row of rows) {
    const email = row.capturedEmail?.trim().toLowerCase();
    if (!email) continue;
    const existing = index.get(email);
    if (existing) existing.push(row);
    else index.set(email, [row]);
  }
  for (const list of index.values()) {
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return index;
}

/**
 * The chat that came before this booking, if there was one.
 *
 * Matched on the address the visitor gave the bot, and only chats that STARTED
 * before the call was booked: a chat that happened afterwards is a different
 * conversation, not the touch that led to the call.
 */
export function resolveChatTouch(
  booking: {
    inviteeEmail: string | null;
    bookedAt: string | null;
    utmContent?: string | null;
  },
  index: ChatIndex,
): ChatTouch | null {
  const email = booking.inviteeEmail?.trim().toLowerCase();
  if (!email) return null;
  const candidates = index.get(email);
  if (!candidates?.length) return null;

  const bookedAtMs = booking.bookedAt ? Date.parse(booking.bookedAt) : NaN;
  const match = candidates.find((conversation) => {
    if (!Number.isFinite(bookedAtMs)) return true;
    return Date.parse(conversation.createdAt) <= bookedAtMs;
  });
  if (!match) return null;

  return {
    conversationId: match.id,
    chattedAt: match.createdAt,
    bookedInChat: booking.utmContent?.trim() === match.id,
  };
}

/**
 * A setter's own booking link.
 *
 * The whole point is that the tag survives the round trip: Calendly echoes
 * utm_source and utm_content back on the booking webhook, `resolveCallCredit`
 * reads them, and the call lands under the setter's name the same as one they
 * booked by hand. `setterTag` and `nameFromTag` are inverses — the test holds
 * them to it, because a tag that does not read back as a name credits nobody.
 */
export function setterTag(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

export function setterBookingUrl(calendarUrl: string, name: string): string {
  const url = new URL(calendarUrl);
  url.searchParams.set("utm_source", "setter");
  url.searchParams.set("utm_medium", "text");
  url.searchParams.set("utm_content", setterTag(name));
  return url.toString();
}
