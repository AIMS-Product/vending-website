import { INSTAGRAM_DM_CHANNEL } from "@/lib/analytics/channel";
import type { Tables } from "@/types/database";
import {
  type ChannelFact,
  ofVisitsPct,
  pairedPct,
  pct,
  sumObserved,
} from "@/lib/services/channel-report-rollup";

/**
 * The Lead Gen KPI Framework (Adam's sheet, 2026-09-11) as a report: four
 * sections, one row per asset / event / workflow / rep, the sheet's columns.
 * Pure and client-safe; `getKpiTab` fetches the inputs.
 *
 * Every rate is paired (both sides observed on the same rows) and null means
 * not observed, never zero. Each section says which date basis it uses.
 */

export type KpiFormat = "number" | "money" | "percent";
export type KpiColumn = { key: string; label: string; format: KpiFormat };

export type KpiRow = {
  key: string;
  label: string;
  detail: string | null;
  values: Record<string, number | null>;
  sourceOfTruth: string;
  owner: string | null;
  cadence: string;
  /** Oldest last-run among the connectors behind the row; null if any never ran. */
  lastVerified: string | null;
};

export type KpiSection = {
  key: string;
  title: string;
  basis: string;
  columns: KpiColumn[];
  rows: KpiRow[];
  /** Rows left out to keep the table clean; `hiddenNote` says what they were. */
  hidden: number;
  hiddenNote: string;
};

export type KpiReport = { sections: KpiSection[] };

export type WebinarEventRow = Pick<
  Tables<"webinar_events">,
  | "date"
  | "label"
  | "format"
  | "registrations"
  | "attendees"
  | "booked_night_of"
  | "booked_ever"
  | "booked_calls"
  | "showed"
  | "show_no_booking"
  | "won"
  | "revenue"
  | "spend"
  | "booking_maturing"
  | "revenue_maturing"
>;

export type EmailSnapshotRow = Pick<
  Tables<"ghl_email_stats">,
  | "snapshot_day"
  | "workflow_id"
  | "workflow_name"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
>;

/** A lead whose sales call was booked in range, on the booking date. */
export type SetterBookingRow = {
  booked_by_setter: string | null;
  call_outcome: string | null;
  closed_won_at: string | null;
  /**
   * The call as Close logged it (classifyBookedCall). Null when the Close
   * mirror could not be read; the show columns then read as a dash.
   */
  show_state?: "held" | "noShow" | "pending" | "unlogged" | null;
};

export type KpiInput = {
  /** Spine facts for the range, already through `normaliseFacts`. */
  facts: ChannelFact[];
  webinars: WebinarEventRow[];
  emailSnapshots: EmailSnapshotRow[];
  setterBookings: SetterBookingRow[];
  /** Connector name to its last finished run (ISO), null when it never ran. */
  lastRun: Record<string, string | null>;
};

/** Owners and cadence from the framework sheet. Unlisted channels show none. */
export const KPI_OWNERS: Record<string, { owner: string; cadence: string }> = {
  YouTube: { owner: "Ayman", cadence: "Weekly" },
  Instagram: { owner: "Makenna", cadence: "Weekly" },
  [INSTAGRAM_DM_CHANNEL]: { owner: "Makenna", cadence: "Weekly" },
  Website: { owner: "Adam", cadence: "Weekly" },
  Chatbot: { owner: "Adam", cadence: "Weekly" },
  Webinar: {
    owner: "Anthony + Marc; Adam (systems)",
    cadence: "Per event + weekly",
  },
  Email: { owner: "Lujan", cadence: "Weekly" },
  SMS: { owner: "Lujan", cadence: "Weekly" },
  Newsletter: { owner: "Lujan", cadence: "Weekly" },
  "Lane 2": { owner: "Anthony (AK)", cadence: "Weekly" },
};

const PATH_LABEL: Record<string, string> = {
  "book-call": "Direct booking",
  "lead-magnet": "Lead magnet",
  apply: "Apply",
  "webinar-register": "Webinar registration",
  content: "Content",
  none: "No CTA",
  unknown: "",
};

