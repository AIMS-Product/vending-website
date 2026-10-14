import type { Json, TablesInsert } from "@/types/database";

/**
 * Close meeting/lead -> mirror row mapping for booked calls V2. Pure and not
 * server-only, so `scripts/booked-calls-v2-validate.ts` can rebuild Dom's
 * numbers straight from Close with the same code the hourly sync uses.
 */

/**
 * Calendly's marker on a meeting it moved: "Reschedule Reason: Rescheduled
 * from connected calendar event" (Dom's "connected-calendar-reschedule note").
 * Not the bare "Reschedule: <link>" every Calendly note carries: matching
 * that held 215 of October's 524 meetings instead of Dom's 21.
 */
const CONNECTED_CALENDAR_RESCHEDULE =
  /rescheduled\s+from\s+connected\s+calendar/i;

export type MeetingRow = TablesInsert<"close_meetings">;
export type LeadRow = TablesInsert<"close_meeting_leads">;

export const LEAD_LABELS = {
  funnel: "funnel name deal (opp)",
  setter: "reactivation - setter name",
  businessLine: "btc business line",
  resourceTag: "resource tag",
} as const;

export type LeadFieldIds = {
  lead: Partial<Record<keyof typeof LEAD_LABELS, string>>;
  utmSource?: string;
  utmMedium?: string;
};

/** Before the org's first meeting (2024-05-24); each empty month still costs a request. */
export const HISTORY_START = "2024-01-01T00:00:00Z";

/** Whole-second ISO, never fractional (see `listMeetings`). */
export function wholeSecond(ms: number): string {
  return new Date(Math.floor(ms / 1000) * 1000)
    .toISOString()
    .replace(".000Z", "Z");
}

/** Month-start fences from HISTORY_START to one second past `now`. */
export function monthWindows(now: Date): Array<[string, string]> {
  const end = Math.floor(now.getTime() / 1000) * 1000 + 1000;
  const windows: Array<[string, string]> = [];
  const cursor = new Date(HISTORY_START);
  while (cursor.getTime() < end) {
    const next = new Date(cursor);
    next.setUTCMonth(next.getUTCMonth() + 1);
    windows.push([
      wholeSecond(cursor.getTime()),
      wholeSecond(Math.min(next.getTime(), end)),
    ]);
    cursor.setTime(next.getTime());
  }
  return windows;
}

export function mapMeeting(
  raw: Record<string, unknown>,
  outcomes: ReadonlyMap<string, string>,
  syncedAt: string,
): MeetingRow | null {
  const id = text(raw.id);
  const leadId = text(raw.lead_id);
  const created = text(raw.date_created);
  if (!id || !leadId || !created) return null;
  const outcomeId = text(raw.outcome_id);
  return {
    id,
    lead_id: leadId,
    user_id: text(raw.user_id),
    user_name: text(raw.user_name),
    title: text(raw.title),
    status: text(raw.status),
    outcome: outcomeId ? (outcomes.get(outcomeId) ?? outcomeId) : null,
    starts_at: text(raw.starts_at),
    date_created: created,
    date_updated: text(raw.date_updated),
    reschedule_note: CONNECTED_CALENDAR_RESCHEDULE.test(
      `${text(raw.note) ?? ""} ${text(raw.user_note_html) ?? ""}`,
    ),
    synced_at: syncedAt,
  };
}

function customValue(
  obj: Record<string, unknown>,
  id: string | undefined,
): string | null {
  if (!id) return null;
  const nested = (obj.custom ?? {}) as Record<string, unknown>;
  return text(obj[`custom.${id}`] ?? nested[id]);
}

export function mapLeadFacts(
  lead: Record<string, unknown>,
  ids: LeadFieldIds,
  syncedAt: string,
): LeadRow | null {
  const leadId = text(lead.id);
  if (!leadId) return null;
  const contacts = Array.isArray(lead.contacts)
    ? (lead.contacts as Record<string, unknown>[])
    : [];
  const utms = contacts
    .map((c) => ({
      source: customValue(c, ids.utmSource),
      medium: customValue(c, ids.utmMedium),
    }))
    .filter((u) => u.source);
  return {
    lead_id: leadId,
    funnel: customValue(lead, ids.lead.funnel),
    contact_utms: utms as unknown as Json,
    resource_tag: customValue(lead, ids.lead.resourceTag),
    setter_name: customValue(lead, ids.lead.setter),
    business_line: customValue(lead, ids.lead.businessLine),
    synced_at: syncedAt,
  };
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
