import "server-only";

import { pacificToday } from "@/lib/admin/format-time";
import {
  evaluate,
  summarize,
  type Decision,
  type LeadFacts,
  type Meeting,
  type V2Summary,
} from "@/lib/booked-calls-v2/engine";
import { RULE_VERSION } from "@/lib/booked-calls-v2/rules";
import { pacificStartIso } from "@/lib/services/data-report";
import { readAllPages } from "@/lib/services/paged-read";
import { createAdminClient } from "@/lib/supabase/admin";

export type BookedCallsV2Report =
  | {
      ok: true;
      ruleVersion: string;
      /** Creation window [from, to), ISO. `to` is the snapshot fence. */
      from: string;
      to: string;
      summary: V2Summary;
      decisions: Decision[];
      syncedAt: string | null;
    }
  | { ok: false; error: string };

// 100 lead ids keep the `in.(...)` filter well under URL length limits.
const IN_BATCH = 100;

type MeetingRecord = {
  id: string;
  lead_id: string;
  user_id: string | null;
  user_name: string | null;
  title: string | null;
  status: string | null;
  outcome: string | null;
  starts_at: string | null;
  date_created: string;
  reschedule_note: boolean;
  synced_at: string;
};

const MEETING_COLUMNS =
  "id,lead_id,user_id,user_name,title,status,outcome,starts_at,date_created,reschedule_note,synced_at";

function toMeeting(r: MeetingRecord): Meeting {
  return {
    id: r.id,
    leadId: r.lead_id,
    userId: r.user_id,
    userName: r.user_name,
    title: r.title,
    status: r.status,
    outcome: r.outcome,
    startsAt: r.starts_at,
    dateCreated: r.date_created,
    rescheduleNote: r.reschedule_note,
  };
}

/** Month to date by Close meeting creation day (Pacific), Dom's V2 rule. */
export function monthToDateWindow(now = new Date()): {
  from: string;
  to: string;
} {
  const today = pacificToday(now);
  return {
    from: pacificStartIso(`${today.slice(0, 7)}-01`),
    to: new Date(Math.floor(now.getTime() / 1000) * 1000).toISOString(),
  };
}

export async function getBookedCallsV2(
  window: { from: string; to: string } = monthToDateWindow(),
): Promise<BookedCallsV2Report> {
  const db = createAdminClient();

  const candidates = await readAllPages<MeetingRecord>((from, to, count) =>
    db
      .from("close_meetings")
      .select(MEETING_COLUMNS, { count })
      .gte("date_created", window.from)
      .lt("date_created", window.to)
      .order("id")
      .range(from, to),
  );
  if (candidates.error) {
    console.error("booked calls v2: candidate read failed", candidates.error);
    return { ok: false, error: "Could not read Close meetings." };
  }

  // Full retained history for each candidate lead: the 60-day rule looks
  // before the window.
  const leadIds = [...new Set(candidates.rows.map((m) => m.lead_id))];
  const history: MeetingRecord[] = [];
  const leads = new Map<string, LeadFacts>();
  for (let i = 0; i < leadIds.length; i += IN_BATCH) {
    const ids = leadIds.slice(i, i + IN_BATCH);
    const [meetings, facts] = await Promise.all([
      readAllPages<MeetingRecord>((from, to, count) =>
        db
          .from("close_meetings")
          .select(MEETING_COLUMNS, { count })
          .in("lead_id", ids)
          .order("id")
          .range(from, to),
      ),
      db
        .from("close_meeting_leads")
        .select(
          "lead_id,funnel,contact_utms,resource_tag,setter_name,business_line",
        )
        .in("lead_id", ids),
    ]);
    if (meetings.error || facts.error) {
      console.error(
        "booked calls v2: history read failed",
        meetings.error ?? facts.error,
      );
      return { ok: false, error: "Could not read meeting history." };
    }
    history.push(...meetings.rows);
    for (const f of facts.data ?? []) {
      leads.set(f.lead_id, {
        funnel: f.funnel,
        contactUtms: Array.isArray(f.contact_utms)
          ? (f.contact_utms as Array<{
              source?: string | null;
              medium?: string | null;
            }>)
          : [],
        resourceTag: f.resource_tag,
        setterName: f.setter_name,
        businessLine: f.business_line,
      });
    }
  }

  const decisions = evaluate({
    meetings: history.map(toMeeting),
    leads,
    from: window.from,
    to: window.to,
  });
  const syncedAt = candidates.rows.reduce<string | null>(
    (latest, m) => (!latest || m.synced_at > latest ? m.synced_at : latest),
    null,
  );
  return {
    ok: true,
    ruleVersion: RULE_VERSION,
    from: window.from,
    to: window.to,
    summary: summarize(decisions),
    decisions,
    syncedAt,
  };
}
