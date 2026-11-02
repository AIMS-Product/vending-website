import {
  isCanceled,
  pacificDay,
  type Decision,
  type Meeting,
  type Reason,
} from "@/lib/booked-calls-v2/engine";
import { VP_INVEST_FIELD_OPTIONS } from "@/lib/qualification/vp-fields";

/**
 * The people behind the Google Ads numbers: who booked, whether they showed,
 * and the ad that brought them. `counted` is Dom's booked-call rule credited
 * to Google Ads; `alsoInHeadline` is every other ad-click lead the page's
 * headline count includes, each with why Dom's rule leaves it out.
 */

export type ShowStatus =
  | "Showed"
  | "No-show"
  | "Rescheduled"
  | "Canceled"
  | "Upcoming"
  | "Not logged";

export type PersonAd = {
  campaign: string | null;
  adGroup: string | null;
  keyword: string | null;
  /** Headlines when one ad can be named; a lead records its ad group, not its ad. */
  headlines: string[];
  /** Ads that ran in the group when more than one could have been the click. */
  possibleAds: number;
  /** Set when the lead carries no Google campaign: its raw link tags, or why not. */
  note: string | null;
};

export type BookedPerson = {
  key: string;
  leadId: string | null;
  closeUrl: string | null;
  name: string;
  /** Pacific day the lead first came in on the site. */
  leadDay: string | null;
  /** Pacific day the call was booked. Null when no meeting is in the window. */
  bookedDay: string | null;
  callDay: string | null;
  bookedBy: string | null;
  show: ShowStatus;
  capital: string | null;
  qualified: string | null;
  closeStatus: string | null;
  ad: PersonAd;
  /** Why Dom's rule leaves this person out; null on counted people. */
  whyNotCounted: string | null;
};

export type SubmissionRow = {
  close_lead_id: string | null;
  full_name: string | null;
  created_at: string;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  qualification_summary: unknown;
  gclid: string | null;
};

export type FunnelRow = {
  lead_id: string;
  display_name: string | null;
  first_sales_call_booked_date: string | null;
  first_call_show_up: string | null;
  qualified: string | null;
  status_label: string | null;
};

export type AdDayRow = {
  day: string;
  campaign_id: string;
  ad_group_id: string;
  ad_group_name: string | null;
  ad_id: string;
  headlines: unknown;
  clicks: number | null;
};

const REASONS: Partial<Record<Reason, string>> = {
  canceled: "Canceled",
  follow_up_title: "Follow-up call",
  unapproved_title: "Call type not counted",
  within_episode: "Repeat within 30 days",
  not_sales_call: "Not a sales call",
  source_unavailable: "Source unavailable",
};

const CAPITAL = new Map<string, string>(
  VP_INVEST_FIELD_OPTIONS.map((o) => [
    o.value,
    o.value === "no_cash" ? "No cash" : o.label,
  ]),
);

/** The stated capital off a form's stored answers, in words. */
export function capitalOf(summary: unknown): string | null {
  const value =
    summary && typeof summary === "object" && "available_capital" in summary
      ? summary.available_capital
      : null;
  return typeof value === "string" ? (CAPITAL.get(value) ?? value) : null;
}

/**
 * Meeting outcome first. `First Call Show Up` describes only the lead's first
 * sales call, so it fills a blank outcome only when the call day matches it.
 */
export function showOf(
  meeting: Meeting | undefined,
  funnel: FunnelRow | undefined,
  now: Date,
): ShowStatus {
  const logged = funnel?.first_call_show_up?.trim().toLowerCase();
  const fromFirstCall = (): ShowStatus =>
    logged === "yes" ? "Showed" : logged === "no" ? "No-show" : "Not logged";
  if (!meeting) return fromFirstCall();
  if (isCanceled(meeting)) return "Canceled";
  const outcome = meeting.outcome?.trim().toLowerCase();
  if (outcome === "completed") return "Showed";
  if (outcome === "no show") return "No-show";
  if (outcome === "rescheduled") return "Rescheduled";
  const startsAt = meeting.startsAt ? Date.parse(meeting.startsAt) : NaN;
  if (Number.isFinite(startsAt) && startsAt > now.getTime()) return "Upcoming";
  if (!meeting.startsAt) return "Not logged";
  const firstCall = funnel?.first_sales_call_booked_date?.slice(0, 10);
  const days = [meeting.startsAt.slice(0, 10), pacificDay(meeting.startsAt)];
  return firstCall && days.includes(firstCall) ? fromFirstCall() : "Not logged";
}

const strings = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

/**
 * utm_content is the ad group id (the account's final URL suffix). One ad with
 * clicks in the group names the ad exactly; several narrow to the lead's day.
 */