const RE_ENGAGEMENT_CHANNELS = new Set(["Email", "SMS", "Newsletter"]);

/** Bookings nothing names a setter for: the prospect booked from a link themselves. */
const SELF_BOOKED = "No setter (self-booked)";

const FUNNEL_COLUMNS: KpiColumn[] = [
  { key: "impressions", label: "Impressions", format: "number" },
  { key: "ctr", label: "CTR", format: "percent" },
  { key: "visits", label: "LP visits", format: "number" },
  { key: "thankYouVisits", label: "Thank-you visits", format: "number" },
  { key: "thankYouConv", label: "Conv %", format: "percent" },
  { key: "optIn", label: "Opt-in", format: "percent" },
  { key: "leads", label: "Leads", format: "number" },
  { key: "leadToBook", label: "Lead → book", format: "percent" },
  { key: "booked", label: "Booked", format: "number" },
  { key: "showRate", label: "Show rate", format: "percent" },
  { key: "showed", label: "Shown", format: "number" },
  { key: "closeRate", label: "Close rate", format: "percent" },
  { key: "won", label: "Won", format: "number" },
  { key: "leadToClose", label: "Lead → close", format: "percent" },
  { key: "revenue", label: "Revenue", format: "money" },
  { key: "spend", label: "Spend", format: "money" },
  { key: "costPerBooked", label: "Cost / booked", format: "money" },
];

const WEBINAR_COLUMNS: KpiColumn[] = [
  { key: "registrations", label: "Registrations", format: "number" },
  { key: "attendanceRate", label: "Attendance", format: "percent" },
  { key: "attendees", label: "Attendees", format: "number" },
  { key: "regToBook", label: "Reg → book", format: "percent" },
  { key: "booked", label: "Booked", format: "number" },
  { key: "bookedNightOf", label: "Booked night of", format: "number" },
  { key: "bookedEver", label: "Booked (Close tag)", format: "number" },
  { key: "showRate", label: "Show rate", format: "percent" },
  { key: "showed", label: "Shown", format: "number" },
  { key: "showNoBooking", label: "Shown, no booking", format: "number" },
  { key: "closeRate", label: "Close rate", format: "percent" },
  { key: "won", label: "Won", format: "number" },
  { key: "regToClose", label: "Reg → close", format: "percent" },
  { key: "revenue", label: "Revenue", format: "money" },
  { key: "spend", label: "Spend", format: "money" },
  { key: "costPerBooked", label: "Cost / booked", format: "money" },
];

const RE_ENGAGEMENT_COLUMNS: KpiColumn[] = [
  { key: "sent", label: "Sent", format: "number" },
  { key: "deliveryRate", label: "Delivered %", format: "percent" },
  { key: "delivered", label: "Delivered", format: "number" },
  { key: "opened", label: "Opened", format: "number" },
  { key: "clicked", label: "Clicked", format: "number" },
  { key: "replyRate", label: "Reply rate", format: "percent" },
  { key: "replied", label: "Replies", format: "number" },
  { key: "leads", label: "Leads", format: "number" },
  { key: "leadToBook", label: "Lead → book", format: "percent" },
  { key: "booked", label: "Booked", format: "number" },
  { key: "showRate", label: "Show rate", format: "percent" },
  { key: "showed", label: "Shown", format: "number" },
  { key: "won", label: "Won", format: "number" },
];

const LANE2_COLUMNS: KpiColumn[] = [
  { key: "leads", label: "New conversations", format: "number" },
  { key: "clicks", label: "Booking links sent", format: "number" },
  { key: "booked", label: "Booked", format: "number" },
  { key: "showRate", label: "Show rate", format: "percent" },
  { key: "outcomeKnown", label: "Show logged in Close", format: "percent" },
  { key: "showed", label: "Shown", format: "number" },
  { key: "closeRate", label: "Close rate", format: "percent" },
  { key: "won", label: "Won", format: "number" },
];

/** Which connector observes each spine metric, for "source of truth". */
const METRIC_CONNECTOR: Array<
  [keys: ReadonlyArray<keyof ChannelFact>, connector: string]
