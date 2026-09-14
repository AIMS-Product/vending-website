/**
 * What kind of call a Calendly event is, from a reviewed mapping rather than a
 * regex.
 *
 * Three different regexes over `scheduled_event_name` were live in this repo at
 * once, and on the same 4,016 bookings they disagreed by 202 on the count of
 * "new calls":
 *
 *   spec §3 draft   2,254      booked-calls.ts 2,052      team-report.ts 2,102
 *
 * They split on `30 Minute Meeting` (144), `Route Planning Call` (32),
 * `New Meeting` (13), `One-off meeting` (6) and the two other `Minute Meeting`
 * variants. None of the three caught the other brands booking on our Calendly —
 * VendHub, Acquisition Ace, AI Operator Collective, a VendScout demo — all of
 * which were counted as new Vendingpreneurs sales calls.
 *
 * A regex over free text cannot be the foundation for a number a team is
 * managed against: it encodes a guess, it is invisible to the people who own
 * the calendars, and it moves silently when someone renames an event. So the
 * mapping is data, in `calendly-event-types.json`, reviewed by the people who
 * run the calendars, and versioned in git where a change to it is a diff.
 *
 * It fails closed. An event type nobody has classified is `reviewed: false` and
 * is counted as nothing at all — not quietly folded into "new". The metric it
 * feeds reports the shortfall instead of absorbing it.
 */

import mapping from "@/lib/services/calendly-event-types.json";

export type EventClass =
  /** A first sales call. The only class that counts as marketing pace. */
  | "new"
  /** A second or later call with someone already in conversation. */
  | "follow_up"
  /** An existing call moved to a new time. Not new demand. */
  | "reschedule"
  /** Post-sale onboarding. Not a sales call. */
  | "onboarding"
  /** Generic Calendly slots and ad-hoc internal meetings. */
  | "internal"
  /** A different brand booking on our Calendly. Not Vendingpreneurs demand. */
  | "other_brand";

export type EventTypeEntry = {
  name: string;
  class: EventClass;
  /** Null until a human who owns the calendars has signed it off. */
  reviewedBy: string | null;
  reviewedOn: string | null;
  note?: string;
  /** Bookings seen on this name when the mapping was generated. Context only. */
  observed: number;
  /**
   * Every Calendly event-type URI seen under this name. The URI is the stable
   * identity — it already absorbs the `Vendingprenuers` misspelling (42
   * bookings) under the same entry as the correct spelling. Names are how a
   * human reviews; URIs are how a booking is matched.
   */
  eventTypeUris: string[];
};

export type EventClassification =
  | {
      reviewed: true;
      class: EventClass;
      name: string;
      matchedBy: "uri" | "name";
    }
  | { reviewed: false; class: null; name: string | null; matchedBy: null };

const ENTRIES = mapping.entries as EventTypeEntry[];

/**
 * A URI usually pins one class, but a calendar can be renamed into a different
 * kind of call: `f6b52602` in production carries both `30 Minute Meeting` and
 * `VendHub | VendScout Demo`. Where the entries claiming a URI disagree on
 * class, the URI is genuinely ambiguous and is left out of this index so the
 * booking's own event name decides. A URI whose claimants agree — the
 * `Vendingprenuers` misspelling, the Minute Meeting variants — still resolves.
 */
const BY_URI = new Map<string, EventTypeEntry>();
{
  const claims = new Map<string, EventTypeEntry[]>();
  for (const entry of ENTRIES) {
    for (const uri of entry.eventTypeUris) {
      const list = claims.get(uri);
      if (list) list.push(entry);
      else claims.set(uri, [entry]);
    }
  }
  for (const [uri, entries] of claims) {
    const classes = new Set(entries.map((entry) => entry.class));
    if (classes.size === 1) BY_URI.set(uri, entries[0]);
  }
}

const BY_NAME = new Map<string, EventTypeEntry>();
for (const entry of ENTRIES) BY_NAME.set(normalizeName(entry.name), entry);

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Classify a booking. The event-type URI is tried first because it survives a
 * rename; the name is the fallback for the same calendar appearing under a new
 * URI, which happens whenever another host adds it (one name in production
 * spans 18 URIs). Anything else is unreviewed.
 */
export function classifyEventType(
  eventTypeUri: string | null | undefined,
  eventName: string | null | undefined,
): EventClassification {
  if (eventTypeUri) {
    const entry = BY_URI.get(eventTypeUri);
    if (entry) {
      return {
        reviewed: true,
        class: entry.class,
        name: entry.name,
        matchedBy: "uri",
      };
    }
  }
  const name = eventName?.trim();
  if (name) {
    const entry = BY_NAME.get(normalizeName(name));
    if (entry) {
      return {
        reviewed: true,
        class: entry.class,
        name: entry.name,
        matchedBy: "name",
      };
    }
  }
  return { reviewed: false, class: null, name: name ?? null, matchedBy: null };
}

export type MappingReviewState = {
  total: number;
  /** Entries a human has signed off. */
  reviewed: number;
  /** Entries still carrying a draft classification. */
  draft: number;
  /** Draft entries whose note asks for a specific decision. */
  needsDecision: EventTypeEntry[];
};

/**
 * How far along the human review is, for rendering next to any number the
 * mapping feeds. A team should be able to see that a metric rests on a draft.
 */
export function mappingReviewState(): MappingReviewState {
  const reviewed = ENTRIES.filter((entry) => entry.reviewedBy !== null);
  return {
    total: ENTRIES.length,
    reviewed: reviewed.length,
    draft: ENTRIES.length - reviewed.length,
    needsDecision: ENTRIES.filter((entry) => entry.note?.startsWith("CONFIRM")),
  };
}

export const EVENT_TYPE_ENTRIES: readonly EventTypeEntry[] = ENTRIES;
