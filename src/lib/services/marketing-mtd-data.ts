import "server-only";

import { pacificToday } from "@/lib/admin/format-time";
import {
  CANCELED_TITLE,
  NON_NEW_CALL_TITLE,
} from "@/lib/booked-calls-v2/rules";
import {
  readCalls,
  readDeals,
  readFacts,
} from "@/lib/services/analytics-dashboard-data";
import {
  buildGoalPlan,
  buildMarketingMtd,
  priorRange,
  type GoalPlan,
  type MarketingMtd,
  type MtdBooking,
  type MtdCall,
} from "@/lib/services/marketing-mtd";
import {
  buildScorecard,
  SCORECARD_FROM,
  type Scorecard,
  type WebinarEvent,
} from "@/lib/services/marketing-scorecard";
import { readAllPages } from "@/lib/services/paged-read";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingMtdReport =
  | {
      ok: true;
      today: string;
      mtd: MarketingMtd;
      goal: GoalPlan;
      scorecard: Scorecard;
      webinars: WebinarEvent[];
      /** Latest row the hourly Close mirror wrote: when bookings and flags were read. */
      bookingsAsOf: string | null;
      /** When the page read Close and the mirror. */
      readAt: string;
    }
  | { ok: false; error: string };

type Db = ReturnType<typeof createAdminClient>;

/** Jess's booked population: every lead with a first-call booked date in range. */
async function readBookings(db: Db, from: string, to: string) {
  const read = await readAllPages((start, end, count) =>
    db
      .from("close_lead_funnel")
      .select(
        "lead_id,display_name,funnel,status_label,first_sales_call_booked_date,first_call_show_up,qualified,lead_owner,business_line,synced_at",
        { count },
      )
      .gte("first_sales_call_booked_date", from)
      .lte("first_sales_call_booked_date", to)
      .order("lead_id")
      .range(start, end),
  );
  if (read.error) {
    throw new Error(`close_lead_funnel read failed: ${read.error.message}`);
  }
  return read.rows;
}

/**
 * Leads with a verified upcoming first call: an upcoming Close meeting that is
 * not canceled and not a follow-up, reschedule or other non-sales title, and
 * no completed meeting since the booked date. Shown leads are dropped later.
 */
async function readOpenLeads(
  db: Db,
  leads: ReadonlyArray<{ leadId: string; bookedDate: string }>,
  now: Date,
): Promise<Set<string>> {
  const open = new Set<string>();
  const bookedOn = new Map(leads.map((l) => [l.leadId, l.bookedDate]));
  const ids = [...bookedOn.keys()];
  // 100 lead ids keep the `in.(...)` filter well under URL length limits.
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from("close_meetings")
      .select("lead_id,title,status,starts_at")
      .in("lead_id", ids.slice(i, i + 100));
    if (error) throw new Error(`close_meetings read failed: ${error.message}`);
    const completed = new Set(
      (data ?? [])
        .filter(
          (m) =>
            m.status === "completed" &&
            !!m.starts_at &&
            m.starts_at.slice(0, 10) >= bookedOn.get(m.lead_id)!,
        )
        .map((m) => m.lead_id),
    );
    for (const m of data ?? []) {
      const title = m.title ?? "";
      if (
        m.status === "upcoming" &&
        !!m.starts_at &&
        Date.parse(m.starts_at) > now.getTime() &&
        !CANCELED_TITLE.test(title) &&
        !NON_NEW_CALL_TITLE.test(title) &&
        !completed.has(m.lead_id)
      ) {
        open.add(m.lead_id);
      }
    }
  }
  return open;
}

/**
 * The marketing month so far and the same dates last month on Jess's
 * field-based rule: bookings from `close_lead_funnel`, wins and spend from the
 * main dashboard's readers. The Q4 scorecard tab stays on Dom's counted
 * meetings. Never throws: a failed read says so, because a page of zeros
 * reads as a bad month.
 */
export async function getMarketingMtd(
  input: { now?: Date } = {},
): Promise<MarketingMtdReport> {
  const now = input.now ?? new Date();
  const today = pacificToday(now);
  const current = { from: `${today.slice(0, 7)}-01`, to: today };
  const prior = priorRange(current);
  const from = [prior.from, SCORECARD_FROM].sort()[0]!;
  const db = createAdminClient();

  try {
    const [rows, calls, deals, facts, webinars] = await Promise.all([
      readBookings(db, prior.from, today),
      readCalls(SCORECARD_FROM, today),
      readDeals(from, today),
      readFacts(from, today),
      db
        .from("webinar_events")
        .select(
          "date,label,registrations,attendees,booked_calls,won,revenue,spend",
        )
        .gte("date", from)
        .lte("date", today)
        .order("date"),
    ]);
    const failed = [calls, deals, facts].find((read) => !read.ok);
    if (failed && !failed.ok) return { ok: false, error: failed.error };
    if (!calls.ok || !deals.ok || !facts.ok) {
      return { ok: false, error: "A Close read failed." };
    }
    if (webinars.error) {
      throw new Error(`webinar_events read failed: ${webinars.error.message}`);
    }

    const bookings = rows.flatMap((row) =>
      row.first_sales_call_booked_date
        ? [
            {
              leadId: row.lead_id,
              name: row.display_name,
              funnel: row.funnel,
              status: row.status_label,
              bookedDate: row.first_sales_call_booked_date,
              showUp: row.first_call_show_up,
              qualified: row.qualified,
              leadOwner: row.lead_owner,
              businessLine: row.business_line,
            },
          ]
        : [],
    );
    const open = await readOpenLeads(
      db,
      bookings.filter((b) => b.bookedDate >= current.from),
      now,
    );
    const mtdBookings: MtdBooking[] = bookings.map((b) => ({
      ...b,
      open: open.has(b.leadId),
    }));
    const mtd = buildMarketingMtd({
      calls: mtdBookings,
      deals: deals.data,
      spend: facts.data,
      current,
    });
    const scorecardCalls: MtdCall[] = calls.data.map((call) => ({
      ...call,
      name: call.email,
    }));
    return {
      ok: true,
      today,
      mtd,
      goal: buildGoalPlan({ booked: mtd.total.current.booked, today }),
      scorecard: buildScorecard({
        calls: scorecardCalls,
        spend: facts.data,
        today,
      }),
      webinars: webinars.data ?? [],
      bookingsAsOf: rows.reduce<string | null>(
        (latest, row) =>
          !latest || row.synced_at > latest ? row.synced_at : latest,
        null,
      ),
      readAt: now.toISOString(),
    };
  } catch (error) {
    console.error("Marketing MTD read failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Close read failed.",
    };
  }
}
