/**
 * The team page's five tabs, as pure aggregation over rows the data layer
 * hands in. Nothing here touches a database, so every rule below is unit
 * tested with a handful of rows.
 *
 * Conventions shared with the goals and KPI pages: a null is "not observed"
 * and renders as a dash, never a zero; a rate is only computed where both
 * sides were observed, and a rate above 100% is reported as not observed
 * because its two sides were not one population.
 */

import {
  repRole,
  type CallCredit,
  type RepRole,
} from "@/lib/services/call-credit";
import { GOAL_CHANNELS } from "@/lib/services/channel-targets";
import {
  pct,
  sumObserved,
  type ChannelFact,
} from "@/lib/services/channel-report-rollup";
import type { Period } from "@/lib/services/goal-pace";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export const SELF_BOOKED_LABEL = "No setter (self-booked)";
export const NO_HOST_LABEL = "No Calendly host on record";

/** A Close lead with a first sales call booked: the booked-call basis. */
export type FunnelLeadRow = {
  lead_id: string;
  display_name: string | null;
  email: string | null;
  funnel: string | null;
  first_sales_call_booked_date: string | null;
  first_call_show_up: string | null;
  status_label: string | null;
  setter_name: string | null;
};

/** A Calendly booking with who set it already resolved. */
export type CreditedBooking = {
  email: string | null;
  bookedAt: string | null;
  startAt: string | null;
  calendar: string | null;
  canceled: boolean;
  credit: CallCredit;
};

/** A Calendly booking with the people on the calendar it landed on. */
export type HostedBooking = {
  email: string | null;
  calendar: string | null;
  startAt: string | null;
  canceled: boolean;
  hosts: string[];
};

export type Outcome = {
  /** Close has a show-up answer at all. */
  showKnown: boolean;
  showed: boolean;
  /** Reached a closing stage: Contract Sent or Closed / Won. */
  closed: boolean;
  won: boolean;
};

/**
 * Close stores status labels with an emoji prefix ("🏆 Closed / Won"). Matching
 * on the words keeps this stable if the emoji changes and lets a test write
 * the plain label.
 */
export function outcomeOf(lead: FunnelLeadRow): Outcome {
  const showUp = lead.first_call_show_up?.trim().toLowerCase() ?? "";
  const status = lead.status_label?.toLowerCase() ?? "";
  const won = /closed\s*\/\s*won/.test(status);
  return {
    showKnown: showUp.length > 0,
    showed: showUp === "yes",
    closed: won || /contract sent/.test(status),
    won,
  };
}

/** Rate as a whole percent, null unless both sides observed and it is at most 100. */
export function rateOf(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  const value = Math.round((numerator / denominator) * 100);
  return value > 100 ? null : value;
}

/** spend ÷ count to the cent; null when either side is unobserved or zero. */
export function costPer(
  spend: number | null,
  count: number | null,
): number | null {
  if (spend == null || count == null || count === 0) return null;
  return Math.round((spend / count) * 100) / 100;
}

function within(day: string | null | undefined, period: Period): boolean {
  if (!day) return false;
  const key = day.slice(0, 10);
  return key >= period.start && key <= period.end;
}

function emailKey(email: string | null | undefined): string | null {
  const key = email?.trim().toLowerCase();
  return key || null;
}

/**
 * The calendars a first sales call lands on. Onboarding, Next Steps,
 * Follow-Up, Momentum, Connect and Rescheduled calendars hold second and later
 * calls, and generic "30 Minute Meeting" slots are not sales calls at all.
 */
export function isFirstCallCalendar(name: string | null | undefined): boolean {
  const key = name?.trim().toLowerCase() ?? "";
  if (!key) return false;
  return !/onboard|next step|follow|resched|momentum|connect|minute meeting/.test(
    key,
  );
}

// ---------------------------------------------------------------------------
// Setters (Lane 1)
// ---------------------------------------------------------------------------

