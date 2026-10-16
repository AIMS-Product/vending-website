import {
  ACTIVE_STATUSES,
  CANCEL_OUTCOMES,
  CANCEL_STATUSES,
  CANCELED_TITLE,
  EPISODE_MS,
  EXCLUDED_CALLERS,
  FIRST_CALL_FAMILIES,
  FOLLOW_UP_TITLE,
  HISTORICAL_CUTOFF,
  NOT_SALES_TITLE,
  PEARL_SOURCE_TITLES,
  RULE_VERSION,
  SETTER_ONLY_CALLERS,
  SOCIAL_DM_SETTER,
  TIME_ZONE,
  TITLE_MAP,
  type BookedBy,
} from "@/lib/booked-calls-v2/rules";
import {
  resolveOrigin,
  type LeadOriginFacts,
  type Origin,
} from "@/lib/booked-calls-v2/sources";

/**
 * Booked calls V2 (`booked_calls.v2.6-scheduled-anchor-candidate`): one
 * decision per Close meeting created in the period. Pure. The caller passes
 * every retained meeting for each candidate lead, because a credit before the
 * window can still open the episode a candidate falls in.
 *
 * One credit per lead episode: the first eligible meeting by scheduled start
 * (ties: earliest created, then id) is credited, and no other meeting
 * scheduled within 30 x 24 hours of that start earns a second. Canceled,
 * declined and held meetings never start or reset the timer. A No Show keeps
 * its credit; its reschedule falls inside the episode. Notes are never read.
 */

export type Meeting = {
  id: string;
  leadId: string;
  userId: string | null;
  userName: string | null;
  title: string | null;
  status: string | null;
  outcome: string | null;
  startsAt: string | null;
  dateCreated: string;
};

export type LeadFacts = LeadOriginFacts & {
  setterName: string | null;
  businessLine: string | null;
};

export type Disposition = "counted" | "excluded" | "held";

export type Reason =
  | "counted"
  | "canceled"
  | "follow_up_title"
  | "unapproved_title"
  | "within_episode"
  | "not_sales_call"
  | "source_unavailable"
  | "unknown_status"
  | "missing_timestamp";

export type Decision = {
  meetingId: string;
  leadId: string;
  /** Close `date_created`, Pacific calendar day: the MTD date. */
  createdDay: string;
  scheduledDay: string | null;
  disposition: Disposition;
  reason: Reason;
  /** Kept on excluded and held rows as evidence; only counted rows add up. */
  bookedBy: BookedBy | null;
  mappedSetter: string | null;
  currentSetter: string | null;
  caller: string | null;
  origin: Origin;
  offer: string | null;
  historicalException: string | null;
  /** The credited meeting whose episode this one falls in. */
  precedingMeetingId: string | null;
  /** Whole days from that credit's scheduled start to this one's. */
  intervalDays: number | null;
  ruleVersion: typeof RULE_VERSION;
};

export function pacificDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

type TitleVerdict =
  | {
      kind: "mapped";
      bookedBy: BookedBy;
      setter: string;
      exception: string | null;
    }
  | { kind: "family" }
  | { kind: "follow_up" }
  | { kind: "not_sales_call" }
  | { kind: "unapproved" };

const same = (a: string | null | undefined, b: string) =>
  (a ?? "").trim().toLowerCase() === b.toLowerCase();

function classifyTitle(m: Meeting, lead: LeadFacts | undefined): TitleVerdict {
  const title = (m.title ?? "").trim();
  const beforeCutoff =
    Date.parse(m.dateCreated) < Date.parse(HISTORICAL_CUTOFF);
  const mapped = TITLE_MAP.find(
    (rule) =>
      rule.pattern.test(title) &&
      (!rule.historical || beforeCutoff) &&
      (!rule.requiredSetter || same(lead?.setterName, rule.requiredSetter)),
  );
  if (mapped) {
    return {
      kind: "mapped",
      bookedBy: mapped.bookedBy,
      setter: mapped.setter,
      exception: mapped.historical ? mapped.key : null,
    };
  }
  if (
    same(lead?.setterName, SOCIAL_DM_SETTER) &&
    PEARL_SOURCE_TITLES.some((re) => re.test(title))
  ) {
    return {
      kind: "mapped",
      bookedBy: "Social DMs",
      setter: SOCIAL_DM_SETTER,
      exception: null,
    };
  }
  if (m.userId && SETTER_ONLY_CALLERS.has(m.userId))
    return { kind: "not_sales_call" };
  if (NOT_SALES_TITLE.test(title)) return { kind: "not_sales_call" };
  if (FOLLOW_UP_TITLE.test(title)) return { kind: "follow_up" };
  if (FIRST_CALL_FAMILIES.some((re) => re.test(title)))
    return { kind: "family" };
  return { kind: "unapproved" };
}

function isCanceled(m: Meeting): boolean {
  return (
    CANCEL_STATUSES.has((m.status ?? "").toLowerCase()) ||
    CANCEL_OUTCOMES.has((m.outcome ?? "").trim().toLowerCase()) ||
    CANCELED_TITLE.test((m.title ?? "").trim())
  );
}

