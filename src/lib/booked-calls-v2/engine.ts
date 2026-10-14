import {
  ACTIVE_STATUSES,
  CANCELED_OUTCOME,
  CANCELED_TITLE,
  EXCLUDED_CALLERS,
  FIRST_CALL_FAMILIES,
  HISTORICAL_CUTOFF,
  HISTORICAL_EXCEPTIONS,
  NON_NEW_CALL_TITLE,
  REPEAT_DAYS,
  RESCHEDULE_SIGNAL,
  RULE_VERSION,
  SETTER_ONLY_CALLERS,
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
 * Booked calls V2 (`booked_calls.v2.2`): one decision per Close meeting created
 * in the period. Pure. The caller passes every retained meeting for each
 * candidate lead, because the 60-day rule looks at the whole history before
 * any period filter (memo §3).
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
  rescheduleNote: boolean;
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
  | "repeat_within_60_days"
  | "not_sales_call"
  | "source_unavailable"
  | "unlinked_reschedule"
  | "ambiguous_simultaneous"
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
  precedingMeetingId: string | null;
  intervalDays: number | null;
  ruleVersion: typeof RULE_VERSION;
};

export function pacificDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

/** Whole Pacific calendar days between two instants (DST-safe). */
export function pacificDayGap(fromIso: string, toIso: string): number {
  const ms = (day: string) => Date.parse(`${day}T00:00:00Z`);
  return Math.round(
    (ms(pacificDay(toIso)) - ms(pacificDay(fromIso))) / 86_400_000,
  );
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

const FOLLOW_UP_ONLY = new RegExp(
  NON_NEW_CALL_TITLE.source.replace("|reschedul", ""),
  "i",
);

function classifyTitle(m: Meeting, lead: LeadFacts | undefined): TitleVerdict {
  const title = (m.title ?? "").trim();
  const mapped = TITLE_MAP.find((rule) => rule.pattern.test(title));
  if (mapped) {
    return {
      kind: "mapped",
      bookedBy: mapped.bookedBy,
      setter: mapped.setter,
      exception: null,
    };
  }
  if (Date.parse(m.dateCreated) < Date.parse(HISTORICAL_CUTOFF)) {
    const hit = HISTORICAL_EXCEPTIONS.find((e) =>
      e.matches(title, lead?.setterName ?? null),
    );
    if (hit) {
      const setter = hit.key.startsWith("ariella")
        ? "Ariella Irvine"
        : "William Nowak";
      return { kind: "mapped", bookedBy: "Lane 2", setter, exception: hit.key };
    }
  }
  if (m.userId && SETTER_ONLY_CALLERS.has(m.userId))
    return { kind: "not_sales_call" };
  const family = FIRST_CALL_FAMILIES.some((re) => re.test(title));
  if (FOLLOW_UP_ONLY.test(title)) return { kind: "follow_up" };
  if (family) return { kind: "family" };
  if (RESCHEDULE_SIGNAL.test(title)) return { kind: "follow_up" };
  return { kind: "unapproved" };
}

function isCanceled(m: Meeting): boolean {
  return (
    !ACTIVE_STATUSES.has((m.status ?? "").toLowerCase()) ||
    CANCELED_OUTCOME.test(m.outcome ?? "") ||
    CANCELED_TITLE.test((m.title ?? "").trim())
  );
}

function byScheduled(a: Meeting, b: Meeting): number {
  const diff = Date.parse(a.startsAt ?? "") - Date.parse(b.startsAt ?? "");
  return diff !== 0 ? diff : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
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
  const history = new Map<string, Meeting[]>();
  for (const m of input.meetings) {
    if (!m.startsAt || Number.isNaN(Date.parse(m.startsAt))) continue;
    // A snapshot sees only meetings that existed at its fence: one created
    // later must not become an earlier candidate's preceding meeting.
    if (Date.parse(m.dateCreated) >= toMs) continue;
    const list = history.get(m.leadId) ?? [];
    list.push(m);
    history.set(m.leadId, list);
  }
  for (const list of history.values()) list.sort(byScheduled);

  return input.meetings
    .filter((m) => {
      const created = Date.parse(m.dateCreated);
      return created >= fromMs && created < toMs;
    })
    .map((m) =>
      decide(m, history.get(m.leadId) ?? [], input.leads.get(m.leadId)),
    )
    .sort((a, b) => (a.meetingId < b.meetingId ? -1 : 1));
}

function decide(
  m: Meeting,
  history: readonly Meeting[],
  lead: LeadFacts | undefined,
): Decision {
  const verdict = classifyTitle(m, lead);
  const origin = resolveOrigin(lead);
  const index = history.findIndex((h) => h.id === m.id);
  const preceding = index > 0 ? history[index - 1] : null;
  const base: Decision = {
    meetingId: m.id,
    leadId: m.leadId,
    createdDay: pacificDay(m.dateCreated),
    scheduledDay: m.startsAt ? pacificDay(m.startsAt) : null,
    disposition: "excluded",
    reason: "counted",
    bookedBy:
      verdict.kind === "mapped"
        ? verdict.bookedBy
        : verdict.kind === "family" && origin.source
          ? "Marketing"
          : null,
    mappedSetter: verdict.kind === "mapped" ? verdict.setter : null,
    currentSetter: lead?.setterName ?? null,
    caller: m.userName,
    origin,
    offer: lead?.businessLine ?? null,
    historicalException: verdict.kind === "mapped" ? verdict.exception : null,
    precedingMeetingId: preceding?.id ?? null,
    intervalDays:
      preceding?.startsAt && m.startsAt
        ? pacificDayGap(preceding.startsAt, m.startsAt)
        : null,
    ruleVersion: RULE_VERSION,
  };
  const out = (disposition: Disposition, reason: Reason): Decision => ({
    ...base,
    disposition,
    reason,
  });

  if (!m.startsAt || index < 0) return out("held", "missing_timestamp");
  if (m.userId && EXCLUDED_CALLERS.has(m.userId))
    return out("excluded", "not_sales_call");
  if (isCanceled(m)) return out("excluded", "canceled");
  if (verdict.kind === "follow_up") return out("excluded", "follow_up_title");
  if (verdict.kind === "not_sales_call")
    return out("excluded", "not_sales_call");
  if (verdict.kind === "unapproved") return out("excluded", "unapproved_title");

  // Same lead, same start, another live meeting: duplicate, alternative or two
  // episodes cannot be told apart from Close, so neither is credited.
  const twin = history.some(
    (h) => h.id !== m.id && h.startsAt === m.startsAt && !isCanceled(h),
  );
  if (twin) return out("held", "ambiguous_simultaneous");
  if (RESCHEDULE_SIGNAL.test(m.title ?? "") || m.rescheduleNote) {
    return out("held", "unlinked_reschedule");
  }
  if (base.intervalDays !== null && base.intervalDays < REPEAT_DAYS) {
    return out("excluded", "repeat_within_60_days");
  }
  if (verdict.kind === "family" && !origin.source)
    return out("held", "source_unavailable");
  return out("counted", "counted");
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