export type PersonRow = {
  who: string;
  role: RepRole;
  /** Calls credited to this person, whether or not Close has them as a first call yet. */
  set: number;
  recorded: number;
  tagged: number;
  inferred: number;
  /** Of `set`, the ones that are a Close first sales call booked in the period. */
  booked: number;
  showKnown: number;
  showed: number;
  closed: number;
  won: number;
};

export type SettersReport = {
  rows: PersonRow[];
  selfBooked: PersonRow;
  total: PersonRow;
  /** The reactivation team's booked-call target for the period, null before the plan starts. */
  target: number | null;
  /** Setters credited with calls who are on neither roster list. */
  unclassified: string[];
};

function emptyPerson(who: string): PersonRow {
  return {
    who,
    role: repRole(who),
    set: 0,
    recorded: 0,
    tagged: 0,
    inferred: 0,
    booked: 0,
    showKnown: 0,
    showed: 0,
    closed: 0,
    won: 0,
  };
}

function addBasis(row: PersonRow, credit: CallCredit): void {
  row.set += 1;
  if (credit.basis === "tag") row.tagged += 1;
  else if (credit.basis === "touch") row.inferred += 1;
  else row.recorded += 1;
}

function addOutcome(row: PersonRow, outcome: Outcome): void {
  row.booked += 1;
  if (outcome.showKnown) row.showKnown += 1;
  if (outcome.showed) row.showed += 1;
  if (outcome.closed) row.closed += 1;
  if (outcome.won) row.won += 1;
}

/**
 * The Calendly booking that stands for this Close first call: a first-call
 * calendar that was not canceled, else any first-call calendar, else whatever
 * booking the address has. Earliest first, because a reschedule is the same
 * call set once.
 */
function bestBooking(
  bookings: CreditedBooking[] | undefined,
): CreditedBooking | null {
  if (!bookings?.length) return null;
  const sorted = [...bookings].sort((a, b) =>
    (a.bookedAt ?? a.startAt ?? "").localeCompare(
      b.bookedAt ?? b.startAt ?? "",
    ),
  );
  return (
    sorted.find((b) => isFirstCallCalendar(b.calendar) && !b.canceled) ??
    sorted.find((b) => isFirstCallCalendar(b.calendar)) ??
    sorted[0] ??
    null
  );
}

/**
 * Who set a Close first call.
 *
 * Calendly's own record and a setter's tagged link come first, exactly as on
 * the bookings page. Close's "Reactivation - Setter Name" comes next and, on
 * this page only, outranks a channel tag on the link: these are Close's own
 * bookings, and a reactivation lead a setter is named on was reached by that
 * setter however the link was tagged. The inferred touch stays last, and a
 * lead nothing names is self-booked.
 */
function creditForLead(
  lead: FunnelLeadRow,
  booking: CreditedBooking | null,
): CallCredit {
  const credit = booking?.credit;
  if (credit?.kind === "rep" && credit.basis !== "touch") return credit;
  const closeSetter = lead.setter_name?.trim();
  if (closeSetter) {
    return {
      kind: "rep",
      basis: "close",
      who: closeSetter,
      evidence: "Recorded in Close as the setter who booked this call.",
      repUri: null,
    };
  }
  if (credit) return credit;
  return {
    kind: "untagged",
    who: "No tag",
    evidence: "Nothing on the booking names who set it.",
    repUri: null,
  };
}

