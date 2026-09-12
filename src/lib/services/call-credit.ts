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
 * 4. `untagged` — an untagged link, self-served. Most often a rep who texted a
 *    raw Calendly link instead of booking it themselves. Nothing on the
 *    booking says who sent it, so this says exactly that rather than guessing.
 *
 * Deliberately NOT evidence: the Calendly host (a round robin picks a closer,
 * not the person who set the call) and Close activity near the booking time
 * (the same names appear as both setters and closers, so a call or SMS before
 * a booking cannot tell them apart).
 */

/** Kinds ordered by strength of evidence, strongest first. */
export type CallCreditKind = "rep" | "chatbot" | "channel" | "untagged";

export type CallCredit = {
  kind: CallCreditKind;
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
};

/** Calendly user URI -> what we know about that person. */
export type CalendlyDirectory = Map<string, { name: string; email?: string }>;

/** The utm the chat's own calendar link carries (lib/chatbot/booking.ts). */
const CHATBOT_UTM_SOURCE = "chatbot";

export function resolveCallCredit(
  input: CallCreditInput,
  directory: CalendlyDirectory,
): CallCredit {
  const uri = input.scheduledByUri?.trim() || null;
  if (uri) {
    const known = directory.get(uri);
    return {
      kind: "rep",
      who: known?.name ?? unknownRepLabel(uri),
      evidence: "Calendly recorded this person as the one who booked the call.",
      repUri: uri,
    };
  }

  const source = input.utmSource?.trim() || null;
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

/** `internal-webinar` -> `Internal webinar`, `youtube` -> `Youtube`. */
function humanizeSource(source: string): string {
  const words = source.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

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
  const directory: CalendlyDirectory = new Map();
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

const SETTERS = new Set([
  "ariella",
  "august young",
  "beatrice braescu cojocaru",
  "cassie caraballo",
  "charlie ingram",
  "connor george",
  "jessica zatkin",
  "josh stoffel",
  "kelly schrader",
  "melia king",
  "naria torres",
  "pearl",
  "pearl sathekge",
  "spencer reynolds",
  "vince bartolini",
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
  };
}
