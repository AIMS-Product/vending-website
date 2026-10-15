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
import {
  v2DashboardCalls,
  type LeadFirstCall,
} from "@/lib/analytics/dashboard-metrics";
import { pacificStartIso } from "@/lib/services/data-report";
import { readAllPages } from "@/lib/services/paged-read";
import { mapLimit } from "@/lib/services/seo-rank-sync";
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
/** Candidate leads past which the whole history tables are read at once. */
const WHOLE_TABLE_AFTER = 2_000;

const LEAD_COLUMNS =
  "lead_id,funnel,contact_utms,resource_tag,setter_name,business_line";
type LeadFactsRecord = {
  lead_id: string;
  funnel: string | null;
  contact_utms: unknown;
  resource_tag: string | null;
  setter_name: string | null;
  business_line: string | null;
};

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
  // Past a few thousand leads (a months-long window) one whole-table read is
  // faster than 100-id batches; a null batch means every lead.
  const batches: Array<string[] | null> = [];
  if (leadIds.length > WHOLE_TABLE_AFTER) batches.push(null);
  else
    for (let i = 0; i < leadIds.length; i += IN_BATCH)
      batches.push(leadIds.slice(i, i + IN_BATCH));
  const reads = await mapLimit(batches, 8, (ids) =>
    Promise.all([
      readAllPages<MeetingRecord>((from, to, count) => {
        const query = db.from("close_meetings").select(MEETING_COLUMNS, {
          count,
        });
        return (ids ? query.in("lead_id", ids) : query)
          .order("id")
          .range(from, to);
      }),
      readAllPages<LeadFactsRecord>((from, to, count) => {
        const query = db.from("close_meeting_leads").select(LEAD_COLUMNS, {
          count,
        });
        return (ids ? query.in("lead_id", ids) : query)
          .order("lead_id")
          .range(from, to);
      }),
    ]),
  );
  for (const read of reads) {
    const failure =
      read instanceof Error ? read : (read[0].error ?? read[1].error);
    if (failure || read instanceof Error) {
      console.error("booked calls v2: history read failed", failure);
      return { ok: false, error: "Could not read meeting history." };
    }
    const [meetings, facts] = read;
    history.push(...meetings.rows);
    for (const f of facts.rows) {
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

export type V2CallsRead =
  | {
      ok: true;
      calls: ReturnType<typeof v2DashboardCalls>;
      /** Newest `synced_at` among the meetings read. */
      syncedAt: string | null;
    }
  | { ok: false; error: string };

/**
 * Dom's counted meetings booked on Pacific days [fromDay, toDay], as the
 * dashboard's calls: each with the lead's Close first-call flags and current
 * status (`v2DashboardCalls`). Every page that counts booked calls reads this.
 */
export async function getV2Calls(
  fromDay: string,
  toDay: string,
): Promise<V2CallsRead> {
  const report = await getBookedCallsV2({
    from: pacificStartIso(fromDay),
    to: pacificStartIso(nextDay(toDay)),
  });
  if (!report.ok) return report;
  const leadIds = [
    ...new Set(
      report.decisions
        .filter((d) => d.disposition === "counted")
        .map((d) => d.leadId),
    ),
  ];
  const db = createAdminClient();
  const batches: string[][] = [];
  for (let i = 0; i < leadIds.length; i += IN_BATCH) {
    batches.push(leadIds.slice(i, i + IN_BATCH));
  }
  const reads = await mapLimit(batches, 8, async (ids) => {
    const { data, error } = await db
      .from("close_lead_funnel")
      .select(
        "lead_id,email,status_label,first_sales_call_booked_date,first_call_show_up,qualified",
      )
      .in("lead_id", ids);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  const leads = new Map<string, LeadFirstCall>();
  for (const read of reads) {
    if (read instanceof Error) {
      console.error("booked calls v2: lead flags read failed", read);
      return { ok: false, error: "Could not read Close lead flags." };
    }
    for (const row of read) {
      leads.set(row.lead_id, {
        email: row.email,
        status: row.status_label,
        firstCallDay: row.first_sales_call_booked_date,
        showUp: row.first_call_show_up,
        qualified: row.qualified,
      });
    }
  }
  return {
    ok: true,
    calls: v2DashboardCalls(report.decisions, leads),
    syncedAt: report.syncedAt,
  };
}

const nextDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