export function buildSetters(input: {
  leads: FunnelLeadRow[];
  bookings: CreditedBooking[];
  period: Period;
  months: number;
  targetsApply: boolean;
}): SettersReport {
  const byEmail = new Map<string, CreditedBooking[]>();
  for (const booking of input.bookings) {
    const key = emailKey(booking.email);
    if (!key) continue;
    const list = byEmail.get(key);
    if (list) list.push(booking);
    else byEmail.set(key, [booking]);
  }

  const people = new Map<string, PersonRow>();
  const person = (who: string) => {
    const existing = people.get(who);
    if (existing) return existing;
    const created = emptyPerson(who);
    people.set(who, created);
    return created;
  };
  const selfBooked = emptyPerson(SELF_BOOKED_LABEL);
  const total = emptyPerson("All setters");
  const leadEmails = new Set<string>();

  for (const lead of input.leads) {
    if (!within(lead.first_sales_call_booked_date, input.period)) continue;
    const key = emailKey(lead.email);
    if (key) leadEmails.add(key);
    const booking = bestBooking(key ? byEmail.get(key) : undefined);
    const credit = creditForLead(lead, booking);
    const outcome = outcomeOf(lead);
    const row = credit.kind === "rep" ? person(credit.who) : selfBooked;
    addBasis(row, credit);
    addOutcome(row, outcome);
    if (credit.kind === "rep") {
      addBasis(total, credit);
      addOutcome(total, outcome);
    }
  }

  // Calls a rep set in the period that Close does not (yet) hold as a first
  // sales call: a second call, a lead still syncing, or a calendar Close never
  // sees. Counted as Set, not Booked, one per address.
  const seen = new Set<string>();
  for (const booking of input.bookings) {
    if (booking.credit.kind !== "rep") continue;
    if (!within(booking.bookedAt ?? booking.startAt, input.period)) continue;
    const key = emailKey(booking.email);
    if (!key || leadEmails.has(key) || seen.has(key)) continue;
    seen.add(key);
    addBasis(person(booking.credit.who), booking.credit);
    addBasis(total, booking.credit);
  }

  const rows = [...people.values()].sort(
    (a, b) =>
      b.booked - a.booked || b.set - a.set || a.who.localeCompare(b.who),
  );
  const lane = GOAL_CHANNELS.find((channel) => channel.key === "lane-2");
  return {
    rows,
    selfBooked,
    total,
    target:
      input.targetsApply && lane?.target != null
        ? lane.target * input.months
        : null,
    unclassified: rows
      .filter((row) => row.role === "unclassified")
      .map((row) => row.who),
  };
}

// ---------------------------------------------------------------------------
// Closers (Lane 2)
// ---------------------------------------------------------------------------

export type CloserRow = {
  who: string;
  /** First calls on this person's calendar in the period, cancellations included. */
  booked: number;
  canceled: number;
  /** Of `booked`, the ones whose address has a Close first-call record. */
  matched: number;
  showKnown: number;
  showed: number;
  closed: number;
  won: number;
};

export type ClosersReport = {
  rows: CloserRow[];
  /** Close first calls booked in the period with no Calendly booking at all. */
  noHost: CloserRow;
  total: CloserRow;
};

/** A team calendar, not a person. */
const NOT_A_CLOSER = new Set(["onboarding team"]);

function emptyCloser(who: string): CloserRow {
  return {
    who,
    booked: 0,
    canceled: 0,
    matched: 0,
    showKnown: 0,
    showed: 0,
    closed: 0,
    won: 0,
  };
}

function addCloserOutcome(row: CloserRow, outcome: Outcome | null): void {
  if (!outcome) return;
  row.matched += 1;
  if (outcome.showKnown) row.showKnown += 1;
  if (outcome.showed) row.showed += 1;
  if (outcome.closed) row.closed += 1;
  if (outcome.won) row.won += 1;
}

/**
 * Windowed on when the call HAPPENS, not when it was booked: show, close and
 * won are things that happen on the call. `leads` should therefore reach back
 * before the period, since a September call may have been booked in August.
 */
