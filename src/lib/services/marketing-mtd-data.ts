import "server-only";

import { pacificToday } from "@/lib/admin/format-time";
import { config } from "@/lib/config";
import { cachedCloseReads, fetchCloseDeals } from "@/lib/services/close-wins";
import {
  buildGoalPlan,
  buildMarketingMtd,
  priorRange,
  type GoalPlan,
  type MarketingMtd,
} from "@/lib/services/marketing-mtd";
import { readAllPages } from "@/lib/services/paged-read";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingMtdReport =
  | {
      ok: true;
      mtd: MarketingMtd;
      goal: GoalPlan;
      /** Latest row the hourly Close mirror wrote: when bookings and flags were read. */
      bookingsAsOf: string | null;
      /** When won deals were read from Close. */
      winsAsOf: string;
    }
  | { ok: false; error: string };

/**
 * Jess's marketing view for the month so far and the same dates last month.
 * Bookings come from `close_lead_funnel`; wins from Close itself. Never throws:
 * a failed read says so, because a page of zeros reads as a bad month.
 */
export async function getMarketingMtd(
  input: { now?: Date } = {},
): Promise<MarketingMtdReport> {
  const today = pacificToday(input.now ?? new Date());
  const current = { from: `${today.slice(0, 7)}-01`, to: today };
  const prior = priorRange(current);
  if (!config.CLOSE_API_KEY) {
    return { ok: false, error: "CLOSE_API_KEY is not set." };
  }
  const client = createAdminClient();
  try {
    const [bookings, deals] = await Promise.all([
      readAllPages((from, to, count) =>
        client
          .from("close_lead_funnel")
          .select(
            "lead_id,display_name,funnel,status_label,first_sales_call_booked_date,first_call_show_up,qualified,lead_owner,business_line,synced_at",
            { count },
          )
          .gte("first_sales_call_booked_date", prior.from)
          .lte("first_sales_call_booked_date", today)
          .order("lead_id")
          .range(from, to),
      ),
      fetchCloseDeals({
        from: prior.from,
        to: today,
        close: cachedCloseReads(),
        mirror: client,
      }),
    ]);
    if (bookings.error) {
      throw new Error(
        `close_lead_funnel read failed: ${bookings.error.message}`,
      );
    }
    const calls = bookings.rows.flatMap((row) =>
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
    const mtd = buildMarketingMtd({ calls, deals, current });
    return {
      ok: true,
      mtd,
      goal: buildGoalPlan({ booked: mtd.total.current.booked, today }),
      bookingsAsOf: bookings.rows.reduce<string | null>(
        (latest, row) =>
          !latest || row.synced_at > latest ? row.synced_at : latest,
        null,
      ),
      winsAsOf: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Marketing MTD read failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Close read failed.",
    };
  }
}
