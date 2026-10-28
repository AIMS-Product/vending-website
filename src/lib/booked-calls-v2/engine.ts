import {
  ACTIVE_STATUSES,
  CANCEL_OUTCOMES,
  CANCEL_STATUSES,
  CANCELED_TITLE,
  EPISODE_MS,
  EXCLUDED_CALLERS,
  FIRST_CALL_FAMILIES,
  FOLLOW_UP_TITLE,
  NOT_SALES_TITLE,
  PEARL_SOURCE_TITLES,
  RULE_VERSION,
  SETTER_ONLY_CALLERS,
  SOCIAL_DM_SETTER,
  PEARL_SOCIAL_UTM_SOURCES,
  TIME_ZONE,
  TITLE_MAP,
  type BookedBy,
} from "@/lib/booked-calls-v2/rules";
import {
  resolveOrigin,
  type LeadOriginFacts,
  type Origin,
} from "@/lib/booked-calls-v2/sources";

/** Canonical V2: Marketing counts eligible activities directly. Lane 2 / Social
 * DMs share a rolling 720-hour clock advanced by EVERY noncanceled scheduled
 * history meeting, including noncandidates and held statuses. Full history is
 * current source state; only candidate date_created is fenced by [from,to). */

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
  /** Immediately preceding noncanceled scheduled history meeting. */
  precedingMeetingId: string | null;
  /** Elapsed whole days from the preceding meeting's scheduled start. */
  intervalDays: number | null;
  ruleVersion: typeof RULE_VERSION;
};

/** Reject naive timestamps instead of letting the server's timezone decide. */
export function timestamp(iso: string | null | undefined): number {
  return iso && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? Date.parse(iso) : NaN;
}
export function pacificDay(iso: string): string {
  const ms = timestamp(iso);
  return Number.isFinite(ms)
    ? new Date(ms).toLocaleDateString("en-CA", { timeZone: TIME_ZONE })
    : "";
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
  (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

function classifyTitle(m: Meeting, lead: LeadFacts | undefined): TitleVerdict {
  const title = m.title ?? "";
  const mapped = TITLE_MAP.find(
    (rule) =>
      rule.pattern.test(title) &&
      (!rule.retiredAt ||
        !(timestamp(m.dateCreated) >= timestamp(rule.retiredAt))) &&
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
    lead?.contactUtms.some((c) =>
      PEARL_SOCIAL_UTM_SOURCES.has((c.source ?? "").trim().toLowerCase()),
    ) &&
    PEARL_SOURCE_TITLES.some((re) => re.test(title))
  ) {
    return {
      kind: "mapped",
      bookedBy: "Social DMs",
      setter: SOCIAL_DM_SETTER,
      exception: null,
    };
  }
  if (NOT_SALES_TITLE.test(title)) return { kind: "not_sales_call" };
  if (FOLLOW_UP_TITLE.test(title)) return { kind: "follow_up" };
  if (FIRST_CALL_FAMILIES.some((re) => re.test(title))) {
    if (
      m.userId &&
      (SETTER_ONLY_CALLERS.has(m.userId) || EXCLUDED_CALLERS.has(m.userId))
    )
      return { kind: "not_sales_call" };
    return { kind: "family" };
  }
  return { kind: "unapproved" };
}

export function isCanceled(m: Meeting): boolean {
  return (
    CANCEL_STATUSES.has((m.status ?? "").trim().toLowerCase()) ||
    CANCEL_OUTCOMES.has((m.outcome ?? "").trim().toLowerCase()) ||
    CANCELED_TITLE.test((m.title ?? "").trim())
  );
}

/** Scheduled start, then earliest created, then activity id. */
function byScheduled(a: Meeting, b: Meeting): number {
  return (
    timestamp(a.startsAt) - timestamp(b.startsAt) ||
    (Number.isFinite(timestamp(a.dateCreated))
      ? timestamp(a.dateCreated)
      : Number.MAX_VALUE) -
      (Number.isFinite(timestamp(b.dateCreated))
        ? timestamp(b.dateCreated)
        : Number.MAX_VALUE) ||
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
  const fromMs = timestamp(input.from);
  const toMs = timestamp(input.to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs)
    throw new Error("Invalid V2 creation window");
  const candidates = new Set<string>();
  const byLead = new Map<string, Meeting[]>();
  for (const m of input.meetings) {
    if (!m.leadId) continue;
    const created = timestamp(m.dateCreated);
    if (created >= fromMs && created < toMs) candidates.add(m.id);
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
  const hasStart = (m: Meeting) => Number.isFinite(timestamp(m.startsAt));
  // Untimed meetings are only ever held; the rest walk in scheduled order.
  const ordered = [
    ...meetings.filter((m) => !hasStart(m)),
    ...meetings.filter(hasStart).sort(byScheduled),
  ];
  let anchor: Meeting | null = null;

  for (const m of ordered) {
    const verdict = classifyTitle(m, lead);
    const startMs = timestamp(m.startsAt);
    const base = {
      meetingId: m.id,
      leadId: m.leadId,
      createdDay: pacificDay(m.dateCreated),
      scheduledDay: Number.isNaN(startMs) ? null : pacificDay(m.startsAt!),
      bookedBy:
        verdict.kind === "mapped"
          ? verdict.bookedBy
          : verdict.kind === "family"
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
        ? Math.floor((startMs - timestamp(anchor.startsAt)) / 86_400_000)
        : null,
      ruleVersion: RULE_VERSION,
    };
    const push = (disposition: Disposition, reason: Reason) =>
      out.push({ ...base, disposition, reason });

    if (Number.isNaN(startMs)) push("held", "missing_timestamp");
    else if (isCanceled(m)) push("excluded", "canceled");
    else {
      if (!ACTIVE_STATUSES.has((m.status ?? "").trim().toLowerCase()))
        push("held", "unknown_status");
      else if (verdict.kind === "not_sales_call")
        push("excluded", "not_sales_call");
      else if (verdict.kind === "follow_up")
        push("excluded", "follow_up_title");
      else if (verdict.kind === "unapproved")
        push("excluded", "unapproved_title");
      else if (verdict.kind === "family") push("counted", "counted");
      else if (anchor && startMs - timestamp(anchor.startsAt) <= EPISODE_MS)
        push("excluded", "within_episode");
      else push("counted", "counted");
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
    const origin = d.origin.source ?? "Unknown (Needs Review)";
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