export function buildClosers(input: {
  leads: FunnelLeadRow[];
  hosted: HostedBooking[];
  period: Period;
}): ClosersReport {
  const leadByEmail = new Map<string, FunnelLeadRow>();
  for (const lead of input.leads) {
    const key = emailKey(lead.email);
    if (key && !leadByEmail.has(key)) leadByEmail.set(key, lead);
  }

  const hosts = new Map<string, CloserRow>();
  const total = emptyCloser("All closers");
  const hostedEmails = new Set<string>();

  for (const booking of input.hosted) {
    if (!isFirstCallCalendar(booking.calendar)) continue;
    const key = emailKey(booking.email);
    if (key) hostedEmails.add(key);
    if (!within(booking.startAt, input.period)) continue;
    const names = booking.hosts.filter(
      (name) => name.trim() && !NOT_A_CLOSER.has(name.trim().toLowerCase()),
    );
    if (names.length === 0) continue;
    const lead = key ? leadByEmail.get(key) : undefined;
    const outcome = lead ? outcomeOf(lead) : null;
    for (const name of names) {
      const row = hosts.get(name) ?? emptyCloser(name);
      hosts.set(name, row);
      row.booked += 1;
      if (booking.canceled) row.canceled += 1;
      addCloserOutcome(row, outcome);
    }
    total.booked += 1;
    if (booking.canceled) total.canceled += 1;
    addCloserOutcome(total, outcome);
  }

  const noHost = emptyCloser(NO_HOST_LABEL);
  for (const lead of input.leads) {
    if (!within(lead.first_sales_call_booked_date, input.period)) continue;
    const key = emailKey(lead.email);
    if (key && hostedEmails.has(key)) continue;
    noHost.booked += 1;
    addCloserOutcome(noHost, outcomeOf(lead));
  }

  return {
    rows: [...hosts.values()].sort(
      (a, b) => b.booked - a.booked || a.who.localeCompare(b.who),
    ),
    noHost,
    total,
  };
}

// ---------------------------------------------------------------------------
// Webinars
// ---------------------------------------------------------------------------

export const ATTENDANCE_TARGET_PCT = 25;
export const OFFER_TARGET_PCT = 65;

export type WebinarEventRow = {
  date: string;
  label: string;
  format: string;
  registrations: number | null;
  attendees: number | null;
  attendees_at_offer: number | null;
  /** Absent until the booked_ever migration is applied in production. */
  booked_ever?: number | null;
  showed: number | null;
  won: number | null;
};

export type WebinarRow = {
  date: string;
  label: string;
  format: string;
  registrations: number | null;
  attendees: number | null;
  attendanceRate: number | null;
  attendeesAtOffer: number | null;
  offerRate: number | null;
  booked: number | null;
  showed: number | null;
  won: number | null;
  spend: number | null;
  costPerRegistration: number | null;
  costPerBooked: number | null;
  /** The spend window, for the hover. */
  spendFrom: string;
};

export type WebinarsReport = {
  rows: WebinarRow[];
  total: WebinarRow | null;
};

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Spend for a webinar is every Webinar-channel dollar from the day after the
 * previous webinar through the webinar itself, so a week of ads buys one
 * event and the month's spend adds up across rows. `events` should include
 * the webinar before the period so the first row's window has a start.
 */
export function buildWebinars(input: {
  events: WebinarEventRow[];
  spend: Array<Pick<ChannelFact, "day" | "channel" | "spend">>;
  period: Period;
}): WebinarsReport {
  const events = [...input.events].sort((a, b) => a.date.localeCompare(b.date));
  const webinarSpend = input.spend.filter((fact) => fact.channel === "Webinar");

  const rows: WebinarRow[] = [];
  events.forEach((event, index) => {
    if (!within(event.date, input.period)) return;
    const previous = events[index - 1];
    const spendFrom = previous ? nextDay(previous.date) : input.period.start;
    const spend = sumObserved(
      webinarSpend
        .filter((fact) => fact.day >= spendFrom && fact.day <= event.date)
        .map((fact) => fact.spend),
    );
    const booked = event.booked_ever ?? null;
    rows.push({
      date: event.date,
      label: event.label,
      format: event.format,
      registrations: event.registrations,
      attendees: event.attendees,
      attendanceRate: capped(pct(event.attendees, event.registrations)),
      attendeesAtOffer: event.attendees_at_offer,
      offerRate: capped(pct(event.attendees_at_offer, event.attendees)),
      booked,
      showed: event.showed,
      won: event.won,
      spend,
      costPerRegistration: costPer(spend, event.registrations),
      costPerBooked: costPer(spend, booked),
      spendFrom,
    });
  });
  rows.sort((a, b) => b.date.localeCompare(a.date));

  if (rows.length === 0) return { rows, total: null };
  const sum = (pick: (row: WebinarRow) => number | null) =>
    sumObserved(rows.map(pick));
  const registrations = sum((row) => row.registrations);
  const attendees = sum((row) => row.attendees);
  const atOffer = sum((row) => row.attendeesAtOffer);
  const booked = sum((row) => row.booked);
  const spend = sum((row) => row.spend);
  return {
    rows,
    total: {
      date: "",
      label: `${rows.length} ${rows.length === 1 ? "webinar" : "webinars"}`,
      format: "",
      registrations,
      attendees,
      attendanceRate: capped(pct(attendees, registrations)),
      attendeesAtOffer: atOffer,
      offerRate: capped(pct(atOffer, attendees)),
      booked,
      showed: sum((row) => row.showed),
      won: sum((row) => row.won),
      spend,
      costPerRegistration: costPer(spend, registrations),
      costPerBooked: costPer(spend, booked),
      spendFrom: rows[rows.length - 1]?.spendFrom ?? input.period.start,
    },
  };
}