> = [
  [["visits", "thankyou_visits"], "ga4-visits"],
  [["leads", "booked", "showed", "won"], "leads"],
  [["impressions", "reach"], "metricool-posts"],
  [["clicks"], "bitly-clicks"],
  [["spend"], "metricool-ads"],
];

export function buildKpiReport(input: KpiInput): KpiReport {
  return {
    sections: [
      buildFunnelSection(input),
      buildWebinarSection(input),
      buildReEngagementSection(input),
      buildLane2Section(input),
    ],
  };
}

// ---------------------------------------------------------------------------
// Section 1: content and website funnels, one row per channel x CTA path.
// ---------------------------------------------------------------------------

function buildFunnelSection(input: KpiInput): KpiSection {
  const groups = new Map<string, ChannelFact[]>();
  for (const fact of input.facts) {
    if (fact.channel === "Webinar") continue;
    if (fact.channel === INSTAGRAM_DM_CHANNEL) continue;
    if (RE_ENGAGEMENT_CHANNELS.has(fact.channel)) continue;
    const id = `${fact.channel}|${fact.destination}`;
    groups.set(id, [...(groups.get(id) ?? []), fact]);
  }

  const rows: KpiRow[] = [];
  const sectionFacts: ChannelFact[] = [];
  let hidden = 0;
  for (const [id, facts] of groups) {
    const [channel, destination] = id.split("|") as [string, string];
    sectionFacts.push(...facts);
    const values = funnelValues(facts);
    if (!hasOutcome(values)) {
      hidden += 1;
      continue;
    }
    rows.push({
      key: id,
      label: channel,
      detail: (PATH_LABEL[destination] ?? destination) || null,
      values,
      ...provenance(facts, input.lastRun),
      ...ownerFor(channel),
    });
  }
  rows.sort(byOutcome);

  // The total the sheet has no row for. Rates are recomputed over the pooled
  // facts rather than averaged across rows, so "All channels" opt-in is one
  // number over one population. It covers the hidden rows too: leads, booked,
  // won and revenue still add up down the column, but visits and impressions
  // are larger than the visible rows sum to, which is what `hiddenNote` says.
  if (rows.length > 1) {
    rows.unshift({
      key: "funnels|all",
      label: "All channels",
      detail:
        hidden > 0
          ? `every row below, plus ${hidden} with no outcome`
          : "every row below",
      values: funnelValues(sectionFacts),
      ...provenance(sectionFacts, input.lastRun),
      owner: null,
      cadence: "Weekly",
    });
  }

  return {
    key: "funnels",
    title: "Content and website funnels",
    basis:
      "Booked, shown and won are credited to the day the lead arrived, so every rate is over one cohort. A row splits by CTA path (utm_term) once its links carry one; a row with no path is a channel whose links are not tagged yet. Thank-you visits count sessions that reached one of our own confirmation pages, so a channel that converts on a GHL form or straight into Calendly shows none. A call counts as shown only when a rep logged it as a show in Close (First Call Show Up = yes); a call nobody logged is not counted as shown, so show rate is a floor while logging is incomplete. Lane 2 below shows what share of due calls have a show answer in Close. Webinar, Instagram DM and email/SMS links have their own sections, so All channels here excludes their visits.",
    columns: FUNNEL_COLUMNS,
    rows,
    hidden,
    hiddenNote:
      "with visits or impressions only: no leads, bookings, wins or spend observed",
  };
}

