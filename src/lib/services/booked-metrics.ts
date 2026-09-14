/**
 * What "booked" means. One definition per number, and no number without one.
 *
 * On 2026-09-14 the question "how many calls were booked today" had seven
 * defensible answers in this codebase — 24, 34, 35, 12, 2, 37 — and none of
 * them carried a label. Three different ones were given to the same person in
 * one session. The problem was never missing data; it was that "booked" named
 * six different populations on three different date bases and nobody had to
 * say which.
 *
 * So: every metric below is a `BookedMetric` with a plain-English definition,
 * and `readBookedMetric` returns the value *attached to* that definition.
 * Rendering a bare number is not possible through this module, which is the
 * point. See `.claude/specs/2026-09-14-booked-call-attribution-truth.md`.
 *
 * Two traps this module exists to close:
 *
 *   - `calendly_bookings.created_at` is OUR row-insert time. A backfill made it
 *     report 1,899 bookings "created today". Calendly's own booked-at lives at
 *     `raw_payload -> payload -> created_at`. Only that one dates a booking.
 *   - `close_lead_funnel.first_sales_call_booked_date` is the day the call is
 *     SCHEDULED FOR, not the day it was booked. It answers "who are the closers
 *     talking to today", never "what did marketing produce today".
 */

import {
  classifyEventType,
  type EventClass,
  type EventClassification,
} from "@/lib/services/calendly-event-class";
import { channelKeyForFunnel } from "@/lib/services/channel-targets";

/**
 * The business day boundary. Bookings are timestamped in UTC, and the UTC day
 * ends at 8pm Eastern, so an evening booking lands on tomorrow's UTC date. The
 * spec's headline "35 booked today" was a UTC count; the same day in Eastern is
 * 33. Reporting to a US team means the business timezone decides the day.
 */
export const REPORTING_TIME_ZONE = "America/New_York";

/**
 * Jess's goal: book 25 new calls a day. It counts `newBookedOn` (D) only.
 *
 * This does NOT reconcile with the 800 a month in `channel-targets.ts`, and no
 * arithmetic should be drawn between them. That plan counts `firstCallsOnCalendar`
 * (A): Close first sales calls, deduplicated per lead, dated by the day the call
 * is SCHEDULED FOR. This goal counts Calendly bookings, not deduplicated, dated
 * by the day they were MADE, with Lane 2 removed. Different populations on
 * different date bases — 25 x 22 workdays = 550 against 800 is not a gap, it is
 * two unrelated measurements. Both are shown, each against its own target.
 */
export const DAILY_NEW_CALL_GOAL = 25;

/**
 * The call-capacity dashboard's per-day goal, on the lands-on basis. Quoted from
 * that dashboard, not derived here — it governs how full a day's calendar should
 * be, not how much marketing booked.
 */
export const DAILY_CAPACITY_GOAL = 42;

/** Whether a metric counts bookings by when they were made or when they land. */
export type MetricBasis = "booked-on" | "lands-on";

export type BookedMetric = {
  key: MetricKey;
  /** What a human should see next to the value. Never the word "booked" alone. */
  label: string;
  /** One sentence a marketing lead can act on without asking a follow-up. */
  definition: string;
  /** The exact field this is counted from, for whoever has to verify it. */
  source: string;
  basis: MetricBasis;
  /** Which call types roll in. Spelled out because this is what moves the number. */
  includes: string;
};

export type MetricKey =
  | "newBookedOn"
  | "allBookedOn"
  | "followUpBookedOn"
  | "rescheduleBookedOn"
  | "firstCallsOnCalendar"
  | "allMeetingsOnCalendar"
  | "bookedTodayLandingToday"
  | "capacityTotalMeetingsBooked";

/**
 * The metrics, lettered as the spec's table A-G so a conversation about "the
 * 35" can be traced to a key. `newBookedOn` (D) is the marketing pace number
 * and `firstCallsOnCalendar` (A) is the capacity number; the rest exist so that
 * a number someone quotes from another dashboard can be named rather than
 * argued with.
 */