function capped(value: number | null): number | null {
  return value != null && value > 100 ? null : value;
}

// ---------------------------------------------------------------------------
// Socials
// ---------------------------------------------------------------------------

export const IG_POSTS_PER_WEEK_TARGET = 12;

/** Metricool brands that belong to a person (mirrors BRAND_OWNER in metricool-sync.ts). */
const BRAND_PERSON: Record<string, "mike" | "anthony"> = {
  "6633336": "mike",
  "6633345": "anthony",
};

export type PostRow = {
  network: string;
  brand_id: string | null;
  published_at: string;
};

export type VideoDayRow = { day: string; views: number | null };

export type WeekRow = {
  /** Monday, YYYY-MM-DD. */
  start: string;
  /** Sunday, YYYY-MM-DD. */
  end: string;
  /** The week has fully elapsed, so the target applies. */
  complete: boolean;
  igMike: number;
  igAnthony: number;
  facebook: number;
  linkedin: number;
  x: number;
  youtubeUploads: number;
  youtubeViews: number | null;
};

export type SocialsReport = {
  weeks: WeekRow[];
  total: WeekRow;
};

function mondayOf(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Monday-to-Sunday weeks that touch the period. A week straddling a month
 * edge is counted whole, so its post count means what "12 a week" means; the
 * page says so. Posts are counted by the day they were published, UTC.
 */
export function buildSocials(input: {
  posts: PostRow[];
  views: VideoDayRow[];
  period: Period;
  today: string;
}): SocialsReport {
  const weeks: WeekRow[] = [];
  for (
    let start = mondayOf(input.period.start);
    start <= input.period.end;
    start = addDays(start, 7)
  ) {
    const end = addDays(start, 6);
    weeks.push({
      start,
      end,
      complete: end < input.today,
      igMike: 0,
      igAnthony: 0,
      facebook: 0,
      linkedin: 0,
      x: 0,
      youtubeUploads: 0,
      youtubeViews: null,
    });
  }
  const weekFor = (day: string) =>
    weeks.find((week) => day >= week.start && day <= week.end);

  for (const post of input.posts) {
    const week = weekFor(post.published_at.slice(0, 10));
    if (!week) continue;
    const network = post.network.toLowerCase();
    const person = post.brand_id ? BRAND_PERSON[post.brand_id] : undefined;
    if (network === "instagram") {
      if (person === "mike") week.igMike += 1;
      else if (person === "anthony") week.igAnthony += 1;
    } else if (network === "facebook") week.facebook += 1;
    else if (network === "linkedin") week.linkedin += 1;
    else if (network === "twitter" || network === "x") week.x += 1;
    else if (network === "youtube") week.youtubeUploads += 1;
  }
  for (const row of input.views) {
    const week = weekFor(row.day);
    if (!week || row.views == null) continue;
    week.youtubeViews = (week.youtubeViews ?? 0) + row.views;
  }

  const total: WeekRow = {
    start: input.period.start,
    end: input.period.end,
    complete: input.period.end < input.today,
    igMike: weeks.reduce((sum, week) => sum + week.igMike, 0),
    igAnthony: weeks.reduce((sum, week) => sum + week.igAnthony, 0),
    facebook: weeks.reduce((sum, week) => sum + week.facebook, 0),
    linkedin: weeks.reduce((sum, week) => sum + week.linkedin, 0),
    x: weeks.reduce((sum, week) => sum + week.x, 0),
    youtubeUploads: weeks.reduce((sum, week) => sum + week.youtubeUploads, 0),
    youtubeViews: sumObserved(weeks.map((week) => week.youtubeViews)),
  };
  return { weeks: weeks.sort((a, b) => b.start.localeCompare(a.start)), total };
}

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------

export const AD_CHANNELS = ["Google Ads", "Meta Ads", "Webinar"] as const;

export type AdsCampaign = {
  key: string;
  label: string;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  leads: number | null;
  booked: number | null;
  costPerLead: number | null;
  costPerBooked: number | null;
};

export type AdsChannel = AdsCampaign & {
  channel: string;
  campaigns: AdsCampaign[];
};

export type AdsReport = { channels: AdsChannel[] };

const PLACEHOLDER_CONTENT = new Set(["(not set)", "unattributed", "(none)"]);

function campaignFrom(key: string, facts: ChannelFact[]): AdsCampaign {
  // Spend rows carry the platform's campaign name in `content`; lead rows
  // carry the utm slug as the campaign itself and a placeholder in `content`
  // ("unattributed", "(not set)"), sometimes with a zero spend written beside
  // it. Only a row that actually spent money can name the campaign.
  const named = facts.find(
    (fact) =>
      (fact.spend ?? 0) > 0 &&
      fact.content &&
      !PLACEHOLDER_CONTENT.has(fact.content.toLowerCase()),
  );
  const spend = sumObserved(facts.map((fact) => fact.spend));
  const leads = sumObserved(facts.map((fact) => fact.leads));
  const booked = sumObserved(facts.map((fact) => fact.booked));
  return {
    key,
    label: named?.content ?? key,
    spend,
    impressions: sumObserved(facts.map((fact) => fact.impressions)),
    clicks: sumObserved(facts.map((fact) => fact.clicks)),
    leads,
    booked,
    costPerLead: costPer(spend, leads),
    costPerBooked: costPer(spend, booked),
  };
}

/**
 * Per campaign within each paid channel. Google keys spend and leads by the
 * same campaign id, so its campaign rows carry a real cost per lead. Meta
 * keys spend by platform campaign id and leads by the link's utm slug, so a
 * Meta campaign row has one side or the other and its cost per lead is only
 * honest at the channel line.
 */
export function buildAds(input: { facts: ChannelFact[] }): AdsReport {
  const channels: AdsChannel[] = [];
  for (const channel of AD_CHANNELS) {
    const mine = input.facts.filter((fact) => fact.channel === channel);
    if (mine.length === 0) continue;
    const byCampaign = new Map<string, ChannelFact[]>();
    for (const fact of mine) {
      const list = byCampaign.get(fact.campaign);
      if (list) list.push(fact);
      else byCampaign.set(fact.campaign, [fact]);
    }
    const campaigns = [...byCampaign.entries()]
      .map(([key, facts]) => campaignFrom(key, facts))
      .filter(
        (row) =>
          row.spend != null || (row.leads ?? 0) > 0 || (row.booked ?? 0) > 0,
      )
      .sort(
        (a, b) =>
          (b.spend ?? -1) - (a.spend ?? -1) ||
          (b.leads ?? -1) - (a.leads ?? -1) ||
          a.label.localeCompare(b.label),
      );
    channels.push({
      ...campaignFrom(channel, mine),
      label: channel,
      channel,
      campaigns,
    });
  }
  return { channels };
}