export function adFor(
  submission: SubmissionRow | undefined,
  adDays: readonly AdDayRow[],
  campaignNames: ReadonlyMap<string, string>,
): PersonAd {
  const empty = { campaign: null, adGroup: null, keyword: null, headlines: [] };
  if (!submission)
    return { ...empty, possibleAds: 0, note: "No site form on this lead" };
  const { utm_campaign: campaign, utm_content: group } = submission;
  const term = submission.utm_term?.trim().toLowerCase();
  const keyword = term && !term.startsWith("{") ? term : null;
  if (!campaign || !/^\d+$/.test(campaign)) {
    const tags = [campaign, group, keyword].filter(Boolean).join(" · ");
    return {
      ...empty,
      keyword,
      possibleAds: 0,
      note: tags ? `Link tag, not an ad: ${tags}` : "No ad tags on this lead",
    };
  }
  const inGroup = adDays.filter(
    (r) => r.ad_group_id === group && Number(r.clicks ?? 0) > 0,
  );
  const leadDay = pacificDay(submission.created_at);
  const sameDay = inGroup.filter((r) => r.day === leadDay);
  const pool = sameDay.length ? sameDay : inGroup;
  const ids = new Set(pool.map((r) => r.ad_id));
  const newest = [...pool].sort((a, b) => b.day.localeCompare(a.day))[0];
  return {
    campaign: campaignNames.get(campaign) ?? campaign,
    adGroup:
      adDays.find((r) => r.ad_group_id === group)?.ad_group_name ??
      group ??
      null,
    keyword,
    headlines: ids.size === 1 && newest ? strings(newest.headlines) : [],
    possibleAds: ids.size,
    note: null,
  };
}

/** The ad-click row when a lead has several forms, else its earliest. */
function pickSubmission(rows: readonly SubmissionRow[]) {
  const sorted = [...rows].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  return sorted.find((r) => r.gclid) ?? sorted[0];
}

const closeUrl = (leadId: string) =>
  `https://app.close.com/lead/${encodeURIComponent(leadId)}/`;

export function whyNotCounted(decisions: readonly Decision[]): string {
  const elsewhere = decisions.find((d) => d.disposition === "counted");
  if (elsewhere)
    return `Credited to ${elsewhere.origin.source ?? "Unknown"}, not Google Ads`;
  const reason = decisions[0]?.reason;
  if (!reason) return "Call booked outside these dates";
  return REASONS[reason] ?? "Held for review";
}

export type BookedPeople = {
  counted: BookedPerson[];
  alsoInHeadline: BookedPerson[];
};

export function buildBookedPeople(input: {
  decisions: readonly Decision[];
  meetings: readonly Meeting[];
  submissions: readonly SubmissionRow[];
  funnel: readonly FunnelRow[];
  adDays: readonly AdDayRow[];
  campaignNames: ReadonlyMap<string, string>;
  /** Ad-click leads the headline counts: created in range, with a booked date. */
  headlineLeads: readonly SubmissionRow[];
  now: Date;
}): BookedPeople {
  const meetings = new Map(input.meetings.map((m) => [m.id, m]));
  const funnel = new Map(input.funnel.map((f) => [f.lead_id, f]));
  const byLead = new Map<string, SubmissionRow[]>();
  for (const s of input.submissions) {
    if (!s.close_lead_id) continue;
    byLead.set(s.close_lead_id, [...(byLead.get(s.close_lead_id) ?? []), s]);
  }
  const person = (
    leadId: string,
    decision: Decision | undefined,
    why: string | null,
  ): BookedPerson => {
    const rows = byLead.get(leadId) ?? [];
    const submission = pickSubmission(rows);
    const lead = funnel.get(leadId);
    const meeting = decision ? meetings.get(decision.meetingId) : undefined;
    return {
      key: decision?.meetingId ?? leadId,
      leadId,
      closeUrl: closeUrl(leadId),
      name:
        lead?.display_name?.trim() ||
        submission?.full_name?.trim() ||
        "Name not synced",
      leadDay: submission ? pacificDay(submission.created_at) : null,
      bookedDay: decision?.createdDay ?? null,
      callDay: meeting?.startsAt ? pacificDay(meeting.startsAt) : null,
      bookedBy: decision?.bookedBy ?? null,
      show: showOf(meeting, lead, input.now),
      capital:
        rows.map((r) => capitalOf(r.qualification_summary)).find(Boolean) ??
        null,
      qualified: lead?.qualified ?? null,
      // Close status labels lead with an emoji.
      closeStatus:
        lead?.status_label?.replace(/^[^\p{L}\p{N}]+/u, "").trim() || null,
      ad: adFor(submission, input.adDays, input.campaignNames),
      whyNotCounted: why,
    };
  };

  const googleCounted = input.decisions.filter(
    (d) => d.disposition === "counted" && d.origin.source === "Google Ads",
  );
  const countedIds = new Set(googleCounted.map((d) => d.leadId));
  const newestFirst = (a: BookedPerson, b: BookedPerson) =>
    (b.bookedDay ?? b.leadDay ?? "").localeCompare(
      a.bookedDay ?? a.leadDay ?? "",
    ) || a.name.localeCompare(b.name);

  const seen = new Set<string>();
  const alsoInHeadline: BookedPerson[] = [];
  for (const lead of input.headlineLeads) {
    const id = lead.close_lead_id;
    if (!id) {
      alsoInHeadline.push({
        key: `gclid:${lead.gclid}`,
        leadId: null,
        closeUrl: null,
        name: lead.full_name?.trim() || "Name not synced",
        leadDay: pacificDay(lead.created_at),
        bookedDay: null,
        callDay: null,
        bookedBy: null,
        show: "Not logged",
        capital: capitalOf(lead.qualification_summary),
        qualified: null,
        closeStatus: null,
        ad: adFor(lead, input.adDays, input.campaignNames),
        whyNotCounted: "Not linked to a Close lead",
      });
      continue;
    }
    if (countedIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    const decisions = input.decisions.filter((d) => d.leadId === id);
    alsoInHeadline.push(person(id, decisions[0], whyNotCounted(decisions)));
  }
  return {
    counted: googleCounted
      .map((d) => person(d.leadId, d, null))
      .sort(newestFirst),
    alsoInHeadline: alsoInHeadline.sort(newestFirst),
  };
}