export const BOOKED_METRICS: Record<MetricKey, BookedMetric> = {
  // D — the pace number. Jess's "book 25 calls a day".
  newBookedOn: {
    key: "newBookedOn",
    label: "New calls booked",
    definition:
      "First sales calls that marketing sourced and someone scheduled on this day, whatever day the call itself lands on. Excludes follow-ups, reschedules, post-sale onboarding, internal meetings, other brands, and Lane 2 outbound.",
    source:
      "calendly_bookings, Calendly's own booked-at (raw_payload -> payload -> created_at), classified against the reviewed event-type mapping, Lane 2 removed by Close funnel",
    basis: "booked-on",
    includes: "New business calls only. Cancellations included.",
  },
  // C — the headline that flatters. Kept so nobody re-derives it by accident.
  allBookedOn: {
    key: "allBookedOn",
    label: "All bookings made",
    definition:
      "Every Calendly booking created on this day, of any type on any calendar — new calls, follow-ups, reschedules, onboarding and internal meetings together.",
    source: "calendly_bookings, raw_payload -> payload -> created_at",
    basis: "booked-on",
    includes: "Every call type. Cancellations included.",
  },
  // E
  followUpBookedOn: {
    key: "followUpBookedOn",
    label: "Follow-ups booked",
    definition:
      "Second and later calls with someone already in conversation, scheduled on this day.",
    source:
      "calendly_bookings booked-at, event types classified follow_up in the reviewed mapping",
    basis: "booked-on",
    includes: "Follow-up calls only. Cancellations included.",
  },
  rescheduleBookedOn: {
    key: "rescheduleBookedOn",
    label: "Reschedules booked",
    definition:
      "Calls moved to a new time on this day. Not new demand — the call already existed.",
    source:
      "calendly_bookings booked-at, event types classified reschedule in the reviewed mapping",
    basis: "booked-on",
    includes: "Rescheduled calls only. Cancellations included.",
  },
  // A — the capacity number, and the basis the 800/month plan is counted on.
  firstCallsOnCalendar: {
    key: "firstCallsOnCalendar",
    label: "First calls on the calendar",
    definition:
      "First sales calls sitting on this day's calendar, whenever they were booked. This is who the closers are talking to today, not what marketing produced today.",
    source:
      "close_lead_funnel.first_sales_call_booked_date (the SCHEDULED date)",
    basis: "lands-on",
    includes:
      "First call per lead, deduplicated. Cancellations included. Follow-ups excluded.",
  },
  // B
  allMeetingsOnCalendar: {
    key: "allMeetingsOnCalendar",
    label: "All meetings on the calendar",
    definition:
      "Every live meeting on this day's calendar, of any type, whenever it was booked.",
    source: "calendly_bookings.event_start_at, cancelled meetings removed",
    basis: "lands-on",
    includes:
      "Every call type. Cancellations excluded — a cancelled meeting is not on the calendar.",
  },
  // F
  bookedTodayLandingToday: {
    key: "bookedTodayLandingToday",
    label: "Booked today for today",
    definition:
      "Bookings made on this day that also happen on this day — same-day fills.",
    source:
      "calendly_bookings where booked-at and event_start_at are the same day",
    basis: "booked-on",
    includes: "Every call type. Cancellations included.",
  },
  // G — Stephen's capacity dashboard. Not ours; defined so it can be named.
  capacityTotalMeetingsBooked: {
    key: "capacityTotalMeetingsBooked",
    label: 'Capacity dashboard "Total Meetings Booked"',
    definition:
      "New calls plus follow-ups plus reschedules SCHEDULED for this day, as the call-capacity dashboard counts them. It is a lands-on number despite the word booked, and it is not produced by this codebase.",
    source: "Stephen's call-capacity dashboard. No source in this database.",
    basis: "lands-on",
    includes: "New, follow-up and reschedule calls scheduled for the day.",
  },
};

/**
 * A booking as this module needs it. `bookedAt` is Calendly's timestamp and is
 * the only acceptable source for a booked-on metric — never the mirror row's
 * `created_at`.
 */
export type BookingRow = {
  inviteeEmail: string | null;
  status: string;
  eventName: string | null;
  /** `raw_payload -> payload -> scheduled_event -> event_type`. Survives renames. */
  eventTypeUri: string | null;
  /** `raw_payload -> payload -> created_at`. Null when the payload predates capture. */
  bookedAt: string | null;
  eventStartAt: string | null;
  utmSource: string | null;
};

/** A mirrored Close lead. Names the funnel a booking's email belongs to. */
export type FunnelRow = {
  email: string | null;
  funnel: string | null;
  /** The SCHEDULED date of the lead's first sales call. Not its booking date. */
  firstSalesCallBookedDate: string | null;
};

/**
 * Why a number might not be the whole truth. Never collapsed into the value and
 * never rendered as zero — a metric with unreviewed event types is reported
 * short, with the shortfall named.
 */
export type MetricCoverage = {
  /** Bookings the metric considered before classification. */
  considered: number;
  /** Held out because their event type has no reviewed classification. */
  unreviewed: number;
  /** The event names behind `unreviewed`, so someone can go review them. */
  unreviewedNames: string[];
  /** Removed as Lane 2 outbound, where the metric excludes it. */
  laneTwoExcluded: number;
  /** Counted but with no Close lead to attribute, so channel is unknown. */
  noCloseMatch: number;
  /** Bookings with no Calendly booked-at, which cannot be dated at all. */
  undatable: number;
};