function funnelValues(facts: ChannelFact[]): Record<string, number | null> {
  const spend = sumObserved(facts.map((fact) => fact.spend));
  const booked = sumObserved(facts.map((fact) => fact.booked));
  return {
    // Impressions, never reach. Reach is unique people per post, so adding it
    // up counts the same follower once per post they saw -- 44 Instagram posts
    // summed to 1,242,166 "reach" on 2026-09-11, far past anything the account
    // could actually reach. The old `reach ?? impressions` was worse still:
    // it mixed the two, summing reach from the 44 rows that had it and
    // impressions from the 97 that did not. Impressions are additive, which is
    // the same rule that keeps bounce rate out of the GA4 client.
    impressions: sumObserved(facts.map((fact) => fact.impressions)),
    ctr: rate(pairedPct(facts, "clicks", "impressions")),
    visits: sumObserved(facts.map((fact) => fact.visits)),
    thankYouVisits: sumObserved(facts.map((fact) => fact.thankyou_visits)),
    thankYouConv: rate(ofVisitsPct(facts, "thankyou_visits")),
    optIn: rate(ofVisitsPct(facts, "leads")),
    leads: sumObserved(facts.map((fact) => fact.leads)),
    leadToBook: rate(pairedPct(facts, "booked", "leads")),
    booked,
    showRate: rate(pairedPct(facts, "showed", "booked")),
    showed: sumObserved(facts.map((fact) => fact.showed)),
    closeRate: rate(pairedPct(facts, "won", "showed")),
    won: sumObserved(facts.map((fact) => fact.won)),
    leadToClose: rate(pairedPct(facts, "won", "leads")),
    revenue: sumObserved(facts.map((fact) => fact.revenue)),
    spend,
    costPerBooked: ratio(spend, booked),
  };
}

// ---------------------------------------------------------------------------
// Section 2: webinar funnel, one row per event plus a total.
// ---------------------------------------------------------------------------

function buildWebinarSection(input: KpiInput): KpiSection {
  const events = [...input.webinars].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const owner = ownerFor("Webinar");
  const meta = {
    sourceOfTruth: "webinar-ingest (GHL + Zoom + Close)",
    lastVerified: input.lastRun["webinar-ingest"] ?? null,
    ...owner,
  };
  const rows: KpiRow[] = events.map((event) => ({
    key: `webinar|${event.date}|${event.label}`,
    label: event.label,
    detail: `${event.date} · ${event.format}`,
    values: webinarValues([event]),
    ...meta,
  }));
  if (events.length > 1) {
    rows.unshift({
      key: "webinar|all",
      label: "All webinars",
      detail: `${events.length} events`,
      values: webinarValues(events),
      ...meta,
    });
  }
  return {
    key: "webinar",
    title: "Webinar funnel",
    basis:
      "One row per event. Booked = every call this cohort ever booked, which is the population Shown and Won are counted over, so every rate here is a real fraction; Booked night of is the same cohort's offer conversion on the night and is a subset, never the denominator. Shown counts booked leads only — a rep marking a lead shown with no booked date lands in Shown, no booking and is never added to Shown. A cohort still inside its booking window shows dashes for the rates that window decides rather than a rate computed from an unfinished cohort; the counts beside them are real, just not final. Registration page visits are not observed (the page is GHL-hosted).",
    columns: WEBINAR_COLUMNS,
    rows,
    hidden: 0,
    hiddenNote: "",
  };
}

/**
 * One event or the whole set. Every rate divides numbers counted over the same population.
 *
 * `booked_calls` is the denominator. Shown, Won and Revenue come from vp-webinars' booking-link join --
 * the people on the Booked Calls sheet -- because Close only sees a booking whose lead still carries the
 * event tag, and the tag goes missing on precisely the people who book. `booked_ever` is the tag cohort:
 * a different set of people that crosses the sheet in both directions, so dividing by it published a 25.7%
 * show rate for Sept 1 against a real 60%, and 21.7% for Aug 18 against 45.5%, on this page from
 * 2026-09-16 to 2026-09-17. It stays visible as its own column and is divided into nothing.
 *
 * Before that it was `booked_night_of` and `booked_within_7d`: Shown, Won and Revenue are lifetime
 * numbers, and dividing them by a night-of or seven-day count published a 335%
 * show rate for june16 (87 shown over 26 booked that night) on this page until 2026-09-13.
 *
 * A cohort inside its booking or revenue window has not finished booking or closing, so the rates those
 * windows decide are withheld rather than computed from a partial cohort — a five-day-old webinar showing a
 * confident 0% close rate is the same lie as a 335% show rate, pointed the other way. The counts stay
 * visible because they are real, just not final. One maturing event contaminates an aggregate row, so the
 * aggregate is gated on any of its events being maturing, not all.
 */