/** Scheduled start, then earliest created, then activity id. */
function byScheduled(a: Meeting, b: Meeting): number {
  return (
    Date.parse(a.startsAt!) - Date.parse(b.startsAt!) ||
    Date.parse(a.dateCreated) - Date.parse(b.dateCreated) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

export function evaluate(input: {
  /** Every retained meeting for the candidate leads, any creation date. */
  meetings: readonly Meeting[];
  leads: ReadonlyMap<string, LeadFacts>;
  /** Creation window, ISO, [from, to). `to` is the snapshot fence. */
  from: string;
  to: string;
}): Decision[] {
  const fromMs = Date.parse(input.from);
  const toMs = Date.parse(input.to);
  const candidates = new Set<string>();
  const byLead = new Map<string, Meeting[]>();
  for (const m of input.meetings) {
    const created = Date.parse(m.dateCreated);
    // A snapshot sees only meetings that existed at its fence: one created
    // later must not take an earlier candidate's credit.
    if (created >= toMs) continue;
    if (created >= fromMs) candidates.add(m.id);
    const list = byLead.get(m.leadId) ?? [];
    list.push(m);
    byLead.set(m.leadId, list);
  }
  return [...byLead]
    .flatMap(([leadId, meetings]) =>
      decideLead(meetings, input.leads.get(leadId)),
    )
    .filter((d) => candidates.has(d.meetingId))
    .sort((a, b) => (a.meetingId < b.meetingId ? -1 : 1));
}

function decideLead(
  meetings: readonly Meeting[],
  lead: LeadFacts | undefined,
): Decision[] {
  const origin = resolveOrigin(lead);
  const out: Decision[] = [];
  const hasStart = (m: Meeting) => !Number.isNaN(Date.parse(m.startsAt ?? ""));
  // Untimed meetings are only ever held; the rest walk in scheduled order.
  const ordered = [
    ...meetings.filter((m) => !hasStart(m)),
    ...meetings.filter(hasStart).sort(byScheduled),
  ];
  let anchor: Meeting | null = null;

  for (const m of ordered) {
    const verdict = classifyTitle(m, lead);
    const startMs = m.startsAt ? Date.parse(m.startsAt) : NaN;
    const base = {
      meetingId: m.id,
      leadId: m.leadId,
      createdDay: pacificDay(m.dateCreated),
      scheduledDay: Number.isNaN(startMs) ? null : pacificDay(m.startsAt!),
      bookedBy:
        verdict.kind === "mapped"
          ? verdict.bookedBy
          : verdict.kind === "family" && origin.source
            ? ("Marketing" as const)
            : null,
      mappedSetter: verdict.kind === "mapped" ? verdict.setter : null,
      currentSetter: lead?.setterName ?? null,
      caller: m.userName,
      origin,
      offer: lead?.businessLine ?? null,
      historicalException: verdict.kind === "mapped" ? verdict.exception : null,
      precedingMeetingId: anchor?.id ?? null,
      intervalDays: anchor
        ? Math.floor((startMs - Date.parse(anchor.startsAt!)) / 86_400_000)
        : null,
      ruleVersion: RULE_VERSION,
    };
    const push = (disposition: Disposition, reason: Reason) =>
      out.push({ ...base, disposition, reason });

    if (Number.isNaN(startMs)) push("held", "missing_timestamp");
    else if (m.userId && EXCLUDED_CALLERS.has(m.userId))
      push("excluded", "not_sales_call");
    else if (isCanceled(m)) push("excluded", "canceled");
    else if (!ACTIVE_STATUSES.has((m.status ?? "").toLowerCase()))
      push("held", "unknown_status");
    else if (verdict.kind === "follow_up") push("excluded", "follow_up_title");
    else if (verdict.kind === "not_sales_call")
      push("excluded", "not_sales_call");
    else if (verdict.kind === "unapproved")
      push("excluded", "unapproved_title");
    else if (anchor && startMs < Date.parse(anchor.startsAt!) + EPISODE_MS)
      push("excluded", "within_episode");
    else if (verdict.kind === "family" && !origin.source)
      push("held", "source_unavailable");
    else {
      push("counted", "counted");
      anchor = m;
    }
  }
  return out;
}

export type V2Summary = {
  candidates: number;
  counted: number;
  excluded: number;
  held: number;
  byBookedBy: Record<BookedBy, number>;
  byReason: Partial<Record<Reason, number>>;
  /** origin label (or "Unknown") -> bucket -> counted bookings. */
  byOrigin: Record<string, Partial<Record<BookedBy, number>>>;
  byCreatedDay: Record<string, number>;
  historicalExceptions: number;
  unknownOrigin: number;
  unknownOffer: number;
  setterDisagreements: number;
};

export function summarize(decisions: readonly Decision[]): V2Summary {
  const summary: V2Summary = {
    candidates: decisions.length,
    counted: 0,
    excluded: 0,
    held: 0,
    byBookedBy: { Marketing: 0, "Lane 2": 0, "Social DMs": 0 },
    byReason: {},
    byOrigin: {},
    byCreatedDay: {},
    historicalExceptions: 0,
    unknownOrigin: 0,
    unknownOffer: 0,
    setterDisagreements: 0,
  };
  for (const d of decisions) {
    summary[d.disposition] += 1;
    summary.byReason[d.reason] = (summary.byReason[d.reason] ?? 0) + 1;
    if (
      d.mappedSetter &&
      d.currentSetter &&
      d.mappedSetter.toLowerCase() !== d.currentSetter.toLowerCase()
    ) {
      summary.setterDisagreements += 1;
    }
    if (d.disposition !== "counted" || !d.bookedBy) continue;
    summary.byBookedBy[d.bookedBy] += 1;
    const origin = d.origin.source ?? "Unknown";
    const row = (summary.byOrigin[origin] ??= {});
    row[d.bookedBy] = (row[d.bookedBy] ?? 0) + 1;
    summary.byCreatedDay[d.createdDay] =
      (summary.byCreatedDay[d.createdDay] ?? 0) + 1;
    if (d.historicalException) summary.historicalExceptions += 1;
    if (!d.origin.source) summary.unknownOrigin += 1;
    if (!d.offer) summary.unknownOffer += 1;
  }
  return summary;
}