export type BookedMetricResult = {
  metric: BookedMetric;
  /**
   * Null means not observable, never zero. A metric with no source in this
   * database returns null and says why in `unavailableReason`.
   */
  value: number | null;
  unavailableReason: string | null;
  /** The day this counts, YYYY-MM-DD in `timeZone`. */
  asOf: string;
  timeZone: string;
  coverage: MetricCoverage;
};

export type BookedMetricInput = {
  bookings: BookingRow[];
  funnels: FunnelRow[];
  /** The day to count, YYYY-MM-DD. */
  day: string;
  timeZone?: string;
};

/** The calendar day an instant falls on, in the reporting timezone. */
export function dayKeyIn(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  // en-CA formats as YYYY-MM-DD, which sorts and compares as a date key.
  return at.toLocaleDateString("en-CA", { timeZone });
}

function emailKey(email: string | null): string | null {
  return email?.trim().toLowerCase() || null;
}

/** Close funnel by lead email. First lead wins, matching booked-calls.ts. */
function funnelIndex(funnels: FunnelRow[]): Map<string, string | null> {
  const index = new Map<string, string | null>();
  for (const row of funnels) {
    const key = emailKey(row.email);
    if (key && !index.has(key)) index.set(key, row.funnel);
  }
  return index;
}

/**
 * Lane 2 is the reactivation/scraper team's outbound. It books real calls, but
 * it is not marketing demand, and folding it into the pace number makes the
 * marketing funnel look healthier than it is.
 *
 * Caveat worth carrying: most Lane 2 bookings never reach the Calendly mirror
 * at all — that team books on calendars we get no webhook from — so on a
 * booked-on metric this removes the handful that do come through, not the whole
 * team. `coverage.laneTwoExcluded` reports how many were actually removed so
 * the exclusion is never mistaken for complete.
 */
function isLaneTwo(funnel: string | null | undefined): boolean {
  return channelKeyForFunnel(funnel ?? null) === "lane-2";
}

type Classified = {
  booking: BookingRow;
  classification: EventClassification;
  funnel: string | null | undefined;
};

function emptyCoverage(): MetricCoverage {
  return {
    considered: 0,
    unreviewed: 0,
    unreviewedNames: [],
    laneTwoExcluded: 0,
    noCloseMatch: 0,
    undatable: 0,
  };
}

/** Bookings made on `day`, classified, with their Close funnel attached. */
function bookedOn(
  input: BookedMetricInput,
  timeZone: string,
): { rows: Classified[]; undatable: number } {
  const funnels = funnelIndex(input.funnels);
  const rows: Classified[] = [];
  let undatable = 0;
  for (const booking of input.bookings) {
    if (!booking.bookedAt) {
      // No Calendly timestamp. It cannot be dated, and falling back to our
      // row-insert time is exactly the bug that produced "1,899 booked today".
      undatable += 1;
      continue;
    }
    if (dayKeyIn(booking.bookedAt, timeZone) !== input.day) continue;
    const key = emailKey(booking.inviteeEmail);
    rows.push({
      booking,
      classification: classifyEventType(
        booking.eventTypeUri,
        booking.eventName,
      ),
      funnel: key ? funnels.get(key) : undefined,
    });
  }
  return { rows, undatable };
}

function countByClass(
  rows: Classified[],
  wanted: EventClass,
  options: { excludeLaneTwo: boolean },
): { value: number; coverage: MetricCoverage } {
  const coverage = emptyCoverage();
  coverage.considered = rows.length;
  const unreviewed = new Set<string>();
  let value = 0;
  for (const row of rows) {
    if (!row.classification.reviewed) {
      // Fail closed. An unreviewed event type is not silently counted as new,
      // and it is not silently dropped either — it is reported as a shortfall.
      coverage.unreviewed += 1;
      unreviewed.add(row.classification.name ?? "(no event name)");
      continue;
    }
    if (row.classification.class !== wanted) continue;
    if (options.excludeLaneTwo && isLaneTwo(row.funnel)) {
      coverage.laneTwoExcluded += 1;
      continue;
    }
    if (row.funnel === undefined) coverage.noCloseMatch += 1;
    value += 1;
  }
  coverage.unreviewedNames = [...unreviewed].sort();
  return { value, coverage };
}

/**
 * One reader. Give it a metric key and a day, get the value welded to its
 * definition, the day it counts, and what the number does not cover.
 */