function webinarValues(
  events: WebinarEventRow[],
): Record<string, number | null> {
  const sum = (key: keyof WebinarEventRow) =>
    sumObserved(events.map((event) => event[key] as number | null));
  const registrations = sum("registrations");
  const attendees = sum("attendees");
  // Null when no event in the set reports one, which leaves every rate below as a dash. Never falls back
  // to `booked_ever`: a rate over the wrong population reads as confident and is the defect being fixed.
  const booked = sum("booked_calls");
  const bookedEver = sum("booked_ever");
  const bookedNightOf = sum("booked_night_of");
  const showed = sum("showed");
  const won = sum("won");
  const spend = sum("spend");
  const bookingOpen = events.some((event) => event.booking_maturing);
  const revenueOpen = events.some((event) => event.revenue_maturing);
  const final = <T>(open: boolean, value: T | null): T | null =>
    open ? null : value;
  return {
    registrations,
    attendanceRate: rate(pct(attendees, registrations)),
    attendees,
    regToBook: final(bookingOpen, rate(pct(booked, registrations))),
    booked,
    bookedEver,
    bookedNightOf,
    showRate: final(bookingOpen, rate(pct(showed, booked))),
    showed,
    showNoBooking: sum("show_no_booking"),
    closeRate: final(revenueOpen, rate(pct(won, showed))),
    won,
    regToClose: final(revenueOpen, rate(pct(won, registrations))),
    revenue: sum("revenue"),
    spend,
    costPerBooked: final(bookingOpen, ratio(spend, booked)),
  };
}

// ---------------------------------------------------------------------------
// Section 3: marketing re-engagement. GHL reports lifetime totals per
// workflow; the difference between the first and last snapshot in range is
// what was sent in range. One snapshot means nothing to difference: null.
// ---------------------------------------------------------------------------

function buildReEngagementSection(input: KpiInput): KpiSection {
  const byWorkflow = new Map<string, EmailSnapshotRow[]>();
  for (const snapshot of input.emailSnapshots) {
    byWorkflow.set(snapshot.workflow_id, [
      ...(byWorkflow.get(snapshot.workflow_id) ?? []),
      snapshot,
    ]);
  }
  const owner = ownerFor("Email");
  const rows: KpiRow[] = [];
  let hidden = 0;
  for (const [workflowId, snapshots] of byWorkflow) {
    const ordered = [...snapshots].sort((a, b) =>
      a.snapshot_day.localeCompare(b.snapshot_day),
    );
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const diff = (
      key: "sent" | "delivered" | "opened" | "clicked" | "replied",
    ) => (ordered.length > 1 ? Math.max(0, last[key] - first[key]) : null);
    const sent = diff("sent");
    const delivered = diff("delivered");
    const replied = diff("replied");
    if (sent == null || sent === 0) {
      hidden += 1;
      continue;
    }
    rows.push({
      key: `workflow|${workflowId}`,
      label: last.workflow_name,
      detail: "GHL email workflow",
      values: {
        sent,
        deliveryRate: rate(pct(delivered, sent)),
        delivered,
        opened: diff("opened"),
        clicked: diff("clicked"),
        replyRate: rate(pct(replied, delivered)),
        replied,
        leads: null,
        leadToBook: null,
        booked: null,
        showRate: null,
        showed: null,
        won: null,
      },
      sourceOfTruth: "ghl-email (snapshot difference)",
      lastVerified: input.lastRun["ghl-email"] ?? null,
      ...owner,
    });
  }
  rows.sort((a, b) => (b.values.sent ?? 0) - (a.values.sent ?? 0));

  const facts = input.facts.filter((fact) =>
    RE_ENGAGEMENT_CHANNELS.has(fact.channel),
  );
  if (facts.length > 0) {
    rows.push({
      key: "re-engagement|spine",
      label: "Email + SMS links",
      detail: "Leads and bookings from tagged ghl_email / ghl_sms links",
      values: {
        sent: null,
        deliveryRate: null,
        delivered: null,
        opened: null,
        clicked: sumObserved(facts.map((fact) => fact.clicks)),
        replyRate: null,
        replied: null,
        leads: sumObserved(facts.map((fact) => fact.leads)),
        leadToBook: rate(pairedPct(facts, "booked", "leads")),
        booked: sumObserved(facts.map((fact) => fact.booked)),
        showRate: rate(pairedPct(facts, "showed", "booked")),
        showed: sumObserved(facts.map((fact) => fact.showed)),
        won: sumObserved(facts.map((fact) => fact.won)),
      },
      ...provenance(facts, input.lastRun),
      ...owner,
    });
  }

  return {
    key: "re-engagement",
    title: "Marketing re-engagement",
    basis:
      "Sends are the change in GHL's lifetime totals across the range. GHL has no per-workflow SMS stats; SMS shows only through tagged links.",
    columns: RE_ENGAGEMENT_COLUMNS,
    rows,
    hidden,
    hiddenNote:
      "workflows with no sends observed in range (GHL totals need two snapshots to difference; history starts the day after the first sync)",
  };
}