export function readBookedMetric(
  key: MetricKey,
  input: BookedMetricInput,
): BookedMetricResult {
  const metric = BOOKED_METRICS[key];
  const timeZone = input.timeZone ?? REPORTING_TIME_ZONE;
  const base = {
    metric,
    asOf: input.day,
    timeZone,
    unavailableReason: null as string | null,
  };

  if (key === "capacityTotalMeetingsBooked") {
    return {
      ...base,
      value: null,
      unavailableReason:
        "The call-capacity dashboard is a separate system and this database has no equivalent. Read it there rather than approximating it here.",
      coverage: emptyCoverage(),
    };
  }

  if (key === "firstCallsOnCalendar") {
    // Close's mirror, deduplicated per lead by construction: one row per lead.
    const coverage = emptyCoverage();
    coverage.considered = input.funnels.length;
    let value = 0;
    for (const row of input.funnels) {
      if (!row.firstSalesCallBookedDate) continue;
      if (row.firstSalesCallBookedDate.slice(0, 10) !== input.day) continue;
      value += 1;
    }
    return { ...base, value, coverage };
  }

  if (key === "allMeetingsOnCalendar") {
    const coverage = emptyCoverage();
    let value = 0;
    for (const booking of input.bookings) {
      if (dayKeyIn(booking.eventStartAt, timeZone) !== input.day) continue;
      coverage.considered += 1;
      if (booking.status === "canceled") continue;
      value += 1;
    }
    return { ...base, value, coverage };
  }

  const { rows, undatable } = bookedOn(input, timeZone);

  if (key === "allBookedOn") {
    const coverage = emptyCoverage();
    coverage.considered = rows.length;
    coverage.undatable = undatable;
    return { ...base, value: rows.length, coverage };
  }

  if (key === "bookedTodayLandingToday") {
    const coverage = emptyCoverage();
    coverage.considered = rows.length;
    coverage.undatable = undatable;
    let value = 0;
    for (const row of rows) {
      if (dayKeyIn(row.booking.eventStartAt, timeZone) === input.day)
        value += 1;
    }
    return { ...base, value, coverage };
  }

  const wanted: EventClass =
    key === "newBookedOn"
      ? "new"
      : key === "followUpBookedOn"
        ? "follow_up"
        : "reschedule";
  const { value, coverage } = countByClass(rows, wanted, {
    // Only the pace number strips Lane 2; the diagnostic buckets show everything.
    excludeLaneTwo: key === "newBookedOn",
  });
  coverage.undatable = undatable;
  return { ...base, value, coverage };
}

// ---------------------------------------------------------------------------
// Attribution

/**
 * Where a booking came from. Resolution order is Close funnel via the email
 * join, then the UTM, then explicitly unattributed.
 *
 * The email join first, because chasing UTMs is fixing the wrong thing: only 8
 * of 35 bookings on 2026-09-14 carried a `utm_source`, but the email join
 * resolved 26 of them. The bookings without a UTM are mostly outbound, where a
 * tagged link never existed to click. A missing UTM there is not a tracking
 * failure.
 */
export type AttributionSource = "close-funnel" | "utm" | "none";

export type Attribution = {
  /** The goal-page channel key, so labels match the Goals page exactly. */
  channelKey: string | null;
  label: string;
  via: AttributionSource;
};

export const UNATTRIBUTED_LABEL = "(unattributed)";

export function attributeBooking(
  booking: Pick<BookingRow, "inviteeEmail" | "utmSource">,
  funnels: Map<string, string | null>,
): Attribution {
  const key = emailKey(booking.inviteeEmail);
  const funnel = key ? funnels.get(key) : undefined;
  if (funnel) {
    return {
      channelKey: channelKeyForFunnel(funnel),
      label: funnel,
      via: "close-funnel",
    };
  }
  const utm = booking.utmSource?.trim();
  if (utm) return { channelKey: null, label: utm, via: "utm" };
  // Never blank. "We do not know" is a reportable answer; an empty cell is not.
  return { channelKey: null, label: UNATTRIBUTED_LABEL, via: "none" };
}

/** Channel split for a metric's day, biggest first. */
export function attributionFor(
  input: BookedMetricInput,
  options: { onlyClass?: EventClass; excludeLaneTwo?: boolean } = {},
): Array<{ label: string; via: AttributionSource; booked: number }> {
  const timeZone = input.timeZone ?? REPORTING_TIME_ZONE;
  const funnels = funnelIndex(input.funnels);
  const { rows } = bookedOn(input, timeZone);
  const tally = new Map<string, { via: AttributionSource; booked: number }>();
  for (const row of rows) {
    if (options.onlyClass) {
      if (!row.classification.reviewed) continue;
      if (row.classification.class !== options.onlyClass) continue;
    }
    if (options.excludeLaneTwo && isLaneTwo(row.funnel)) continue;
    const attribution = attributeBooking(row.booking, funnels);
    const entry = tally.get(attribution.label) ?? {
      via: attribution.via,
      booked: 0,
    };
    entry.booked += 1;
    tally.set(attribution.label, entry);
  }
  return [...tally.entries()]
    .map(([label, entry]) => ({ label, ...entry }))
    .sort((a, b) => b.booked - a.booked || a.label.localeCompare(b.label));
}