// ---------------------------------------------------------------------------
// Section 4: Lane 2. Setters by booking date (the sheet's "First Sales Call
// Booked Date"), plus the Instagram DM stage funnel from ManyChat.
// ---------------------------------------------------------------------------

function buildLane2Section(input: KpiInput): KpiSection {
  const bySetter = new Map<string, SetterBookingRow[]>();
  for (const booking of input.setterBookings) {
    const setter = booking.booked_by_setter?.trim() || SELF_BOOKED;
    bySetter.set(setter, [...(bySetter.get(setter) ?? []), booking]);
  }
  const owner = ownerFor("Lane 2");
  const rows: KpiRow[] = [];
  const setterRow = (label: string, bookings: SetterBookingRow[]): KpiRow => {
    const booked = bookings.length;
    // Shown only when a rep logged the show in Close, the Funnels tab's rule.
    // Calls not yet due are left out of the show-rate denominator; calls due
    // but never logged stay in it and are reported as not logged, never as
    // shown.
    const observed = bookings.every((b) => b.show_state != null);
    const showed = observed
      ? bookings.filter((b) => b.show_state === "held").length
      : null;
    const due = bookings.filter((b) => b.show_state !== "pending").length;
    const won = bookings.filter(
      (b) => Boolean(b.closed_won_at) || b.call_outcome === "won",
    ).length;
    // What share of the calls that were due have a show answer in Close.
    const known = observed
      ? bookings.filter(
          (b) => b.show_state === "held" || b.show_state === "noShow",
        ).length
      : null;
    return {
      key: `setter|${label}`,
      label,
      detail: "Setter, by booking date",
      values: {
        leads: null,
        clicks: null,
        booked,
        showRate: showed === null ? null : rate(pct(showed, due)),
        outcomeKnown: known === null ? null : rate(pct(known, due)),
        showed,
        closeRate: showed === null ? null : rate(pct(won, showed)),
        won,
      },
      sourceOfTruth:
        "calendly_bookings (invitee_scheduled_by, setter link tag) + lead_submissions (outcome)",
      lastVerified: input.lastRun.leads ?? null,
      ...owner,
    };
  };
  if (input.setterBookings.length > 0) {
    rows.push(setterRow("Team total", input.setterBookings));
    for (const [setter, bookings] of [...bySetter].sort(
      (a, b) => b[1].length - a[1].length,
    )) {
      rows.push(setterRow(setter, bookings));
    }
  }

  const dm = input.facts.filter(
    (fact) => fact.channel === INSTAGRAM_DM_CHANNEL,
  );
  if (dm.length > 0) {
    rows.push({
      key: "lane2|instagram-dm",
      label: INSTAGRAM_DM_CHANNEL,
      detail: "ManyChat stages (Pearl)",
      values: {
        // ManyChat new conversations are contacts, not site leads
        // (lead-definition), so they arrive on `contacts`.
        leads: sumObserved(dm.map((fact) => fact.contacts ?? null)),
        clicks: sumObserved(dm.map((fact) => fact.clicks)),
        booked: sumObserved(dm.map((fact) => fact.booked)),
        showRate: rate(pairedPct(dm, "showed", "booked")),
        // The spine carries no per-call outcome for DM stage events.
        outcomeKnown: null,
        showed: sumObserved(dm.map((fact) => fact.showed)),
        closeRate: rate(pairedPct(dm, "won", "showed")),
        won: sumObserved(dm.map((fact) => fact.won)),
      },
      sourceOfTruth: "manychat-ingest",
      lastVerified: input.lastRun["manychat-ingest"] ?? null,
      ...ownerFor(INSTAGRAM_DM_CHANNEL),
    });
  }

  return {
    key: "lane2",
    title: "Lane 2",
    basis:
      "Setter rows count every Calendly booking by the date it was booked, not by lead cohort, and name whoever set it: the rep Calendly recorded as booking it, their own tagged link, then Close's setter field. Outcome known is the share of those bookings with an outcome recorded in Close — a booking with no lead behind it can have none, so this sits low and show rate, which counts the rest as shown, is that much more assumption. Instagram DM counts ManyChat stage events.",
    columns: LANE2_COLUMNS,
    rows,
    hidden: 0,
    hiddenNote: "",
  };
}

// ---------------------------------------------------------------------------
// Shared helpers.
// ---------------------------------------------------------------------------

function ownerFor(channel: string): { owner: string | null; cadence: string } {
  const entry = KPI_OWNERS[channel];
  return { owner: entry?.owner ?? null, cadence: entry?.cadence ?? "Weekly" };
}

/** Connectors that observed something in these facts, and the oldest run among them. */
function provenance(
  facts: ChannelFact[],
  lastRun: Record<string, string | null>,
): { sourceOfTruth: string; lastVerified: string | null } {
  const connectors: string[] = [];
  for (const [keys, connector] of METRIC_CONNECTOR) {
    if (facts.some((fact) => keys.some((key) => fact[key] != null)))
      connectors.push(connector);
  }
  if (connectors.length === 0)
    return { sourceOfTruth: "nothing observed", lastVerified: null };
  const runs = connectors.map((connector) => lastRun[connector] ?? null);
  const lastVerified = runs.includes(null)
    ? null
    : (runs as string[]).sort()[0]!;
  return { sourceOfTruth: connectors.join(" + "), lastVerified };
}

function hasOutcome(values: Record<string, number | null>): boolean {
  return ["leads", "booked", "won", "spend"].some(
    (key) => (values[key] ?? 0) > 0,
  );
}

function byOutcome(a: KpiRow, b: KpiRow): number {
  for (const key of ["leads", "booked", "visits", "impressions"]) {
    const diff = (b.values[key] ?? 0) - (a.values[key] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.label.localeCompare(b.label);
}

/**
 * A rate above 100% means the two sides were not one population (leads keyed
 * by a Google Ads campaign id while GA4 keys by campaign name, say). Showing
 * "120%" would be a lie, so it is not observed.
 */
function rate(value: number | null): number | null {
  return value != null && value > 100 ? null : value;
}

function ratio(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator === 0)
    return null;
  return Math.round(numerator / denominator);
}

// ---------------------------------------------------------------------------
// CSV: one block per section, blank line between, so a sheet can IMPORT it.
// ---------------------------------------------------------------------------

export function kpiReportToCsv(report: KpiReport): string {
  const blocks = report.sections.map((section) => {
    const header = [
      "Section",
      "Row",
      "Detail",
      ...section.columns.map((column) => column.label),
      "Source of truth",
      "Owner",
      "Cadence",
      "Last verified",
    ];
    const lines = section.rows.map((row) => [
      section.title,
      row.label,
      row.detail ?? "",
      ...section.columns.map((column) =>
        csvNumber(row.values[column.key] ?? null),
      ),
      row.sourceOfTruth,
      row.owner ?? "",
      row.cadence,
      row.lastVerified ?? "",
    ]);
    return [header, ...lines]
      .map((cells) => cells.map(csvCell).join(","))
      .join("\n");
  });
  return `${blocks.join("\n\n")}\n`;
}

function csvNumber(value: number | null): string {
  return value == null ? "" : String(value);
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
